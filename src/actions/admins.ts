'use server'

import { db } from '@/db'
import { users, employees, workers, attendance, sessions } from '@/db/schema'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { and, eq, gt } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

// ─── Auth guard ───────────────────────────────────────────────────────────────
// Admins are users with role='admin'. Unlike supervisors they have NO employees
// row — they are managed purely at the users (auth) level here.

async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session || session.user.role !== 'admin') throw new Error('Unauthorised')
  return session
}

// ─── Safeguard helpers ──────────────────────────────────────────────────────────

async function getActiveAdminCount(): Promise<number> {
  const rows = await db.query.users.findMany({
    where: and(eq(users.role, 'admin'), eq(users.status, 'active')),
  })
  return rows.length
}

/** Throws if the session user is acting on their own account. */
function assertNotSelf(sessionUserId: string, targetUserId: string) {
  if (sessionUserId === targetUserId) {
    throw new Error('You cannot manage your own admin account here — use Settings instead.')
  }
}

// ─── List all admins ─────────────────────────────────────────────────────────
// Includes a live session count per admin (monitor) and flags the current user.

export async function getAllAdmins() {
  const session = await requireAdmin()

  const adminUsers = await db.query.users.findMany({
    where: eq(users.role, 'admin'),
    orderBy: (u, { asc }) => [asc(u.name)],
  })

  // Active (non-expired) sessions per admin — a light "currently signed in" signal
  const liveSessions = await db.query.sessions.findMany({
    where: gt(sessions.expiresAt, new Date()),
  })
  const sessionCount = new Map<string, number>()
  for (const s of liveSessions) {
    sessionCount.set(s.userId, (sessionCount.get(s.userId) ?? 0) + 1)
  }

  return {
    currentUserId: session.user.id,
    admins: adminUsers.map((u) => ({
      userId: u.id,
      name: u.name,
      email: u.email,
      status: u.status,
      createdAt: u.createdAt,
      activeSessions: sessionCount.get(u.id) ?? 0,
      isSelf: u.id === session.user.id,
    })),
  }
}

// ─── Create admin ──────────────────────────────────────────────────────────────

const createAdminSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  email: z.string().email('Valid email required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

export async function createAdmin(input: z.infer<typeof createAdminSchema>) {
  await requireAdmin()
  const data = createAdminSchema.parse(input)

  const existing = await db.query.users.findFirst({
    where: eq(users.email, data.email),
  })
  if (existing) throw new Error('Email already in use')

  const result = await auth.api.signUpEmail({
    body: { email: data.email, password: data.password, name: data.name },
  })
  if (!result?.user?.id) throw new Error('Failed to create user account')

  await db
    .update(users)
    .set({ role: 'admin', status: 'active' })
    .where(eq(users.id, result.user.id))

  revalidatePath('/admin/admins')
}

// ─── Update admin (name only) ────────────────────────────────────────────────
// Email is the login identifier and is intentionally not editable here.

const updateAdminSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
})

export async function updateAdmin(userId: string, input: z.infer<typeof updateAdminSchema>) {
  const session = await requireAdmin()
  const data = updateAdminSchema.parse(input)
  assertNotSelf(session.user.id, userId)

  const target = await db.query.users.findFirst({ where: eq(users.id, userId) })
  if (!target || target.role !== 'admin') throw new Error('Admin not found')

  await db
    .update(users)
    .set({ name: data.name, updatedAt: new Date() })
    .where(eq(users.id, userId))

  // Keep any (rare) linked employee profile name in sync
  await db.update(employees).set({ name: data.name }).where(eq(employees.userId, userId))

  revalidatePath('/admin/admins')
}

// ─── Deactivate admin ────────────────────────────────────────────────────────

export async function deactivateAdmin(userId: string) {
  const session = await requireAdmin()
  assertNotSelf(session.user.id, userId)

  const target = await db.query.users.findFirst({ where: eq(users.id, userId) })
  if (!target || target.role !== 'admin') throw new Error('Admin not found')
  if (target.status === 'inactive') throw new Error('Admin already inactive')

  if ((await getActiveAdminCount()) <= 1) {
    throw new Error('Cannot deactivate the last active admin.')
  }

  await db.update(users).set({ status: 'inactive' }).where(eq(users.id, userId))
  await db.update(employees).set({ status: 'inactive' }).where(eq(employees.userId, userId))
  await db.delete(sessions).where(eq(sessions.userId, userId))

  revalidatePath('/admin/admins')
}

// ─── Reactivate admin ────────────────────────────────────────────────────────

export async function reactivateAdmin(userId: string) {
  const session = await requireAdmin()
  assertNotSelf(session.user.id, userId)

  const target = await db.query.users.findFirst({ where: eq(users.id, userId) })
  if (!target || target.role !== 'admin') throw new Error('Admin not found')
  if (target.status === 'active') throw new Error('Admin already active')

  await db.update(users).set({ status: 'active' }).where(eq(users.id, userId))
  await db.update(employees).set({ status: 'active' }).where(eq(employees.userId, userId))

  revalidatePath('/admin/admins')
}

// ─── Reset admin password ────────────────────────────────────────────────────

const resetAdminPasswordSchema = z.object({
  userId: z.string(),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
})

export async function resetAdminPassword(input: z.infer<typeof resetAdminPasswordSchema>) {
  const session = await requireAdmin()
  const data = resetAdminPasswordSchema.parse(input)
  assertNotSelf(session.user.id, data.userId)

  const target = await db.query.users.findFirst({ where: eq(users.id, data.userId) })
  if (!target || target.role !== 'admin') throw new Error('Admin not found')

  // Hash with better-auth's own hasher so login verification stays consistent
  const ctx = await auth.$context
  const hashed = await ctx.password.hash(data.newPassword)
  await ctx.internalAdapter.updatePassword(data.userId, hashed)

  // Invalidate all existing sessions for this admin
  await db.delete(sessions).where(eq(sessions.userId, data.userId))

  revalidatePath('/admin/admins')
}

// ─── Remove admin permanently ────────────────────────────────────────────────
// Hard deletes the users row — cascades to sessions, accounts, and any employee
// row. Detaches non-cascading references first (in case a linked employee exists).

export async function removeAdmin(userId: string) {
  const session = await requireAdmin()
  assertNotSelf(session.user.id, userId)

  const target = await db.query.users.findFirst({ where: eq(users.id, userId) })
  if (!target || target.role !== 'admin') throw new Error('Admin not found')

  if (target.status === 'active' && (await getActiveAdminCount()) <= 1) {
    throw new Error('Cannot remove the last active admin.')
  }

  // Detach non-cascading references via any linked employee row (admins normally
  // have none, but guard against it to avoid FK violations).
  const employee = await db.query.employees.findFirst({
    where: eq(employees.userId, userId),
  })
  if (employee) {
    await db.update(workers).set({ submittedBy: null }).where(eq(workers.submittedBy, employee.id))
    await db
      .update(attendance)
      .set({ morningMarkedBy: null })
      .where(eq(attendance.morningMarkedBy, employee.id))
    await db
      .update(attendance)
      .set({ eveningMarkedBy: null })
      .where(eq(attendance.eveningMarkedBy, employee.id))
  }

  await db.delete(users).where(eq(users.id, userId))

  revalidatePath('/admin/admins')
}
