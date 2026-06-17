'use server'

import { db } from '@/db'
import { workers, employees, cities, siteSupervisorAssignments, attendance } from '@/db/schema'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { eq, and, inArray, or, ne } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { encryptAadhaar, decryptAadhaar, maskAadhaar, extractLastFour, validateAadhaar } from '@/lib/aadhaar'
import { uploadImage, deleteImage } from '@/lib/cloudinary'

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

// ─── Phone uniqueness guard ───────────────────────────────────────────────────

async function assertPhoneUnique(phone: string, excludeWorkerId?: string) {
  const workerConflict = await db.query.workers.findFirst({
    where: excludeWorkerId
      ? and(eq(workers.phone, phone), ne(workers.id, excludeWorkerId))
      : eq(workers.phone, phone),
  })
  if (workerConflict) throw new Error('Phone number is already registered to another worker')

  const employeeConflict = await db.query.employees.findFirst({
    where: eq(employees.phone, phone),
  })
  if (employeeConflict) throw new Error('Phone number is already registered to a staff member')
}

// ─── Schemas ──────────────────────────────────────────────────────────────────

const workerSchema = z.object({
  cityId: z.string().uuid(),
  name: z.string().min(1).max(200),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  phone: z.string().max(15).optional(),
  emergencyContact: z.string().max(200).optional(),
  category: z.enum(['skilled', 'semi_skilled', 'helper']),
  wageDaily: z.string().min(1),
  otRate2hr: z.string().optional(),
  otRate4hr: z.string().optional(),
  otRate6hr: z.string().optional(),
  // Bank details — admin-only; ignored when a supervisor submits.
  accountNumber: z.string().max(40).optional(),
  ifscCode: z.string().max(20).optional(),
  // Photo — already uploaded to Cloudinary by the form; final desired state.
  photoPublicId: z.string().optional(),
  photoUrl: z.string().optional(),
  aadhaar: z.string().length(12).regex(/^\d{12}$/).refine(validateAadhaar, {
    message: 'Aadhaar number failed checksum validation',
  }),
})

// ─── Photo upload (worker) ────────────────────────────────────────────────────

export async function uploadWorkerPhoto(formData: FormData): Promise<{ publicId: string; url: string }> {
  await requireAuth()
  const file = formData.get('file')
  if (!(file instanceof File)) throw new Error('No file provided')
  return uploadImage(file, 'worker')
}

/** Deletes `oldPublicId` from Cloudinary when it is being replaced or removed. */
async function reconcileWorkerPhoto(oldPublicId: string | null, newPublicId: string | null) {
  if (oldPublicId && oldPublicId !== newPublicId) await deleteImage(oldPublicId)
}

const resubmitWorkerSchema = workerSchema.extend({
  aadhaar: z.string().length(12).regex(/^\d{12}$/).refine(validateAadhaar, {
    message: 'Aadhaar number failed checksum validation',
  }).optional(),
})

// ─── Create Worker (Admin) ────────────────────────────────────────────────────

export async function createWorkerAsAdmin(input: z.infer<typeof workerSchema>) {
  await requireAdmin()
  const data = workerSchema.parse(input)

  const city = await db.query.cities.findFirst({ where: eq(cities.id, data.cityId) })
  if (!city) throw new Error('City not found')
  if (city.status === 'inactive') throw new Error('Cannot assign worker to an inactive city')

  if (data.phone) await assertPhoneUnique(data.phone)

  const aadhaarEncrypted = encryptAadhaar(data.aadhaar)
  const aadhaarLastFour = extractLastFour(data.aadhaar)

  await db.insert(workers).values({
    cityId: data.cityId,
    submittedBy: null,
    name: data.name,
    dateOfBirth: data.dateOfBirth ?? null,
    phone: data.phone ?? null,
    emergencyContact: data.emergencyContact ?? null,
    category: data.category,
    wageDaily: data.wageDaily,
    otRate2hr: data.otRate2hr ?? null,
    otRate4hr: data.otRate4hr ?? null,
    otRate6hr: data.otRate6hr ?? null,
    accountNumber: data.accountNumber ?? null,
    ifscCode: data.ifscCode ?? null,
    photoCloudinaryPublicId: data.photoPublicId ?? null,
    photoCloudinaryUrl: data.photoUrl ?? null,
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

  if (data.phone) await assertPhoneUnique(data.phone)

  const aadhaarEncrypted = encryptAadhaar(data.aadhaar)
  const aadhaarLastFour = extractLastFour(data.aadhaar)

  await db.insert(workers).values({
    cityId: data.cityId,
    submittedBy: employee.id,
    name: data.name,
    dateOfBirth: data.dateOfBirth ?? null,
    phone: data.phone ?? null,
    emergencyContact: data.emergencyContact ?? null,
    category: data.category,
    wageDaily: data.wageDaily,
    otRate2hr: data.otRate2hr ?? null,
    otRate4hr: data.otRate4hr ?? null,
    otRate6hr: data.otRate6hr ?? null,
    // Bank details are admin-only — never stored from a supervisor submission.
    photoCloudinaryPublicId: data.photoPublicId ?? null,
    photoCloudinaryUrl: data.photoUrl ?? null,
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
      and(inArray(workers.cityId, assignedCityIds), eq(workers.status, 'active')),
      and(
        eq(workers.submittedBy, employee.id),
        inArray(workers.status, ['pending', 'rejected'])
      )
    ),
    with: { city: true },
    orderBy: (w, { desc }) => [desc(w.createdAt)],
  })

  // Bank details (accountNumber/ifscCode) are admin-only — strip them so they
  // never reach a supervisor's browser, alongside the encrypted Aadhaar blob.
  return rows.map(({ aadhaarEncrypted: _aes, accountNumber: _acct, ifscCode: _ifsc, ...w }) => ({
    ...w,
    aadhaarDisplay: w.aadhaarLastFour ? maskAadhaar(w.aadhaarLastFour) : null,
  }))
}

// ─── Approve Worker ───────────────────────────────────────────────────────────

const approveWorkerSchema = z.object({
  workerId: z.string().uuid(),
  wageDaily: z.string().min(1),
  otRate2hr: z.string().optional(),
  otRate4hr: z.string().optional(),
  otRate6hr: z.string().optional(),
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
      otRate2hr: data.otRate2hr ?? worker.otRate2hr,
      otRate4hr: data.otRate4hr ?? worker.otRate4hr,
      otRate6hr: data.otRate6hr ?? worker.otRate6hr,
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
    .set({ status: 'rejected', rejectionReason: data.reason ?? null, updatedAt: new Date() })
    .where(eq(workers.id, data.workerId))

  revalidatePath('/admin/workers')
}

// ─── Resubmit Rejected Worker (Supervisor) ────────────────────────────────────

export async function resubmitWorker(workerId: string, input: z.infer<typeof resubmitWorkerSchema>) {
  const session = await requireAuth()
  if (session.user.role !== 'supervisor') throw new Error('Unauthorised')

  const data = resubmitWorkerSchema.parse(input)
  const employee = await getCurrentEmployee(session.user.id)

  const worker = await db.query.workers.findFirst({
    where: and(eq(workers.id, workerId), eq(workers.submittedBy, employee.id)),
  })
  if (!worker) throw new Error('Worker not found or not your submission')
  if (worker.status !== 'rejected') throw new Error('Only rejected workers can be resubmitted')

  if (data.phone && data.phone !== worker.phone) await assertPhoneUnique(data.phone, workerId)

  let aadhaarEncrypted = worker.aadhaarEncrypted
  let aadhaarLastFour = worker.aadhaarLastFour

  if (data.aadhaar) {
    aadhaarEncrypted = encryptAadhaar(data.aadhaar)
    aadhaarLastFour = extractLastFour(data.aadhaar)
  }

  await reconcileWorkerPhoto(worker.photoCloudinaryPublicId, data.photoPublicId ?? null)

  await db
    .update(workers)
    .set({
      cityId: data.cityId,
      name: data.name,
      dateOfBirth: data.dateOfBirth ?? null,
      phone: data.phone ?? null,
      emergencyContact: data.emergencyContact ?? null,
      category: data.category,
      wageDaily: data.wageDaily,
      otRate2hr: data.otRate2hr ?? null,
      otRate4hr: data.otRate4hr ?? null,
      otRate6hr: data.otRate6hr ?? null,
      // Bank details are admin-only — never written from a supervisor resubmit.
      photoCloudinaryPublicId: data.photoPublicId ?? null,
      photoCloudinaryUrl: data.photoUrl ?? null,
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

// ─── Update Worker (Admin) ────────────────────────────────────────────────────

const updateWorkerSchema = workerSchema.extend({
  aadhaar: z.string().length(12).regex(/^\d{12}$/).refine(validateAadhaar, {
    message: 'Aadhaar number failed checksum validation',
  }).optional(),
})

export async function updateWorker(workerId: string, input: z.infer<typeof updateWorkerSchema>) {
  await requireAdmin()
  const data = updateWorkerSchema.parse(input)

  const worker = await db.query.workers.findFirst({ where: eq(workers.id, workerId) })
  if (!worker) throw new Error('Worker not found')

  const city = await db.query.cities.findFirst({ where: eq(cities.id, data.cityId) })
  if (!city) throw new Error('City not found')
  if (city.status === 'inactive') throw new Error('Cannot assign worker to an inactive city')

  if (data.phone && data.phone !== worker.phone) await assertPhoneUnique(data.phone, workerId)

  let aadhaarEncrypted = worker.aadhaarEncrypted
  let aadhaarLastFour = worker.aadhaarLastFour

  if (data.aadhaar) {
    aadhaarEncrypted = encryptAadhaar(data.aadhaar)
    aadhaarLastFour = extractLastFour(data.aadhaar)
  }

  await reconcileWorkerPhoto(worker.photoCloudinaryPublicId, data.photoPublicId ?? null)

  await db
    .update(workers)
    .set({
      cityId: data.cityId,
      name: data.name,
      dateOfBirth: data.dateOfBirth ?? null,
      phone: data.phone ?? null,
      emergencyContact: data.emergencyContact ?? null,
      category: data.category,
      wageDaily: data.wageDaily,
      otRate2hr: data.otRate2hr ?? null,
      otRate4hr: data.otRate4hr ?? null,
      otRate6hr: data.otRate6hr ?? null,
      accountNumber: data.accountNumber ?? null,
      ifscCode: data.ifscCode ?? null,
      photoCloudinaryPublicId: data.photoPublicId ?? null,
      photoCloudinaryUrl: data.photoUrl ?? null,
      aadhaarEncrypted,
      aadhaarLastFour,
      updatedAt: new Date(),
    })
    .where(eq(workers.id, workerId))

  revalidatePath('/admin/workers')
}

// ─── Archive / Restore Worker (Admin) ─────────────────────────────────────────
// Archiving is a soft delete: the worker is hidden from active lists, attendance
// marking and supervisor views (all of which filter status='active'), but every
// record is preserved and the action is reversible via restoreWorker.

export async function archiveWorker(workerId: string) {
  await requireAdmin()

  const worker = await db.query.workers.findFirst({ where: eq(workers.id, workerId) })
  if (!worker) throw new Error('Worker not found')
  if (worker.status === 'archived') throw new Error('Worker is already archived')

  await db
    .update(workers)
    .set({ status: 'archived', updatedAt: new Date() })
    .where(eq(workers.id, workerId))

  revalidatePath('/admin/workers')
}

export async function restoreWorker(workerId: string) {
  await requireAdmin()

  const worker = await db.query.workers.findFirst({ where: eq(workers.id, workerId) })
  if (!worker) throw new Error('Worker not found')
  if (worker.status !== 'archived') throw new Error('Worker is not archived')

  await db
    .update(workers)
    .set({ status: 'active', updatedAt: new Date() })
    .where(eq(workers.id, workerId))

  revalidatePath('/admin/workers')
}

// ─── Delete Worker (Admin, permanent cascade) ─────────────────────────────────
// Permanently removes the worker AND all their attendance records (attendance
// references workers.id without an onDelete cascade, so it is deleted manually).
// Workers WITH attendance must be archived first — this prevents wiping payroll
// history by accident. Workers with no attendance can be deleted directly.

export async function deleteWorker(workerId: string) {
  await requireAdmin()

  const worker = await db.query.workers.findFirst({ where: eq(workers.id, workerId) })
  if (!worker) throw new Error('Worker not found')

  const hasAttendance = await db.query.attendance.findFirst({
    where: eq(attendance.workerId, workerId),
  })
  if (hasAttendance && worker.status !== 'archived') {
    throw new Error('Archive this worker before permanently deleting — they have attendance records')
  }

  // Remove non-cascading attendance rows first, then the worker.
  await db.delete(attendance).where(eq(attendance.workerId, workerId))
  await db.delete(workers).where(eq(workers.id, workerId))
  await deleteImage(worker.photoCloudinaryPublicId)
  revalidatePath('/admin/workers')
}

// ─── Reveal Aadhaar (Admin Only) ──────────────────────────────────────────────

export async function revealAadhaar(workerId: string): Promise<string> {
  const session = await requireAdmin()

  const worker = await db.query.workers.findFirst({ where: eq(workers.id, workerId) })
  if (!worker) throw new Error('Worker not found')
  if (!worker.aadhaarEncrypted) throw new Error('No Aadhaar on record')

  const decrypted = decryptAadhaar(worker.aadhaarEncrypted)

  const existingLogs = (worker.aadhaarRevealLogs as { revealedBy: string; revealedByName: string; revealedAt: string }[]) ?? []
  const newLog = { revealedBy: session.user.id, revealedByName: session.user.name, revealedAt: new Date().toISOString() }

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

  await db.update(workers).set({ cityId: newCityId, updatedAt: new Date() }).where(eq(workers.id, workerId))
  revalidatePath('/admin/workers')
}
