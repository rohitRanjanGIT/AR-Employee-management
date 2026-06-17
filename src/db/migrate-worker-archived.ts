import 'dotenv/config'
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL!)

async function main() {
  // Add 'archived' to the worker_status enum (soft-delete state).
  await sql`ALTER TYPE worker_status ADD VALUE IF NOT EXISTS 'archived'`
  console.log("Migration complete: worker_status enum gained 'archived'")
}

main().catch((e) => { console.error(e); process.exit(1) })
