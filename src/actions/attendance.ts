'use server'

import { db } from '@/db'
import {
  attendance,
  workers,
  employees,
  sites,
  siteSupervisorAssignments,
} from '@/db/schema'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { eq, and, inArray } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { todayIST, classifyDate, derivedStatus } from '@/lib/attendance'

// ─── Auth guards ──────────────────────────────────────────────────────────────

async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session || session.user.role !== 'admin') throw new Error('Unauthorised')
  return session
}

async function requireSupervisor() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session || session.user.role !== 'supervisor') throw new Error('Unauthorised')
  return session
}

async function requireAuth() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) throw new Error('Unauthorised')
  return session
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getCurrentEmployee(userId: string) {
  const employee = await db.query.employees.findFirst({
    where: eq(employees.userId, userId),
  })
  if (!employee) throw new Error('Employee record not found')
  return employee
}

async function getSupervisorSiteIds(employeeId: string): Promise<string[]> {
  const assignments = await db.query.siteSupervisorAssignments.findMany({
    where: eq(siteSupervisorAssignments.employeeId, employeeId),
  })
  return assignments.map((a) => a.siteId)
}

// ─── Get workers for attendance marking ───────────────────────────────────────

export async function getWorkersForAttendance(siteId: string, date: string) {
  const session = await requireAuth()
  const employee = await getCurrentEmployee(session.user.id)

  if (session.user.role === 'supervisor') {
    const siteIds = await getSupervisorSiteIds(employee.id)
    if (!siteIds.includes(siteId)) throw new Error('Not assigned to this site')
  }

  const site = await db.query.sites.findFirst({
    where: eq(sites.id, siteId),
    with: { city: true },
  })
  if (!site) throw new Error('Site not found')
  if (site.status === 'inactive') throw new Error('Site is inactive')

  const cityWorkers = await db.query.workers.findMany({
    where: and(eq(workers.cityId, site.cityId), eq(workers.status, 'active')),
  })

  const allSitesInCity = await db.query.sites.findMany({
    where: eq(sites.cityId, site.cityId),
  })
  const allSiteIds = allSitesInCity.map((s) => s.id)

  const existingAttendance =
    allSiteIds.length > 0
      ? await db.query.attendance.findMany({
          where: and(inArray(attendance.siteId, allSiteIds), eq(attendance.date, date)),
        })
      : []

  const thisSiteAttendance = existingAttendance.filter((a) => a.siteId === siteId)

  return {
    site,
    workers: cityWorkers.map(({ aadhaarEncrypted: _aes, ...w }) => w),
    thisSiteAttendance,
    allCityAttendance: existingAttendance,
  }
}

// ─── Mark Morning Attendance ──────────────────────────────────────────────────

const markMorningSchema = z.object({
  siteId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  presentWorkerIds: z.array(z.string().uuid()),
})

export async function markMorningAttendance(input: z.infer<typeof markMorningSchema>) {
  const session = await requireSupervisor()
  const employee = await getCurrentEmployee(session.user.id)
  const data = markMorningSchema.parse(input)

  const siteIds = await getSupervisorSiteIds(employee.id)
  if (!siteIds.includes(data.siteId)) throw new Error('Not assigned to this site')

  const dateContext = classifyDate(data.date)
  if (dateContext === 'too_old') throw new Error('Date is too far in the past')
  if (dateContext === 'edit_request') {
    throw new Error('Use submitAttendanceEditRequest for dates older than 1 day')
  }

  const site = await db.query.sites.findFirst({ where: eq(sites.id, data.siteId) })
  if (!site) throw new Error('Site not found')
  if (site.status === 'inactive') throw new Error('Site is inactive')

  const now = new Date()

  for (const workerId of data.presentWorkerIds) {
    const worker = await db.query.workers.findFirst({ where: eq(workers.id, workerId) })
    if (!worker || worker.status !== 'active') continue

    const existing = await db.query.attendance.findFirst({
      where: and(
        eq(attendance.workerId, workerId),
        eq(attendance.siteId, data.siteId),
        eq(attendance.date, data.date)
      ),
    })

    if (existing) {
      await db
        .update(attendance)
        .set({
          morningMarkedAt: now,
          morningMarkedBy: employee.id,
          derivedStatus: derivedStatus(now, existing.eveningMarkedAt),
          isEdited: dateContext === 'yesterday' ? true : existing.isEdited,
          updatedAt: now,
        })
        .where(eq(attendance.id, existing.id))
    } else {
      await db.insert(attendance).values({
        siteId: data.siteId,
        workerId,
        cityId: site.cityId,
        date: data.date,
        morningMarkedAt: now,
        morningMarkedBy: employee.id,
        wageDailySnapshot: worker.wageDaily,
        otRateSnapshot: worker.otRate2hr ?? null,
        derivedStatus: 'half',
        isEdited: dateContext === 'yesterday',
      })
    }
  }

  revalidatePath('/supervisor/attendance')
  revalidatePath('/admin/attendance')
}

// ─── Mark Evening Attendance ──────────────────────────────────────────────────

const markEveningSchema = z.object({
  siteId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  presentWorkerIds: z.array(z.string().uuid()),
  otMap: z.record(z.string().uuid(), z.enum(['none', '2hr', '4hr'])).optional(),
})

export async function markEveningAttendance(input: z.infer<typeof markEveningSchema>) {
  const session = await requireSupervisor()
  const employee = await getCurrentEmployee(session.user.id)
  const data = markEveningSchema.parse(input)

  const siteIds = await getSupervisorSiteIds(employee.id)
  if (!siteIds.includes(data.siteId)) throw new Error('Not assigned to this site')

  const dateContext = classifyDate(data.date)
  if (dateContext === 'too_old') throw new Error('Date is too far in the past')
  if (dateContext === 'edit_request') {
    throw new Error('Use submitAttendanceEditRequest for dates older than 1 day')
  }

  const site = await db.query.sites.findFirst({ where: eq(sites.id, data.siteId) })
  if (!site) throw new Error('Site not found')
  if (site.status === 'inactive') throw new Error('Site is inactive')

  const now = new Date()

  for (const workerId of data.presentWorkerIds) {
    const worker = await db.query.workers.findFirst({ where: eq(workers.id, workerId) })
    if (!worker || worker.status !== 'active') continue

    const ot = data.otMap?.[workerId] ?? 'none'

    const existing = await db.query.attendance.findFirst({
      where: and(
        eq(attendance.workerId, workerId),
        eq(attendance.siteId, data.siteId),
        eq(attendance.date, data.date)
      ),
    })

    if (existing) {
      const status = derivedStatus(existing.morningMarkedAt, now)
      const finalOt = status === 'full' ? ot : 'none'

      await db
        .update(attendance)
        .set({
          eveningMarkedAt: now,
          eveningMarkedBy: employee.id,
          ot: finalOt,
          derivedStatus: status,
          isEdited: dateContext === 'yesterday' ? true : existing.isEdited,
          updatedAt: now,
        })
        .where(eq(attendance.id, existing.id))
    } else {
      await db.insert(attendance).values({
        siteId: data.siteId,
        workerId,
        cityId: site.cityId,
        date: data.date,
        eveningMarkedAt: now,
        eveningMarkedBy: employee.id,
        wageDailySnapshot: worker.wageDaily,
        otRateSnapshot: worker.otRate2hr ?? null,
        derivedStatus: 'half',
        isEdited: dateContext === 'yesterday',
      })
    }
  }

  revalidatePath('/supervisor/attendance')
  revalidatePath('/admin/attendance')
}

// ─── Submit Edit Request (2+ days back) ───────────────────────────────────────

const editRequestSchema = z.object({
  attendanceId: z.string().uuid(),
  proposedMorningPresent: z.boolean(),
  proposedEveningPresent: z.boolean(),
  proposedOt: z.enum(['none', '2hr', '4hr']),
  reason: z.string().min(1).max(500),
})

export async function submitAttendanceEditRequest(input: z.infer<typeof editRequestSchema>) {
  const session = await requireSupervisor()
  const employee = await getCurrentEmployee(session.user.id)
  const data = editRequestSchema.parse(input)

  const row = await db.query.attendance.findFirst({
    where: eq(attendance.id, data.attendanceId),
  })
  if (!row) throw new Error('Attendance record not found')
  if (row.isLocked) throw new Error('Attendance is locked — payroll has been finalized')

  const dateContext = classifyDate(row.date)
  if (dateContext === 'today' || dateContext === 'yesterday') {
    throw new Error('Use direct edit for today or yesterday')
  }
  if (dateContext === 'too_old') throw new Error('Date is too far in the past to edit')

  const siteIds = await getSupervisorSiteIds(employee.id)
  if (!siteIds.includes(row.siteId)) throw new Error('Not assigned to this site')

  if (row.editRequestStatus === 'pending') {
    throw new Error('An edit request is already pending for this record')
  }

  await db
    .update(attendance)
    .set({
      editRequest: {
        proposedMorningPresent: data.proposedMorningPresent,
        proposedEveningPresent: data.proposedEveningPresent,
        proposedOt: data.proposedOt,
        reason: data.reason,
        submittedBy: employee.id,
        submittedByName: employee.name,
        submittedAt: new Date().toISOString(),
      },
      editRequestStatus: 'pending',
      updatedAt: new Date(),
    })
    .where(eq(attendance.id, data.attendanceId))

  revalidatePath('/admin/attendance')
}

// ─── Resolve Edit Request (Admin) ─────────────────────────────────────────────

export async function resolveAttendanceEditRequest(
  attendanceId: string,
  decision: 'approved' | 'rejected'
) {
  await requireAdmin()

  const row = await db.query.attendance.findFirst({
    where: eq(attendance.id, attendanceId),
  })
  if (!row) throw new Error('Attendance record not found')
  if (row.editRequestStatus !== 'pending') throw new Error('No pending edit request')

  const editRequest = row.editRequest as {
    proposedMorningPresent: boolean
    proposedEveningPresent: boolean
    proposedOt: 'none' | '2hr' | '4hr'
  }

  if (decision === 'approved') {
    const now = new Date()
    const morningAt = editRequest.proposedMorningPresent ? now : null
    const eveningAt = editRequest.proposedEveningPresent ? now : null
    const status = derivedStatus(morningAt, eveningAt)
    const finalOt = status === 'full' ? editRequest.proposedOt : 'none'

    await db
      .update(attendance)
      .set({
        morningMarkedAt: morningAt,
        eveningMarkedAt: eveningAt,
        ot: finalOt,
        derivedStatus: status,
        editRequestStatus: 'approved',
        isEdited: true,
        updatedAt: now,
      })
      .where(eq(attendance.id, attendanceId))
  } else {
    await db
      .update(attendance)
      .set({
        editRequestStatus: 'rejected',
        updatedAt: new Date(),
      })
      .where(eq(attendance.id, attendanceId))
  }

  revalidatePath('/admin/attendance')
}

// ─── Admin Direct Edit ────────────────────────────────────────────────────────

const adminEditSchema = z.object({
  attendanceId: z.string().uuid(),
  morningPresent: z.boolean(),
  eveningPresent: z.boolean(),
  ot: z.enum(['none', '2hr', '4hr']),
})

export async function adminEditAttendance(input: z.infer<typeof adminEditSchema>) {
  await requireAdmin()
  const data = adminEditSchema.parse(input)

  const row = await db.query.attendance.findFirst({
    where: eq(attendance.id, data.attendanceId),
  })
  if (!row) throw new Error('Attendance record not found')
  if (row.isLocked) throw new Error('Attendance is locked — payroll has been finalized')

  const now = new Date()
  const morningAt = data.morningPresent ? (row.morningMarkedAt ?? now) : null
  const eveningAt = data.eveningPresent ? (row.eveningMarkedAt ?? now) : null
  const status = derivedStatus(morningAt, eveningAt)
  const finalOt = status === 'full' ? data.ot : 'none'

  await db
    .update(attendance)
    .set({
      morningMarkedAt: morningAt,
      eveningMarkedAt: eveningAt,
      ot: finalOt,
      derivedStatus: status,
      isEdited: true,
      updatedAt: now,
    })
    .where(eq(attendance.id, data.attendanceId))

  revalidatePath('/admin/attendance')
}

// ─── Get Attendance for Admin ─────────────────────────────────────────────────

export async function getAttendanceForAdmin(filters: {
  siteId?: string
  date?: string
  workerId?: string
}) {
  await requireAdmin()

  const conditions = []
  if (filters.siteId) conditions.push(eq(attendance.siteId, filters.siteId))
  if (filters.date) conditions.push(eq(attendance.date, filters.date))
  if (filters.workerId) conditions.push(eq(attendance.workerId, filters.workerId))

  return db.query.attendance.findMany({
    where: conditions.length > 0 ? and(...conditions) : undefined,
    with: {
      worker: true,
      site: { with: { city: true } },
      morningMarkedByEmployee: true,
      eveningMarkedByEmployee: true,
    },
    orderBy: (a, { desc }) => [desc(a.date)],
  })
}

// ─── Get Attendance for Supervisor ───────────────────────────────────────────

export async function getAttendanceForSupervisor(siteId: string, date: string) {
  const session = await requireSupervisor()
  const employee = await getCurrentEmployee(session.user.id)

  const siteIds = await getSupervisorSiteIds(employee.id)
  if (!siteIds.includes(siteId)) throw new Error('Not assigned to this site')

  return db.query.attendance.findMany({
    where: and(eq(attendance.siteId, siteId), eq(attendance.date, date)),
    with: { worker: true },
  })
}

// ─── Get Pending Edit Requests (Admin) ───────────────────────────────────────

export async function getPendingEditRequests() {
  await requireAdmin()

  return db.query.attendance.findMany({
    where: eq(attendance.editRequestStatus, 'pending'),
    with: {
      worker: true,
      site: { with: { city: true } },
    },
    orderBy: (a, { asc }) => [asc(a.date)],
  })
}

// ─── Today's date for default ─────────────────────────────────────────────────

export { todayIST }
