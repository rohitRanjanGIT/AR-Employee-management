'use server'

import { db } from '@/db'
import {
  advances,
  attendance,
  payrollSnapshots,
  workers,
  employees,
  siteSupervisorAssignments,
} from '@/db/schema'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { and, eq, inArray } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getOutstandingBalance } from '@/lib/advances'
import { computeRowWage, formatYearMonth, toYearMonth } from '@/lib/payroll'

// ─── Auth guards ────────────────────────────────────────────────────────────

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

async function getCurrentEmployee(userId: string) {
  const employee = await db.query.employees.findFirst({ where: eq(employees.userId, userId) })
  if (!employee) throw new Error('Employee record not found')
  return employee
}

// Cities a supervisor may act in (derived from their current site assignments).
async function getSupervisorCityIds(employeeId: string): Promise<string[]> {
  const assignments = await db.query.siteSupervisorAssignments.findMany({
    where: eq(siteSupervisorAssignments.employeeId, employeeId),
    with: { site: true },
  })
  return [...new Set(assignments.map((a) => a.site.cityId))]
}

// Batch outstanding balances for a set of workers (one ledger read, reduced in JS).
async function batchOutstanding(workerIds: string[]): Promise<Map<string, number>> {
  const result = new Map<string, number>()
  if (workerIds.length === 0) return result
  const rows = await db
    .select({
      workerId: advances.workerId,
      type: advances.type,
      status: advances.status,
      amount: advances.amount,
    })
    .from(advances)
    .where(inArray(advances.workerId, workerIds))

  for (const id of workerIds) result.set(id, 0)
  for (const r of rows) {
    const cur = result.get(r.workerId) ?? 0
    if (r.type === 'issuance' && r.status === 'approved') result.set(r.workerId, cur + Number(r.amount))
    else if (r.type === 'recovery') result.set(r.workerId, cur - Number(r.amount))
  }
  return result
}

// Batch approved-issuance totals (lifetime "advance taken") per worker.
async function batchApprovedIssuance(workerIds: string[]): Promise<Map<string, number>> {
  const result = new Map<string, number>()
  if (workerIds.length === 0) return result
  for (const id of workerIds) result.set(id, 0)
  const rows = await db
    .select({ workerId: advances.workerId, type: advances.type, status: advances.status, amount: advances.amount })
    .from(advances)
    .where(inArray(advances.workerId, workerIds))
  for (const r of rows) {
    if (r.type === 'issuance' && r.status === 'approved') {
      result.set(r.workerId, (result.get(r.workerId) ?? 0) + Number(r.amount))
    }
  }
  return result
}

// Batch lifetime earned wage per worker. Mirrors getWorkerStatement's earned
// logic (finalized snapshot total overrides live attendance per site-month).
async function batchEarned(workerIds: string[]): Promise<Map<string, number>> {
  const result = new Map<string, number>()
  if (workerIds.length === 0) return result
  for (const id of workerIds) result.set(id, 0)

  const attRows = await db.query.attendance.findMany({
    where: inArray(attendance.workerId, workerIds),
  })
  const liveByKey = new Map<string, number>() // workerId:siteId:ym
  for (const r of attRows) {
    const key = `${r.workerId}:${r.siteId}:${toYearMonth(r.date)}`
    const wage = computeRowWage({
      derivedStatus: r.derivedStatus as 'full' | 'half',
      wageDailySnapshot: Number(r.wageDailySnapshot),
      otRateSnapshot: r.otRateSnapshot ? Number(r.otRateSnapshot) : null,
      ot: r.ot as 'none' | '2hr' | '4hr',
    })
    liveByKey.set(key, (liveByKey.get(key) ?? 0) + wage)
  }

  const snaps = await db.query.payrollSnapshots.findMany({
    where: inArray(payrollSnapshots.workerId, workerIds),
  })
  const originals = snaps.filter((s) => !s.isCorrection)
  const corrections = snaps.filter((s) => s.isCorrection)
  const finalizedByKey = new Map<string, number>()
  for (const o of originals) {
    const corrTotal = corrections
      .filter((c) => c.correctionOf === o.id)
      .reduce((sum, c) => sum + Number(c.finalWage), 0)
    finalizedByKey.set(`${o.workerId}:${o.siteId}:${o.yearMonth}`, Number(o.finalWage) + corrTotal)
  }

  const keys = new Set([...liveByKey.keys(), ...finalizedByKey.keys()])
  for (const key of keys) {
    const workerId = key.split(':')[0]
    const earned = finalizedByKey.get(key) ?? liveByKey.get(key) ?? 0
    result.set(workerId, (result.get(workerId) ?? 0) + earned)
  }
  return result
}

// ─── Balances overview (admin + supervisor-scoped) ────────────────────────────
// Per-worker Total Earned / Advance Taken / Balance (= earned − advance, ±) —
// the lifetime figures backing the dedicated /balance pages. Matches the
// all-time numbers shown on the per-worker statement.

export type WorkerBalanceRow = {
  id: string
  name: string
  cityId: string
  cityName: string
  totalEarned: number
  totalAdvance: number
  balance: number
}

export async function getWorkerBalanceOverview(): Promise<WorkerBalanceRow[]> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) throw new Error('Unauthorised')

  let workerRows
  if (session.user.role === 'admin') {
    workerRows = await db.query.workers.findMany({
      where: eq(workers.status, 'active'),
      with: { city: true },
      orderBy: (w, { asc }) => [asc(w.name)],
    })
  } else if (session.user.role === 'supervisor') {
    const employee = await getCurrentEmployee(session.user.id)
    const cityIds = await getSupervisorCityIds(employee.id)
    if (cityIds.length === 0) return []
    workerRows = await db.query.workers.findMany({
      where: and(inArray(workers.cityId, cityIds), eq(workers.status, 'active')),
      with: { city: true },
      orderBy: (w, { asc }) => [asc(w.name)],
    })
  } else {
    throw new Error('Unauthorised')
  }

  const ids = workerRows.map((w) => w.id)
  const [earned, advance] = await Promise.all([batchEarned(ids), batchApprovedIssuance(ids)])

  return workerRows.map((w) => {
    const totalEarned = earned.get(w.id) ?? 0
    const totalAdvance = advance.get(w.id) ?? 0
    return {
      id: w.id,
      name: w.name,
      cityId: w.cityId,
      cityName: w.city?.name ?? '—',
      totalEarned,
      totalAdvance,
      balance: totalEarned - totalAdvance,
    }
  })
}

// ─── Supervisor: submit an advance request ────────────────────────────────────

const submitSchema = z.object({
  workerId: z.string().uuid(),
  amount: z.coerce.number().int('Amount must be whole rupees').positive('Amount must be greater than 0'),
  reason: z.string().min(1, 'Reason is required').max(500),
})

export async function submitAdvanceRequest(input: z.infer<typeof submitSchema>) {
  const session = await requireSupervisor()
  const data = submitSchema.parse(input)
  const employee = await getCurrentEmployee(session.user.id)
  const cityIds = await getSupervisorCityIds(employee.id)

  const worker = await db.query.workers.findFirst({ where: eq(workers.id, data.workerId) })
  if (!worker || worker.status !== 'active' || !cityIds.includes(worker.cityId)) {
    throw new Error('Worker is not in your accessible scope')
  }

  await db.insert(advances).values({
    workerId: data.workerId,
    type: 'issuance',
    amount: data.amount.toFixed(2),
    reason: data.reason,
    status: 'pending',
    createdBy: session.user.id,
  })

  revalidatePath('/supervisor/advances')
  revalidatePath('/admin/advances')
}

// ─── Supervisor: own requests ─────────────────────────────────────────────────

export async function getMyAdvanceRequests() {
  const session = await requireSupervisor()

  const rows = await db.query.advances.findMany({
    where: and(eq(advances.createdBy, session.user.id), eq(advances.type, 'issuance')),
    with: { worker: { columns: { id: true, name: true } } },
    orderBy: (a, { desc }) => [desc(a.createdAt)],
  })

  return rows.map((r) => ({
    id: r.id,
    workerName: r.worker?.name ?? '—',
    amount: Number(r.amount),
    reason: r.reason,
    status: r.status,
    rejectionReason: r.rejectionReason,
    createdAt: r.createdAt.toISOString(),
  }))
}

// ─── Admin: pending queue ─────────────────────────────────────────────────────

export async function getPendingAdvances() {
  await requireAdmin()

  const rows = await db.query.advances.findMany({
    where: and(eq(advances.type, 'issuance'), eq(advances.status, 'pending')),
    with: {
      worker: { columns: { id: true, name: true } },
      createdByUser: { columns: { id: true, name: true } },
    },
    orderBy: (a, { asc }) => [asc(a.createdAt)],
  })

  const balances = await batchOutstanding([...new Set(rows.map((r) => r.workerId))])

  return rows.map((r) => ({
    id: r.id,
    workerId: r.workerId,
    workerName: r.worker?.name ?? '—',
    amount: Number(r.amount),
    reason: r.reason,
    requestedBy: r.createdByUser?.name ?? '—',
    createdAt: r.createdAt.toISOString(),
    outstanding: balances.get(r.workerId) ?? 0,
  }))
}

// ─── Admin: approve (with optional edit) ──────────────────────────────────────

const approveSchema = z.object({
  advanceId: z.string().uuid(),
  amount: z.coerce.number().int().positive().optional(), // edit-approve
  reason: z.string().min(1).max(500).optional(),
})

export async function approveAdvance(input: z.infer<typeof approveSchema>) {
  const session = await requireAdmin()
  const data = approveSchema.parse(input)

  const adv = await db.query.advances.findFirst({ where: eq(advances.id, data.advanceId) })
  if (!adv || adv.type !== 'issuance' || adv.status !== 'pending') {
    throw new Error('Advance is not a pending request')
  }

  await db
    .update(advances)
    .set({
      status: 'approved',
      amount: data.amount !== undefined ? data.amount.toFixed(2) : adv.amount,
      reason: data.reason !== undefined ? data.reason : adv.reason,
      approvedBy: session.user.id,
      approvedAt: new Date(),
    })
    .where(eq(advances.id, data.advanceId))

  revalidatePath('/admin/advances')
  revalidatePath('/supervisor/advances')
}

// ─── Admin: reject ────────────────────────────────────────────────────────────

const rejectSchema = z.object({
  advanceId: z.string().uuid(),
  rejectionReason: z.string().min(1, 'Rejection reason is required').max(500),
})

export async function rejectAdvance(input: z.infer<typeof rejectSchema>) {
  const session = await requireAdmin()
  const data = rejectSchema.parse(input)

  const adv = await db.query.advances.findFirst({ where: eq(advances.id, data.advanceId) })
  if (!adv || adv.type !== 'issuance' || adv.status !== 'pending') {
    throw new Error('Advance is not a pending request')
  }

  await db
    .update(advances)
    .set({
      status: 'rejected',
      rejectionReason: data.rejectionReason,
      approvedBy: session.user.id,
      approvedAt: new Date(),
    })
    .where(eq(advances.id, data.advanceId))

  revalidatePath('/admin/advances')
  revalidatePath('/supervisor/advances')
}

// ─── Admin: direct entry (no request) ─────────────────────────────────────────

const directSchema = z.object({
  workerId: z.string().uuid(),
  amount: z.coerce.number().int('Amount must be whole rupees').positive('Amount must be greater than 0'),
  reason: z.string().min(1, 'Reason is required').max(500),
})

export async function createAdvanceDirect(input: z.infer<typeof directSchema>) {
  const session = await requireAdmin()
  const data = directSchema.parse(input)

  const worker = await db.query.workers.findFirst({ where: eq(workers.id, data.workerId) })
  if (!worker || worker.status !== 'active') throw new Error('Worker not found or not active')

  const now = new Date()
  await db.insert(advances).values({
    workerId: data.workerId,
    type: 'issuance',
    amount: data.amount.toFixed(2),
    reason: data.reason,
    status: 'approved',
    createdBy: session.user.id,
    approvedBy: session.user.id,
    approvedAt: now,
  })

  revalidatePath('/admin/advances')
}

// ─── Admin: active workers + outstanding (direct-entry picker + balances) ──────

export async function getActiveWorkerBalances() {
  await requireAdmin()

  const rows = await db.query.workers.findMany({
    where: eq(workers.status, 'active'),
    with: { city: true },
    orderBy: (w, { asc }) => [asc(w.name)],
  })
  const balances = await batchOutstanding(rows.map((w) => w.id))

  return rows.map((w) => ({
    id: w.id,
    name: w.name,
    cityName: w.city?.name ?? '—',
    outstanding: balances.get(w.id) ?? 0,
  }))
}

// ─── Admin: full ledger (history) ─────────────────────────────────────────────

export async function getAdvancesLedger() {
  await requireAdmin()

  const rows = await db.query.advances.findMany({
    with: {
      worker: { columns: { id: true, name: true } },
      createdByUser: { columns: { id: true, name: true } },
      approvedByUser: { columns: { id: true, name: true } },
    },
    orderBy: (a, { desc }) => [desc(a.createdAt)],
  })

  return rows.map((r) => ({
    id: r.id,
    workerId: r.workerId,
    workerName: r.worker?.name ?? '—',
    type: r.type,
    amount: Number(r.amount),
    reason: r.reason,
    status: r.status,
    rejectionReason: r.rejectionReason,
    createdBy: r.createdByUser?.name ?? '—',
    approvedBy: r.approvedByUser?.name ?? null,
    createdAt: r.createdAt.toISOString(),
    isRecovery: r.type === 'recovery',
  }))
}

// ─── Admin: single worker outstanding (used where a precise value is needed) ──

export async function getWorkerOutstanding(workerId: string): Promise<number> {
  await requireAdmin()
  return getOutstandingBalance(workerId)
}

// ─── Supervisor: scoped worker balances (Balances tab) ────────────────────────

export async function getSupervisorWorkerBalances() {
  const session = await requireSupervisor()
  const employee = await getCurrentEmployee(session.user.id)
  const cityIds = await getSupervisorCityIds(employee.id)
  if (cityIds.length === 0) return []

  const rows = await db.query.workers.findMany({
    where: and(inArray(workers.cityId, cityIds), eq(workers.status, 'active')),
    with: { city: true },
    orderBy: (w, { asc }) => [asc(w.name)],
  })
  const balances = await batchOutstanding(rows.map((w) => w.id))

  return rows.map((w) => ({
    id: w.id,
    name: w.name,
    cityName: w.city?.name ?? '—',
    outstanding: balances.get(w.id) ?? 0,
  }))
}

// ─── Worker statement (admin + supervisor) ────────────────────────────────────
// Per-worker earned vs advance-taken vs running due, with a month filter
// (default current; All-time = no yearMonth). Earned merges finalized snapshot
// totals (where a site-month is finalized) over the live attendance computation.

export type WorkerStatementLine = {
  id: string
  date: string // ISO
  type: 'issuance' | 'recovery'
  amount: number
  reason: string | null
  status: 'pending' | 'approved' | 'rejected'
  recoveredAgainst: string | null
}

export type WorkerStatement = {
  workerId: string
  workerName: string
  workerCategory: string
  cityName: string
  months: { value: string; label: string }[]
  selectedMonth: string | null // null = all-time
  earned: number // selected period
  advanceTaken: number // selected period (approved issuance)
  due: number // cumulative running through selected month (or lifetime)
  lineItems: WorkerStatementLine[]
}

function ymOf(d: Date): string {
  return d.toISOString().slice(0, 7) // 'YYYY-MM' (UTC)
}

export async function getWorkerStatement(
  workerId: string,
  yearMonth?: string
): Promise<WorkerStatement> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) throw new Error('Unauthorised')

  const worker = await db.query.workers.findFirst({
    where: eq(workers.id, workerId),
    with: { city: true },
  })
  if (!worker) throw new Error('Worker not found')

  if (session.user.role === 'supervisor') {
    const employee = await getCurrentEmployee(session.user.id)
    const cityIds = await getSupervisorCityIds(employee.id)
    if (!cityIds.includes(worker.cityId)) throw new Error('Worker is not in your accessible scope')
  } else if (session.user.role !== 'admin') {
    throw new Error('Unauthorised')
  }

  // ── Earned per month (finalized snapshot overrides live where present) ──────
  const attRows = await db.query.attendance.findMany({
    where: eq(attendance.workerId, workerId),
  })
  const liveBySiteMonth = new Map<string, number>()
  for (const r of attRows) {
    const key = `${r.siteId}:${toYearMonth(r.date)}`
    const wage = computeRowWage({
      derivedStatus: r.derivedStatus as 'full' | 'half',
      wageDailySnapshot: Number(r.wageDailySnapshot),
      otRateSnapshot: r.otRateSnapshot ? Number(r.otRateSnapshot) : null,
      ot: r.ot as 'none' | '2hr' | '4hr',
    })
    liveBySiteMonth.set(key, (liveBySiteMonth.get(key) ?? 0) + wage)
  }

  const snaps = await db.query.payrollSnapshots.findMany({
    where: eq(payrollSnapshots.workerId, workerId),
  })
  const originals = snaps.filter((s) => !s.isCorrection)
  const corrections = snaps.filter((s) => s.isCorrection)
  const finalizedBySiteMonth = new Map<string, number>()
  for (const o of originals) {
    const corrTotal = corrections
      .filter((c) => c.correctionOf === o.id)
      .reduce((sum, c) => sum + Number(c.finalWage), 0)
    finalizedBySiteMonth.set(`${o.siteId}:${o.yearMonth}`, Number(o.finalWage) + corrTotal)
  }

  const earnedByMonth = new Map<string, number>()
  const siteMonthKeys = new Set([...liveBySiteMonth.keys(), ...finalizedBySiteMonth.keys()])
  for (const key of siteMonthKeys) {
    const ym = key.split(':')[1]
    const earned = finalizedBySiteMonth.get(key) ?? liveBySiteMonth.get(key) ?? 0
    earnedByMonth.set(ym, (earnedByMonth.get(ym) ?? 0) + earned)
  }

  // ── Advances ledger ────────────────────────────────────────────────────────
  const advRows = await db.query.advances.findMany({
    where: eq(advances.workerId, workerId),
    with: {
      recoverySnapshot: { columns: { yearMonth: true, siteSnapshot: true } },
    },
    orderBy: (a, { desc }) => [desc(a.createdAt)],
  })

  const approvedIssuanceByMonth = new Map<string, number>()
  for (const r of advRows) {
    if (r.type === 'issuance' && r.status === 'approved') {
      const ym = ymOf(r.createdAt)
      approvedIssuanceByMonth.set(ym, (approvedIssuanceByMonth.get(ym) ?? 0) + Number(r.amount))
    }
  }

  // ── Month list (union of earnings + advance activity), newest first ─────────
  const monthSet = new Set<string>([...earnedByMonth.keys()])
  for (const r of advRows) monthSet.add(ymOf(r.createdAt))
  const months = [...monthSet]
    .sort((a, b) => b.localeCompare(a))
    .map((ym) => ({ value: ym, label: formatYearMonth(ym) }))

  // ── Selected period figures ─────────────────────────────────────────────────
  const isAllTime = !yearMonth
  const sumMap = (m: Map<string, number>, upto?: string) =>
    [...m.entries()].reduce((s, [ym, v]) => (upto ? (ym <= upto ? s + v : s) : s + v), 0)

  const totalEarned = sumMap(earnedByMonth)
  const totalAdvance = sumMap(approvedIssuanceByMonth)

  let earned: number
  let advanceTaken: number
  let due: number
  if (isAllTime) {
    earned = totalEarned
    advanceTaken = totalAdvance
    due = totalEarned - totalAdvance
  } else {
    earned = earnedByMonth.get(yearMonth) ?? 0
    advanceTaken = approvedIssuanceByMonth.get(yearMonth) ?? 0
    // cumulative running due through the end of the selected month
    due = sumMap(earnedByMonth, yearMonth) - sumMap(approvedIssuanceByMonth, yearMonth)
  }

  const lineItems: WorkerStatementLine[] = advRows
    .filter((r) => isAllTime || ymOf(r.createdAt) === yearMonth)
    .map((r) => {
      const snap = r.recoverySnapshot
      const code =
        snap && snap.siteSnapshot && typeof snap.siteSnapshot === 'object'
          ? ((snap.siteSnapshot as { code?: string }).code ?? '—')
          : '—'
      return {
        id: r.id,
        date: r.createdAt.toISOString(),
        type: r.type,
        amount: Number(r.amount),
        reason: r.reason,
        status: r.status,
        recoveredAgainst:
          r.type === 'recovery' && snap ? `${code} · ${formatYearMonth(snap.yearMonth)}` : null,
      }
    })

  return {
    workerId,
    workerName: worker.name,
    workerCategory: worker.category,
    cityName: worker.city?.name ?? '—',
    months,
    selectedMonth: isAllTime ? null : yearMonth!,
    earned,
    advanceTaken,
    due,
    lineItems,
  }
}
