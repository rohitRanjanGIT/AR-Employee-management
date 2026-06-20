import 'dotenv/config'
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL!)

async function main() {
  // Module 1.5 — Payroll Finalization. Creates the transaction enums, the
  // payroll_snapshots table (with self-referencing correction FK + partial
  // unique index for one original per site-worker-month), and the transactions
  // ledger table, plus supporting indexes. Idempotent.

  // ─── Enums ────────────────────────────────────────────────────────────────
  await sql`
    DO $$ BEGIN
      CREATE TYPE transaction_type AS ENUM ('payroll_worker', 'payroll_correction');
    EXCEPTION WHEN duplicate_object THEN null; END $$;
  `
  await sql`
    DO $$ BEGIN
      CREATE TYPE transaction_direction AS ENUM ('debit', 'credit');
    EXCEPTION WHEN duplicate_object THEN null; END $$;
  `

  // ─── payroll_snapshots ────────────────────────────────────────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS payroll_snapshots (
      id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      site_id                     uuid NOT NULL REFERENCES sites(id),
      worker_id                   uuid NOT NULL REFERENCES workers(id),
      year_month                  text NOT NULL,
      site_snapshot               jsonb NOT NULL,
      worker_snapshot             jsonb NOT NULL,
      full_days                   integer NOT NULL DEFAULT 0,
      half_days                   integer NOT NULL DEFAULT 0,
      ot_two_hr_count             integer NOT NULL DEFAULT 0,
      ot_four_hr_count            integer NOT NULL DEFAULT 0,
      gross_wage                  numeric(12, 2) NOT NULL,
      adjustment_amount           numeric(12, 2) NOT NULL DEFAULT '0',
      adjustment_reason           text,
      final_wage                  numeric(12, 2) NOT NULL,
      is_correction               boolean NOT NULL DEFAULT false,
      correction_of               uuid REFERENCES payroll_snapshots(id),
      had_pre_finalization_edits  boolean NOT NULL DEFAULT false,
      finalized_by                text NOT NULL REFERENCES users(id),
      finalized_at                timestamp NOT NULL DEFAULT now()
    )
  `

  // Only one "original" (non-correction) snapshot per site-worker-month.
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS payroll_snapshots_original_unique
      ON payroll_snapshots (site_id, worker_id, year_month)
      WHERE is_correction = false
  `
  await sql`
    CREATE INDEX IF NOT EXISTS payroll_snapshots_site_month_idx
      ON payroll_snapshots (site_id, year_month)
  `
  await sql`
    CREATE INDEX IF NOT EXISTS payroll_snapshots_worker_idx
      ON payroll_snapshots (worker_id)
  `

  // ─── transactions ─────────────────────────────────────────────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS transactions (
      id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      type          transaction_type NOT NULL,
      reference_id  uuid NOT NULL,
      worker_id     uuid REFERENCES workers(id),
      site_id       uuid NOT NULL REFERENCES sites(id),
      city_id       uuid NOT NULL REFERENCES cities(id),
      amount        numeric(12, 2) NOT NULL,
      direction     transaction_direction NOT NULL,
      description   text NOT NULL,
      created_by    text NOT NULL REFERENCES users(id),
      created_at    timestamp NOT NULL DEFAULT now()
    )
  `
  await sql`
    CREATE INDEX IF NOT EXISTS transactions_reference_idx ON transactions (reference_id)
  `
  await sql`
    CREATE INDEX IF NOT EXISTS transactions_site_idx ON transactions (site_id)
  `
  await sql`
    CREATE INDEX IF NOT EXISTS transactions_worker_idx ON transactions (worker_id)
  `

  console.log(
    'Migration complete: payroll_snapshots + transactions tables, enums, and indexes created'
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
