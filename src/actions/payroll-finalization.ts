'use server'

import { db } from '@/db'
import { advances, attendance, payrollSnapshots, transactions, workers } from '@/db/schema'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { eq, and, gte, lte, inArray } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { computeMaxRecoverable, computeRowWage, getMonthBounds, toYearMonth } from '@/lib/payroll'
import {
  getOutstandingBalance,
  getOutstandingBalances,
  writeRecoveryRow,
} from '@/lib/advances'

// ─── Auth guard ───────────────────────────────────────────────────────────────

async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session || session.user.role !== 'admin') throw new Error('Unauthorised')
  return session
}

// Module 1.7 — pending issuance for any of the given workers (blocks finalization).
async function getPendingAdvanceWorkers(
  workerIds: string[]
): Promise<{ workerId: string; workerName: string }[]> {
  if (workerIds.length === 0) return []
  const rows = await db.query.advances.findMany({
    where: and(
      inArray(advances.workerId, workerIds),
      eq(advances.type, 'issuance'),
      eq(advances.status, 'pending')
    ),
    with: { worker: { columns: { id: true, name: true } } },
  })
  // De-dupe by worker (a worker may have several pending rows).
  const seen = new Map<string, string>()
  for (const r of rows) seen.set(r.workerId, r.worker?.name ?? '—')
  return [...seen.entries()].map(([workerId, workerName]) => ({ workerId, workerName }))
}

// ─── Check if a site-month is already finalized ───────────────────────────────

export async function isMonthFinalized(siteId: string, yearMonth: string): Promise<boolean> {
  await requireAdmin()

  const existing = await db.query.payrollSnapshots.findFirst({
    where: and(
      eq(payrollSnapshots.siteId, siteId),
      eq(payrollSnapshots.yearMonth, yearMonth),
      eq(payrollSnapshots.isCorrection, false)
    ),
  })
  return !!existing
}

// ─── Check earlier months for soft warning ────────────────────────────────────

export async function getUnfinalizedEarlierMonths(
  siteId: string,
  yearMonth: string
): Promise<string[]> {
  await requireAdmin()

  // Months (earlier than yearMonth) that have attendance for this site
  const rows = await db.query.attendance.findMany({
    where: eq(attendance.siteId, siteId),
  })

  const monthsWithData = new Set(
    rows.map((r) => toYearMonth(r.date)).filter((ym) => ym < yearMonth)
  )

  const finalized = await db.query.payrollSnapshots.findMany({
    where: and(eq(payrollSnapshots.siteId, siteId), eq(payrollSnapshots.isCorrection, false)),
  })
  const finalizedMonths = new Set(finalized.map((f) => f.yearMonth))

  return Array.from(monthsWithData)
    .filter((ym) => !finalizedMonths.has(ym))
    .sort()
}

// ─── Get finalization preview ─────────────────────────────────────────────────
// Same shape as 1.4's site overview, scoped to one month, plus per-worker
// adjustment fields (defaulted to 0/empty).

export async function getFinalizationPreview(siteId: string, yearMonth: string) {
  await requireAdmin()

  if (await isMonthFinalized(siteId, yearMonth)) {
    throw new Error('This month is already finalized. View the locked snapshot instead.')
  }

  const [year, month] = yearMonth.split('-').map(Number)
  const { start, end } = getMonthBounds(year, month)

  const rows = await db.query.attendance.findMany({
    where: and(
      eq(attendance.siteId, siteId),
      gte(attendance.date, start),
      lte(attendance.date, end)
    ),
    with: { worker: true, site: { with: { city: { with: { state: true } } } } },
  })

  if (rows.length === 0) {
    throw new Error('No attendance data for this site in this month')
  }

  const site = rows[0].site

  // Group by worker
  const workerGroups: Record<string, typeof rows> = {}
  for (const row of rows) {
    if (!workerGroups[row.workerId]) workerGroups[row.workerId] = []
    workerGroups[row.workerId].push(row)
  }

  const workerBreakdowns = Object.entries(workerGroups).map(([workerId, workerRows]) => {
    let fullDays = 0
    let halfDays = 0
    let otTwoHrCount = 0
    let otFourHrCount = 0
    let grossWage = 0
    let hasEditedRows = false

    for (const row of workerRows) {
      const wage = computeRowWage({
        derivedStatus: row.derivedStatus as 'full' | 'half',
        wageDailySnapshot: Number(row.wageDailySnapshot),
        otRateSnapshot: row.otRateSnapshot ? Number(row.otRateSnapshot) : null,
        ot: row.ot as 'none' | '2hr' | '4hr',
      })
      grossWage += wage
      if (row.derivedStatus === 'full') fullDays++
      else halfDays++
      if (row.ot === '2hr') otTwoHrCount++
      if (row.ot === '4hr') otFourHrCount++
      if (row.isEdited) hasEditedRows = true
    }

    return {
      workerId,
      workerName: workerRows[0].worker.name,
      workerCategory: workerRows[0].worker.category,
      fullDays,
      halfDays,
      otTwoHrCount,
      otFourHrCount,
      grossWage,
      hasEditedRows,
      // Adjustment fields — admin fills these in on the review page
      adjustmentAmount: 0,
      adjustmentReason: '',
    }
  })

  // Stable, predictable order (highest gross first)
  workerBreakdowns.sort((a, b) => b.grossWage - a.grossWage)

  // Module 1.7 — attach each worker's current outstanding advance balance, and
  // surface any pending advance requests (which block finalization, §5.2).
  const workerIds = workerBreakdowns.map((w) => w.workerId)
  const balances = await getOutstandingBalances(workerIds)
  const pendingAdvances = await getPendingAdvanceWorkers(workerIds)

  const workersWithOutstanding = workerBreakdowns.map((w) => ({
    ...w,
    outstanding: balances.get(w.workerId) ?? 0,
  }))

  return {
    siteId,
    siteName: site.name,
    siteCode: site.code,
    cityId: site.cityId,
    cityName: site.city.name,
    stateName: site.city.state?.name ?? '—',
    yearMonth,
    workers: workersWithOutstanding,
    totalGrossWage: workersWithOutstanding.reduce((s, w) => s + w.grossWage, 0),
    pendingAdvances,
  }
}

// ─── Finalize Payroll ──────────────────────────────────────────────────────────

const finalizePayrollSchema = z.object({
  siteId: z.string().uuid(),
  yearMonth: z.string().regex(/^\d{4}-\d{2}$/),
  adjustments: z.array(
    z.object({
      workerId: z.string().uuid(),
      adjustmentAmount: z.number(),
      adjustmentReason: z.string().optional(),
      // Module 1.7 — admin's chosen advance recovery for this worker (>= 0).
      // Server re-validates against fresh outstanding; cannot exceed max-recoverable.
      recovery: z.number().min(0).optional(),
    })
  ),
})

export async function finalizePayroll(input: z.infer<typeof finalizePayrollSchema>) {
  const session = await requireAdmin()
  const data = finalizePayrollSchema.parse(input)

  // Guard against double-finalization. The partial unique index is the real
  // backstop; this check produces a friendly error. (Neon HTTP has no
  // interactive transactions — finalization is an infrequent single-admin
  // action, so the small race window is acceptable, per the 1.5 spec.)
  if (await isMonthFinalized(data.siteId, data.yearMonth)) {
    throw new Error('This month is already finalized')
  }

  // Recompute the breakdown server-side — never trust client-sent totals.
  const preview = await getFinalizationPreview(data.siteId, data.yearMonth)

  // Module 1.7 (§5.2) — HARD GATE: no pending advance for any cycle worker.
  if (preview.pendingAdvances.length > 0) {
    const names = preview.pendingAdvances.map((p) => p.workerName).join(', ')
    throw new Error(
      `Cannot finalize: ${preview.pendingAdvances.length} pending advance request(s) for ` +
        `worker(s) in this cycle (${names}). Resolve them at /admin/advances first.`
    )
  }

  const [year, month] = data.yearMonth.split('-').map(Number)
  const { start, end } = getMonthBounds(year, month)

  const adjustmentMap = new Map(data.adjustments.map((a) => [a.workerId, a]))

  for (const workerBreakdown of preview.workers) {
    const adjustment = adjustmentMap.get(workerBreakdown.workerId)
    const adjustmentAmount = adjustment?.adjustmentAmount ?? 0
    const adjustmentReason = adjustment?.adjustmentReason || null

    if (adjustmentAmount !== 0 && !adjustmentReason) {
      throw new Error(`Adjustment reason required for worker ${workerBreakdown.workerName}`)
    }

    // Module 1.7 (§5.4) — finalization math, exact order.
    const adjustedWage = workerBreakdown.grossWage + adjustmentAmount
    if (adjustedWage < 0) {
      throw new Error(
        `Adjusted wage is negative for ${workerBreakdown.workerName} — reduce the negative ` +
          `adjustment before finalizing.`
      )
    }

    // §6 concurrency backstop: re-read the worker's FRESH outstanding right
    // before recovering (Neon HTTP has no row locks), then clamp recovery to it
    // (reduce-only) so a concurrent finalize for the same worker can never
    // over-recover. recovery ∈ [0, min(freshOutstanding, adjustedWage)].
    const freshOutstanding = await getOutstandingBalance(workerBreakdown.workerId)
    const maxRecoverable = computeMaxRecoverable(adjustedWage, freshOutstanding)
    const requestedRecovery = Math.max(0, adjustment?.recovery ?? 0)
    const recovery = Math.min(requestedRecovery, maxRecoverable)
    // Invariant: recovery can never push outstanding below zero.
    if (recovery > freshOutstanding) {
      throw new Error(`Recovery exceeds outstanding for ${workerBreakdown.workerName}`)
    }

    const netPaid = adjustedWage - recovery

    const worker = await db.query.workers.findFirst({
      where: eq(workers.id, workerBreakdown.workerId),
    })

    // 1. Insert snapshot (finalWage = adjusted wage; advanceRecovered discrete).
    const [snapshot] = await db
      .insert(payrollSnapshots)
      .values({
        siteId: data.siteId,
        workerId: workerBreakdown.workerId,
        yearMonth: data.yearMonth,
        siteSnapshot: {
          name: preview.siteName,
          code: preview.siteCode,
          cityName: preview.cityName,
          stateName: preview.stateName,
        },
        workerSnapshot: {
          name: workerBreakdown.workerName,
          category: workerBreakdown.workerCategory,
          cityName: worker?.cityId ? preview.cityName : '—',
        },
        fullDays: workerBreakdown.fullDays,
        halfDays: workerBreakdown.halfDays,
        otTwoHrCount: workerBreakdown.otTwoHrCount,
        otFourHrCount: workerBreakdown.otFourHrCount,
        grossWage: workerBreakdown.grossWage.toFixed(2),
        adjustmentAmount: adjustmentAmount.toFixed(2),
        adjustmentReason,
        finalWage: adjustedWage.toFixed(2),
        advanceRecovered: recovery.toFixed(2),
        isCorrection: false,
        hadPreFinalizationEdits: workerBreakdown.hasEditedRows,
        finalizedBy: session.user.id,
      })
      .returning()

    // 2. If recovery > 0, write the recovery row in the advances ledger.
    if (recovery > 0) {
      await writeRecoveryRow({
        workerId: workerBreakdown.workerId,
        amount: recovery,
        payrollSnapshotId: snapshot.id,
        createdBy: session.user.id,
      })
    }

    // 3. Write the ONE ledger transaction — amount = net_paid (never < 0).
    await db.insert(transactions).values({
      type: 'payroll_worker',
      referenceId: snapshot.id,
      workerId: workerBreakdown.workerId,
      siteId: data.siteId,
      cityId: preview.cityId,
      amount: Math.abs(netPaid).toFixed(2),
      direction: netPaid >= 0 ? 'debit' : 'credit',
      description: `Payroll for ${workerBreakdown.workerName} — ${data.yearMonth} at ${preview.siteCode}`,
      createdBy: session.user.id,
    })
  }

  // Lock all attendance rows for this site-month
  await db
    .update(attendance)
    .set({ isLocked: true })
    .where(
      and(
        eq(attendance.siteId, data.siteId),
        gte(attendance.date, start),
        lte(attendance.date, end)
      )
    )

  revalidatePath(`/admin/payroll/sites/${data.siteId}`)
  revalidatePath('/admin/payroll')
}

// ─── Get Finalized Snapshot (read-only view) ──────────────────────────────────

export async function getFinalizedSnapshot(siteId: string, yearMonth: string) {
  await requireAdmin()

  const originals = await db.query.payrollSnapshots.findMany({
    where: and(
      eq(payrollSnapshots.siteId, siteId),
      eq(payrollSnapshots.yearMonth, yearMonth),
      eq(payrollSnapshots.isCorrection, false)
    ),
    with: { worker: true, finalizedByUser: true },
  })

  if (originals.length === 0) return null

  // For each original, fetch its corrections
  const withCorrections = await Promise.all(
    originals.map(async (snap) => {
      const corrections = await db.query.payrollSnapshots.findMany({
        where: and(
          eq(payrollSnapshots.correctionOf, snap.id),
          eq(payrollSnapshots.isCorrection, true)
        ),
        with: { finalizedByUser: true },
        orderBy: (s, { asc }) => [asc(s.finalizedAt)],
      })

      const correctionsTotal = corrections.reduce((sum, c) => sum + Number(c.finalWage), 0)

      return {
        ...snap,
        corrections,
        currentTotal: Number(snap.finalWage) + correctionsTotal,
      }
    })
  )

  return {
    siteId,
    yearMonth,
    finalizedAt: originals[0].finalizedAt,
    finalizedBy: originals[0].finalizedByUser?.name ?? 'Unknown',
    siteSnapshot: originals[0].siteSnapshot,
    workers: withCorrections,
    grandTotal: withCorrections.reduce((sum, w) => sum + w.currentTotal, 0),
  }
}

// ─── Add Correction ─────────────────────────────────────────────────────────

const addCorrectionSchema = z.object({
  siteId: z.string().uuid(),
  workerId: z.string().uuid(),
  yearMonth: z.string().regex(/^\d{4}-\d{2}$/),
  amount: z.number().refine((v) => v !== 0, 'Amount cannot be zero'),
  reason: z.string().min(1).max(500),
})

export async function addPayrollCorrection(input: z.infer<typeof addCorrectionSchema>) {
  const session = await requireAdmin()
  const data = addCorrectionSchema.parse(input)

  // Find the original snapshot
  const original = await db.query.payrollSnapshots.findFirst({
    where: and(
      eq(payrollSnapshots.siteId, data.siteId),
      eq(payrollSnapshots.workerId, data.workerId),
      eq(payrollSnapshots.yearMonth, data.yearMonth),
      eq(payrollSnapshots.isCorrection, false)
    ),
    with: { worker: true, site: { with: { city: true } } },
  })

  if (!original) {
    throw new Error('No finalized payroll found for this worker in this site-month')
  }

  // Insert correction snapshot
  const [correction] = await db
    .insert(payrollSnapshots)
    .values({
      siteId: data.siteId,
      workerId: data.workerId,
      yearMonth: data.yearMonth,
      siteSnapshot: original.siteSnapshot,
      workerSnapshot: original.workerSnapshot,
      fullDays: 0,
      halfDays: 0,
      otTwoHrCount: 0,
      otFourHrCount: 0,
      grossWage: '0',
      adjustmentAmount: data.amount.toFixed(2),
      adjustmentReason: data.reason,
      finalWage: data.amount.toFixed(2),
      isCorrection: true,
      correctionOf: original.id,
      hadPreFinalizationEdits: false,
      finalizedBy: session.user.id,
    })
    .returning()

  // Write ledger transaction
  await db.insert(transactions).values({
    type: 'payroll_correction',
    referenceId: correction.id,
    workerId: data.workerId,
    siteId: data.siteId,
    cityId: original.site.cityId,
    amount: Math.abs(data.amount).toFixed(2),
    direction: data.amount >= 0 ? 'debit' : 'credit',
    description: `Correction for ${original.worker.name} — ${data.yearMonth}: ${data.reason}`,
    createdBy: session.user.id,
  })

  revalidatePath(`/admin/payroll/sites/${data.siteId}`)
  revalidatePath(`/admin/payroll/workers/${data.workerId}`)
}

// ─── Get all finalized months for a site (for the overview page) ─────────────

export async function getFinalizedMonthsForSite(siteId: string): Promise<string[]> {
  await requireAdmin()

  const rows = await db.query.payrollSnapshots.findMany({
    where: and(eq(payrollSnapshots.siteId, siteId), eq(payrollSnapshots.isCorrection, false)),
  })

  return Array.from(new Set(rows.map((r) => r.yearMonth)))
}
