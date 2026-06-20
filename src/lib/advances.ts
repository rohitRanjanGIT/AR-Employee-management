import 'server-only'
import { db } from '@/db'
import { advances } from '@/db/schema'
import { and, eq, lte, inArray } from 'drizzle-orm'

// Module 1.7 — advance ledger helpers. Business logic lives here, not in the
// server actions. Outstanding balance is the SINGLE SOURCE OF TRUTH and is
// always derived from the ledger (never stored, never cached).

/**
 * Derived outstanding balance for a worker:
 *   SUM(approved issuance) − SUM(recovery)
 * Only `status='approved'` issuance counts; pending/rejected are invisible.
 * Recoveries are always 'approved' (system-authored).
 *
 * `asOf` (optional): compute the balance as of that instant — only rows with
 * `created_at <= asOf` are considered. Used for historical/audit views.
 */
export async function getOutstandingBalance(workerId: string, asOf?: Date): Promise<number> {
  const rows = await db
    .select({
      type: advances.type,
      status: advances.status,
      amount: advances.amount,
    })
    .from(advances)
    .where(
      asOf
        ? and(eq(advances.workerId, workerId), lte(advances.createdAt, asOf))
        : eq(advances.workerId, workerId)
    )

  let issued = 0
  let recovered = 0
  for (const r of rows) {
    if (r.type === 'issuance' && r.status === 'approved') issued += Number(r.amount)
    else if (r.type === 'recovery') recovered += Number(r.amount)
  }
  return issued - recovered
}

/**
 * Batched outstanding balances for many workers (one ledger read, reduced in JS).
 * Every requested workerId is present in the map (0 when no ledger activity).
 */
export async function getOutstandingBalances(workerIds: string[]): Promise<Map<string, number>> {
  const result = new Map<string, number>()
  for (const id of workerIds) result.set(id, 0)
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

  for (const r of rows) {
    const cur = result.get(r.workerId) ?? 0
    if (r.type === 'issuance' && r.status === 'approved') result.set(r.workerId, cur + Number(r.amount))
    else if (r.type === 'recovery') result.set(r.workerId, cur - Number(r.amount))
  }
  return result
}

/**
 * Inserts a `type='recovery'`, `status='approved'` row linked to the snapshot it
 * was recovered against. Only called by finalization — never a user action.
 *
 * NOTE: the 1.7 spec calls for this to run inside the same DB transaction as the
 * payroll snapshot + transaction write. The Neon HTTP driver has no interactive
 * transactions (same constraint 1.5's finalization accepts), so finalization
 * instead guards over-recovery with an invariant backstop: it re-reads the
 * worker's fresh outstanding balance immediately before calling this and clamps
 * the amount to it (reduce-only). `amount` MUST already be validated to
 * [0, fresh outstanding] by the caller.
 */
export async function writeRecoveryRow(input: {
  workerId: string
  amount: number
  payrollSnapshotId: string
  createdBy: string
}) {
  const now = new Date()
  const [row] = await db
    .insert(advances)
    .values({
      workerId: input.workerId,
      type: 'recovery',
      amount: input.amount.toFixed(2),
      reason: null,
      status: 'approved',
      createdBy: input.createdBy,
      approvedBy: input.createdBy,
      approvedAt: now,
      recoveryPayrollSnapshotId: input.payrollSnapshotId,
    })
    .returning()
  return row
}
