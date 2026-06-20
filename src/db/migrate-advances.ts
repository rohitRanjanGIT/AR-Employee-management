import 'dotenv/config'
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL!)

async function main() {
  // Module 1.7 — Worker Advances. Creates advance_type/advance_status enums, the
  // advances ledger table + indexes (incl. the composite balance-sum path), and
  // adds advance_recovered to payroll_snapshots. Idempotent.

  await sql`
    DO $$ BEGIN
      CREATE TYPE advance_type AS ENUM ('issuance', 'recovery');
    EXCEPTION WHEN duplicate_object THEN null; END $$;
  `
  await sql`
    DO $$ BEGIN
      CREATE TYPE advance_status AS ENUM ('pending', 'approved', 'rejected');
    EXCEPTION WHEN duplicate_object THEN null; END $$;
  `

  await sql`
    CREATE TABLE IF NOT EXISTS advances (
      id                           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      worker_id                    uuid NOT NULL REFERENCES workers(id),
      type                         advance_type NOT NULL,
      amount                       numeric(12, 2) NOT NULL,
      reason                       text,
      status                       advance_status NOT NULL,
      created_by                   text NOT NULL REFERENCES users(id),
      created_at                   timestamptz NOT NULL DEFAULT now(),
      approved_by                  text REFERENCES users(id),
      approved_at                  timestamptz,
      rejection_reason             text,
      recovery_payroll_snapshot_id uuid REFERENCES payroll_snapshots(id),
      metadata                     jsonb,
      notes                        text
    )
  `

  await sql`CREATE INDEX IF NOT EXISTS advances_worker_idx ON advances (worker_id)`
  await sql`CREATE INDEX IF NOT EXISTS advances_status_idx ON advances (status)`
  await sql`
    CREATE INDEX IF NOT EXISTS advances_worker_type_status_idx
      ON advances (worker_id, type, status)
  `
  await sql`
    CREATE INDEX IF NOT EXISTS advances_recovery_snapshot_idx
      ON advances (recovery_payroll_snapshot_id)
  `
  await sql`CREATE INDEX IF NOT EXISTS advances_created_by_idx ON advances (created_by)`
  await sql`CREATE INDEX IF NOT EXISTS advances_approved_by_idx ON advances (approved_by)`

  await sql`
    ALTER TABLE payroll_snapshots
      ADD COLUMN IF NOT EXISTS advance_recovered numeric(12, 2) NOT NULL DEFAULT '0'
  `

  console.log(
    'Migration complete: advances table + enums + indexes created; payroll_snapshots.advance_recovered added'
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
