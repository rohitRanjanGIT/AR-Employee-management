'use server'

import { db } from '@/db'
import { users, employees, workers, attendance, sessions } from '@/db/schema'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

// ─── Auth guards ──────────────────────────────────────────────────────────────

async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session || session.user.role !== 'admin') throw new Error('Unauthorised')
  return session
}

async function requireAuth() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) throw new Error('Unauthorised')
  return session
}

// ─── Update own profile ───────────────────────────────────────────────────────
// Available to both admin and supervisor. Salary/city are admin-only — excluded.

const updateOwnProfileSchema = z.object({
  name: z.string().min(1).max(200),
  phone: z.string().max(15).optional(),
})

export async function updateOwnProfile(input: z.infer<typeof updateOwnProfileSchema>) {
  const session = await requireAuth()
  const data = updateOwnProfileSchema.parse(input)

  // Display name in users table (used by better-auth session)
  await db
    .update(users)
    .set({ name: data.name, updatedAt: new Date() })
    .where(eq(users.id, session.user.id))

  // Employee profile
  await db
    .update(employees)
    .set({ name: data.name, phone: data.phone ?? null, updatedAt: new Date() })
    .where(eq(employees.userId, session.user.id))

  revalidatePath('/settings')
  revalidatePath('/admin/dashboard')
  revalidatePath('/supervisor/dashboard')
}

// ─── Change own password ──────────────────────────────────────────────────────

const changeOwnPasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
})

export async function changeOwnPassword(input: z.infer<typeof changeOwnPasswordSchema>) {
  await requireAuth()
  const data = changeOwnPasswordSchema.parse(input)

  try {
    await auth.api.changePassword({
      headers: await headers(),
      body: {
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
        revokeOtherSessions: false,
      },
    })
  } catch {
    // better-auth throws on wrong current password
    throw new Error('Current password is incorrect')
  }
}

// ─── Admin: reset supervisor password ────────────────────────────────────────
// Sets a new password directly — no current password needed. Ends all sessions.

const resetSupervisorPasswordSchema = z.object({
  employeeId: z.string().uuid(),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
})

export async function resetSupervisorPassword(
  input: z.infer<typeof resetSupervisorPasswordSchema>
) {
  await requireAdmin()
  const data = resetSupervisorPasswordSchema.parse(input)

  const employee = await db.query.employees.findFirst({
    where: eq(employees.id, data.employeeId),
    with: { user: true },
  })
  if (!employee) throw new Error('Employee not found')
  if (employee.user.role !== 'supervisor') throw new Error('Not a supervisor')

  // Hash with better-auth's own hasher so login verification stays consistent,
  // then write to the credential account via the internal adapter.
  const ctx = await auth.$context
  const hashed = await ctx.password.hash(data.newPassword)
  await ctx.internalAdapter.updatePassword(employee.userId, hashed)

  // Invalidate all existing sessions for this user
  await db.delete(sessions).where(eq(sessions.userId, employee.userId))

  revalidatePath('/admin/supervisors')
}

// ─── Admin: remove supervisor permanently ────────────────────────────────────
// Hard deletes the users row — cascades to employees, sessions, accounts, and
// site assignments via FK. References that do NOT cascade (workers submitted,
// attendance marked) are detached first to avoid FK violations.
// Deactivation (from 1.1.5) is preferred for temporary suspension.

export async function removeSupervisor(employeeId: string) {
  await requireAdmin()

  const employee = await db.query.employees.findFirst({
    where: eq(employees.id, employeeId),
    with: { user: true },
  })
  if (!employee) throw new Error('Employee not found')
  if (employee.user.role !== 'supervisor') throw new Error('Not a supervisor')

  // Detach non-cascading references before deletion
  await db
    .update(workers)
    .set({ submittedBy: null })
    .where(eq(workers.submittedBy, employeeId))
  await db
    .update(attendance)
    .set({ morningMarkedBy: null })
    .where(eq(attendance.morningMarkedBy, employeeId))
  await db
    .update(attendance)
    .set({ eveningMarkedBy: null })
    .where(eq(attendance.eveningMarkedBy, employeeId))

  // Cascade delete: users → sessions, accounts, employees → site assignments
  await db.delete(users).where(eq(users.id, employee.userId))

  revalidatePath('/admin/supervisors')
  revalidatePath('/admin/sites')
}
