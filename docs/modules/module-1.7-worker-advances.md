# Module 1.7 — Worker Advances

**Type:** New module. One new table (`advances`, a typed ledger), an approval flow (supervisor request → admin approve/reject), a derived-balance helper, and an integration into existing payroll finalization (1.5).

**Depends on:** `workers`, `users`, `employees`, `payroll_snapshots` (all existing). Builds on the finalization flow in Module 1.5.

**Core principle (locked):** No money is written to the `transactions` ledger when an advance is given. An advance is an **operational record** until payroll finalization, at which point it nets against wage. This preserves the system-wide rule: *no money in `transactions` until finalization.* The `advances` table is its own typed ledger, separate from `transactions`.

---

## 1. Money-flow model (the mental model — read first)

- An advance is cash handed to a worker **mid-month**, before payroll.
- It is recorded operationally (like attendance), **not** as a `transactions` row.
- At finalization, the system recovers some/all of the worker's outstanding advance balance **against their wage**, and writes a **recovery row** into the `advances` ledger.
- The worker's outstanding balance is **always derived** from the ledger: `SUM(approved issuance) − SUM(recovery)`. Never stored, never cached.
- Advances are **worker-level only.** No site attribution. Each worker has exactly one running balance.
- The `transactions` ledger still gets exactly one row per worker per cycle at finalization (the `net_paid`), unchanged. Advances never touch `transactions`.

---

## 2. Schema — `advances` (typed ledger)

File: `src/lib/db/schema/advances.ts`

```
advances:
  id                          uuid, pk, default gen_random_uuid()
  worker_id                   uuid, fk → workers, not null
  type                        enum ('issuance' | 'recovery'), not null
  amount                      numeric/integer (rupees), not null, > 0   -- always positive
  reason                      text, nullable                            -- required for issuance (app-level), null for recovery
  status                      enum ('pending' | 'approved' | 'rejected'), not null
  created_by                  uuid, fk → users, not null
  created_at                  timestamptz, not null, default now()
  approved_by                 uuid, fk → users, nullable
  approved_at                 timestamptz, nullable
  rejection_reason            text, nullable
  recovery_payroll_snapshot_id uuid, fk → payroll_snapshots, nullable   -- only set on type='recovery'

  -- conventions per house style:
  metadata                    jsonb, nullable
  notes                       text, nullable
```

### Row-type semantics
- **`issuance`** — an advance request/grant.
  - Supervisor-submitted: inserted with `status='pending'`.
  - Admin-direct: inserted with `status='approved'`, `approved_by`/`approved_at` set at insert.
  - On admin reject: `status='rejected'`, `rejection_reason` set.
  - `reason` required (app-level validation).
- **`recovery`** — system-written at finalization only.
  - Always `status='approved'` (no gate; system-authored).
  - `recovery_payroll_snapshot_id` set to the snapshot it was recovered against.
  - `reason` null; `created_by` = the finalizing admin.
  - **Immutable once written.** No edits, no deletes. (Corrections arrive in v2 as a third `type='correction'` — do not build now.)

### Balance rule (single source of truth)
```
outstanding = SUM(amount WHERE type='issuance' AND status='approved')
            − SUM(amount WHERE type='recovery')          -- recoveries are always 'approved'
```
Only `status='approved'` issuance rows count. `pending` and `rejected` issuance rows are invisible to balance and recovery.

### Indexes
- `(worker_id)` — balance computation and per-worker history.
- `(status)` — pending-queue lookups.
- `(worker_id, type, status)` — composite for the balance sum path.
- `(recovery_payroll_snapshot_id)` — reverse lookup from a snapshot to its recovery row.
- FK indexes on `worker_id`, `created_by`, `approved_by`, `recovery_payroll_snapshot_id` per house convention.

---

## 3. Helpers — `src/lib/payroll/advances.ts`

Pure functions / thin DB readers. Business logic lives here, not in server actions.

### `getOutstandingBalance(workerId, asOf?)`
- Returns the derived outstanding balance for a worker.
- `asOf` (optional timestamp): compute the balance as of that point (sum only rows with `created_at <= asOf` for issuance, and recoveries up to that point). Used for historical/audit views. When omitted, current balance.
- This is the **single source of truth.** Nothing else computes balance independently.

### `computeMaxRecoverable(adjustedWage, outstandingBalance)`
```
max_recoverable = min(outstandingBalance, adjustedWage)   // adjustedWage already >= 0 by guard
```
Pure function, no DB.

### `writeRecoveryRow({ workerId, amount, payrollSnapshotId, createdBy }, tx)`
- Inserts a `type='recovery'`, `status='approved'` row, with `recovery_payroll_snapshot_id` set.
- **Must run inside the same DB transaction as the payroll snapshot + transactions write** (see §6).
- Only called by finalization. Never exposed as a user action.

---

## 4. Approval flow (mirrors worker-creation pattern from 1.2)

### Supervisor submits a request
- Form: `{ worker, amount, reason }` — **reason required**, amount > 0.
- Worker dropdown filtered to workers in the supervisor's accessible scope (workers are city-scoped; supervisor is site-scoped — use the existing scoping pattern to determine which workers a supervisor may request advances for).
- Inserted as `type='issuance'`, `status='pending'`, `created_by = supervisor`.
- A pending request is **invisible to balance and recovery** until approved.

### Admin queue
- Admin sees a pending-advances queue (like the worker-approval and attendance-edit-request queues).
- Per request, admin can:
  - **Approve** — `status='approved'`, `approved_by`/`approved_at` set. Now counts toward balance.
  - **Edit-approve** — admin may adjust the `amount` and/or `reason` before approving (e.g. supervisor requested ₹5,000, admin grants ₹3,000). Record the approved values; the row is approved with the edited amount.
  - **Reject** — `status='rejected'`, `rejection_reason` required.

### Admin direct entry
- Admin can record an advance directly without a request: inserted as `type='issuance'`, `status='approved'` at insert, `created_by = approved_by = admin`. Immediately counts toward balance.

### Validation
- `amount > 0`, integer rupees.
- `reason` required on issuance (both supervisor-submitted and admin-direct).
- Server-side enforce that only admins can approve/reject/direct-enter; supervisors can only submit pending requests.

---

## 5. Finalization integration (modifies Module 1.5 / `src/server/actions/payroll.ts`)

### 5.1 New schema column on `payroll_snapshots`
Add `advanceRecovered` (numeric/integer rupees, not null, default 0). Discrete from the existing `adjustmentAmount`.

### 5.2 Pre-finalization block (NEW hard gate)
Before finalization may proceed for a site-month, check: **are there any `pending` issuance rows for any worker in this cycle?**
- If yes → **block finalization.** Return an error with a link to the pending-advances queue.
- Admin must resolve (approve or reject) **every** pending advance for the cycle's workers before finalizing.
- This is in addition to the existing finalization preconditions.

### 5.3 Pre-finalization review UI (per worker)
For each worker in the cycle, show:
- `outstanding` — from `getOutstandingBalance(workerId)`
- `gross_wage`
- `manual_adjustment` (existing adjustment field)
- `max_recoverable` — from `computeMaxRecoverable`
- an **editable recovery field**, pre-filled to `max_recoverable`
- resulting `net_paid` and a **carry-forward note** (e.g. "₹1,000 will carry forward")

The recovery field accepts any value in `[0, max_recoverable]`. It **cannot exceed** `max_recoverable` (and therefore cannot exceed outstanding, and cannot push net negative). Validate this server-side, not just in the UI.

### 5.4 Finalization math (exact order)
```
adjusted_wage  = gross_wage + manual_adjustment
if adjusted_wage < 0:
    ERROR — admin must resolve (reduce the negative adjustment) before finalizing
max_recoverable = min(outstanding_balance, adjusted_wage)
recovery        = admin's value, clamped/validated to [0, max_recoverable]
net_paid        = adjusted_wage - recovery
```
- Recovery is the **last** deduction. `net_paid` can never be negative.
- `outstanding_balance` is read via `getOutstandingBalance(workerId)` **inside** the finalization transaction (see §6).

### 5.5 What finalization writes (per worker, atomically)
1. `payroll_snapshot` row — now including `advanceRecovered = recovery`.
2. If `recovery > 0`: a `recovery` row in `advances` via `writeRecoveryRow(...)`, linked to that snapshot id.
3. The existing **one** `transactions` row for the worker, amount = `net_paid` (unchanged behavior — advances never write to `transactions`).

All three in **one DB transaction** per worker (or per cycle batch — match the existing finalization transaction granularity in 1.5).

---

## 6. Concurrency guard (IMPORTANT — do not skip)

Balance is derived by reading the ledger, and finalization both **reads** outstanding and **writes** a recovery against it. A worker can be split across two sites in the same month, so two different site-month finalizations for the **same worker** could run close together. Without a guard, both could read the same `outstanding` and each recover against it → **over-recovery** (worker recovered more than they owe).

Implement one of these (prefer the first):

- **Row-level lock on read-for-update:** when finalization computes `outstanding` for a worker, lock that worker's advance ledger rows for the duration of the transaction (`SELECT ... FOR UPDATE` on the worker's `advances` rows, or a lock on the `workers` row keyed by `worker_id`). The second finalization waits, then re-reads the now-reduced outstanding and recovers only what remains.
- **Application-level serialization** per `worker_id` during finalization.

Add an invariant check before writing a recovery row: **total recovered for a worker must never exceed total approved issuance.** If a recovery would push `outstanding` below 0, abort the transaction with an error. This is a belt-and-suspenders backstop even with the lock.

---

## 7. Out of scope (v1)
- No `type='correction'` rows — corrections to recoveries are v2.
- No site attribution on advances — worker-level only.
- No advance ever writes to the `transactions` ledger.
- No editing/deleting recovery rows — immutable.
- No cached/stored balance column — always derived.
- No interest, no installment scheduling — recovery is per-finalization, max-recoverable with admin reduce-only.

---

## 8. Gate checklist (manual click-through before next module)

1. [ ] `advances` table created: enums (`type`, `status`), all columns, FKs, and all indexes including the composite `(worker_id, type, status)`.
2. [ ] `advanceRecovered` column added to `payroll_snapshots` (default 0).
3. [ ] Supervisor submits an advance request → row is `type='issuance'`, `status='pending'`, invisible to balance.
4. [ ] `getOutstandingBalance` excludes pending and rejected issuance; includes only approved issuance minus recoveries.
5. [ ] Admin approves a pending request → counts toward balance immediately.
6. [ ] Admin edit-approves (₹5,000 requested → ₹3,000 granted) → balance reflects ₹3,000, not ₹5,000.
7. [ ] Admin rejects with reason → row `rejected`, never affects balance.
8. [ ] Admin direct entry → `status='approved'` at insert, counts immediately.
9. [ ] Supervisor cannot approve/reject/direct-enter (server-side enforced).
10. [ ] Reason required on issuance; amount > 0 enforced server-side.
11. [ ] Finalization **blocked** when any pending issuance exists for a cycle worker; error links to the pending queue.
12. [ ] After resolving all pending advances, finalization proceeds.
13. [ ] Pre-finalization review shows outstanding, gross, manual adjustment, max recoverable, editable recovery (pre-filled to max), net, carry-forward note.
14. [ ] Recovery field rejects values > max_recoverable and < 0 (server-side).
15. [ ] Math: gross 4,000, adjustment −500, outstanding 5,000 → adjusted 3,500, max recoverable 3,500, recover 3,500 → net 0, carry-forward 1,500.
16. [ ] Negative `adjusted_wage` blocks finalization with the resolve-error.
17. [ ] On finalization with recovery > 0: a `recovery` row is written, `status='approved'`, linked via `recovery_payroll_snapshot_id`; `payroll_snapshot.advanceRecovered` matches; exactly one `transactions` row = net_paid; advances never wrote to `transactions`.
18. [ ] Outstanding balance correctly reduces after recovery; remainder carries forward and appears on the next cycle's review.
19. [ ] Concurrency: two finalizations touching the same worker do not over-recover (lock works); the invariant backstop aborts any recovery that would push outstanding below 0.
20. [ ] Recovery rows cannot be edited or deleted through any UI/action.
