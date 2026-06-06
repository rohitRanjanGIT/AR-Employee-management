'use server'

import { db } from '@/db'
import { workers, employees, cities, siteSupervisorAssignments } from '@/db/schema'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { eq, and, inArray, or } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { encryptAadhaar, decryptAadhaar, maskAadhaar, extractLastFour } from '@/lib/aadhaar'

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

async function getCurrentEmployee(userId: string) {
  const employee = await db.query.employees.findFirst({
    where: eq(employees.userId, userId),
  })
  if (!employee) throw new Error('Employee record not found')
  return employee
}

// ─── Schemas ──────────────────────────────────────────────────────────────────

const workerSchema = z.object({
  cityId: z.string().uuid(),
  name: z.string().min(1).max(200),
  age: z.number().int().min(18).max(80).optional(),
  phone: z.string().max(15).optional(),
  address: z.string().max(500).optional(),
  joinDate: z.string().optional(),
  emergencyContact: z.string().max(200).optional(),
  category: z.enum(['skilled', 'semi_skilled', 'helper']),
  wageDaily: z.string().min(1),
  otRate: z.string().optional(),
  aadhaar: z.string().length(12).regex(/^\d{12}$/, 'Aadhaar must be 12 digits').optional(),
})

// ─── Create Worker (Admin) ────────────────────────────────────────────────────

export async function createWorkerAsAdmin(input: z.infer<typeof workerSchema>) {
  await requireAdmin()
  const data = workerSchema.parse(input)

  const city = await db.query.cities.findFirst({ where: eq(cities.id, data.cityId) })
  if (!city) throw new Error('City not found')
  if (city.status === 'inactive') throw new Error('Cannot assign worker to an inactive city')

  let aadhaarEncrypted: string | null = null
  let aadhaarLastFour: string | null = null

  if (data.aadhaar) {
    aadhaarEncrypted = encryptAadhaar(data.aadhaar)
    aadhaarLastFour = extractLastFour(data.aadhaar)
  }

  await db.insert(workers).values({
    cityId: data.cityId,
    submittedBy: null,
    name: data.name,
    age: data.age ?? null,
    phone: data.phone ?? null,
    address: data.address ?? null,
    joinDate: data.joinDate ? new Date(data.joinDate) : null,
    emergencyContact: data.emergencyContact ?? null,
    category: data.category,
    wageDaily: data.wageDaily,
    otRate: data.otRate ?? null,
    aadhaarEncrypted,
    aadhaarLastFour,
    status: 'active',
    resubmitted: false,
  })

  revalidatePath('/admin/workers')
}

// ─── Submit Worker Draft (Supervisor) ────────────────────────────────────────

export async function submitWorkerAsSupervisor(input: z.infer<typeof workerSchema>) {
  const session = await requireAuth()
  if (session.user.role !== 'supervisor') throw new Error('Unauthorised')

  const data = workerSchema.parse(input)
  const employee = await getCurrentEmployee(session.user.id)

  const assignments = await db.query.siteSupervisorAssignments.findMany({
    where: eq(siteSupervisorAssignments.employeeId, employee.id),
    with: { site: true },
  })
  const assignedCityIds = [...new Set(assignments.map((a) => a.site.cityId))]
  if (!assignedCityIds.includes(data.cityId)) {
    throw new Error('You can only submit workers for cities where you have an assigned site')
  }

  let aadhaarEncrypted: string | null = null
  let aadhaarLastFour: string | null = null

  if (data.aadhaar) {
    aadhaarEncrypted = encryptAadhaar(data.aadhaar)
    aadhaarLastFour = extractLastFour(data.aadhaar)
  }

  await db.insert(workers).values({
    cityId: data.cityId,
    submittedBy: employee.id,
    name: data.name,
    age: data.age ?? null,
    phone: data.phone ?? null,
    address: data.address ?? null,
    joinDate: data.joinDate ? new Date(data.joinDate) : null,
    emergencyContact: data.emergencyContact ?? null,
    category: data.category,
    wageDaily: data.wageDaily,
    otRate: data.otRate ?? null,
    aadhaarEncrypted,
    aadhaarLastFour,
    status: 'pending',
    resubmitted: false,
  })

  revalidatePath('/supervisor/workers')
}

// ─── Get All Workers (Admin) ──────────────────────────────────────────────────

export async function getAllWorkers() {
  await requireAdmin()
  const rows = await db.query.workers.findMany({
    with: { city: true, submittedByEmployee: true },
    orderBy: (w, { desc }) => [desc(w.createdAt)],
  })
  return rows.map(({ aadhaarEncrypted: _aes, ...w }) => ({
    ...w,
    aadhaarDisplay: w.aadhaarLastFour ? maskAadhaar(w.aadhaarLastFour) : null,
  }))
}

// ─── Get Workers for Supervisor ───────────────────────────────────────────────

export async function getWorkersForSupervisor() {
  const session = await requireAuth()
  if (session.user.role !== 'supervisor') throw new Error('Unauthorised')

  const employee = await getCurrentEmployee(session.user.id)

  const assignments = await db.query.siteSupervisorAssignments.findMany({
    where: eq(siteSupervisorAssignments.employeeId, employee.id),
    with: { site: true },
  })
  const assignedCityIds = [...new Set(assignments.map((a) => a.site.cityId))]

  if (assignedCityIds.length === 0) return []

  const rows = await db.query.workers.findMany({
    where: or(
      and(
        inArray(workers.cityId, assignedCityIds),
        eq(workers.status, 'active')
      ),
      and(
        eq(workers.submittedBy, employee.id),
        inArray(workers.status, ['pending', 'rejected'])
      )
    ),
    with: { city: true },
    orderBy: (w, { desc }) => [desc(w.createdAt)],
  })

  return rows.map(({ aadhaarEncrypted: _aes, ...w }) => ({
    ...w,
    aadhaarDisplay: w.aadhaarLastFour ? maskAadhaar(w.aadhaarLastFour) : null,
  }))
}

// ─── Approve Worker ───────────────────────────────────────────────────────────

const approveWorkerSchema = z.object({
  workerId: z.string().uuid(),
  wageDaily: z.string().min(1),
  otRate: z.string().optional(),
})

export async function approveWorker(input: z.infer<typeof approveWorkerSchema>) {
  await requireAdmin()
  const data = approveWorkerSchema.parse(input)

  const worker = await db.query.workers.findFirst({ where: eq(workers.id, data.workerId) })
  if (!worker) throw new Error('Worker not found')
  if (worker.status !== 'pending') throw new Error('Worker is not pending')

  await db
    .update(workers)
    .set({
      status: 'active',
      wageDaily: data.wageDaily,
      otRate: data.otRate ?? worker.otRate,
      rejectionReason: null,
      updatedAt: new Date(),
    })
    .where(eq(workers.id, data.workerId))

  revalidatePath('/admin/workers')
}

// ─── Reject Worker ────────────────────────────────────────────────────────────

const rejectWorkerSchema = z.object({
  workerId: z.string().uuid(),
  reason: z.string().max(500).optional(),
})

export async function rejectWorker(input: z.infer<typeof rejectWorkerSchema>) {
  await requireAdmin()
  const data = rejectWorkerSchema.parse(input)

  const worker = await db.query.workers.findFirst({ where: eq(workers.id, data.workerId) })
  if (!worker) throw new Error('Worker not found')
  if (worker.status !== 'pending') throw new Error('Worker is not pending')

  await db
    .update(workers)
    .set({
      status: 'rejected',
      rejectionReason: data.reason ?? null,
      updatedAt: new Date(),
    })
    .where(eq(workers.id, data.workerId))

  revalidatePath('/admin/workers')
}

// ─── Resubmit Rejected Worker (Supervisor) ────────────────────────────────────

export async function resubmitWorker(workerId: string, input: z.infer<typeof workerSchema>) {
  const session = await requireAuth()
  if (session.user.role !== 'supervisor') throw new Error('Unauthorised')

  const data = workerSchema.parse(input)
  const employee = await getCurrentEmployee(session.user.id)

  const worker = await db.query.workers.findFirst({
    where: and(eq(workers.id, workerId), eq(workers.submittedBy, employee.id)),
  })
  if (!worker) throw new Error('Worker not found or not your submission')
  if (worker.status !== 'rejected') throw new Error('Only rejected workers can be resubmitted')

  let aadhaarEncrypted = worker.aadhaarEncrypted
  let aadhaarLastFour = worker.aadhaarLastFour

  if (data.aadhaar) {
    aadhaarEncrypted = encryptAadhaar(data.aadhaar)
    aadhaarLastFour = extractLastFour(data.aadhaar)
  }

  await db
    .update(workers)
    .set({
      cityId: data.cityId,
      name: data.name,
      age: data.age ?? null,
      phone: data.phone ?? null,
      address: data.address ?? null,
      joinDate: data.joinDate ? new Date(data.joinDate) : null,
      emergencyContact: data.emergencyContact ?? null,
      category: data.category,
      wageDaily: data.wageDaily,
      otRate: data.otRate ?? null,
      aadhaarEncrypted,
      aadhaarLastFour,
      status: 'pending',
      rejectionReason: null,
      resubmitted: true,
      updatedAt: new Date(),
    })
    .where(eq(workers.id, workerId))

  revalidatePath('/supervisor/workers')
}

// ─── Reveal Aadhaar (Admin Only) ──────────────────────────────────────────────

export async function revealAadhaar(workerId: string): Promise<string> {
  const session = await requireAdmin()

  const worker = await db.query.workers.findFirst({ where: eq(workers.id, workerId) })
  if (!worker) throw new Error('Worker not found')
  if (!worker.aadhaarEncrypted) throw new Error('No Aadhaar on record')

  const decrypted = decryptAadhaar(worker.aadhaarEncrypted)

  const existingLogs = (worker.aadhaarRevealLogs as { revealedBy: string; revealedByName: string; revealedAt: string }[]) ?? []
  const newLog = {
    revealedBy: session.user.id,
    revealedByName: session.user.name,
    revealedAt: new Date().toISOString(),
  }

  await db
    .update(workers)
    .set({ aadhaarRevealLogs: [...existingLogs, newLog], updatedAt: new Date() })
    .where(eq(workers.id, workerId))

  return decrypted
}

// ─── Reassign Worker City (Admin Only) ────────────────────────────────────────

export async function reassignWorkerCity(workerId: string, newCityId: string) {
  await requireAdmin()

  const city = await db.query.cities.findFirst({ where: eq(cities.id, newCityId) })
  if (!city) throw new Error('City not found')
  if (city.status === 'inactive') throw new Error('Cannot assign worker to an inactive city')

  await db
    .update(workers)
    .set({ cityId: newCityId, updatedAt: new Date() })
    .where(eq(workers.id, workerId))

  revalidatePath('/admin/workers')
}
