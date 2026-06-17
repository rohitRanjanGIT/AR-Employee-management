import 'dotenv/config'
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL!)

async function main() {
  // ── workers: replace age with date_of_birth, add bank + photo columns ──
  await sql`ALTER TABLE workers ADD COLUMN IF NOT EXISTS date_of_birth DATE`
  await sql`ALTER TABLE workers ADD COLUMN IF NOT EXISTS account_number TEXT`
  await sql`ALTER TABLE workers ADD COLUMN IF NOT EXISTS ifsc_code TEXT`
  await sql`ALTER TABLE workers ADD COLUMN IF NOT EXISTS photo_cloudinary_public_id TEXT`
  await sql`ALTER TABLE workers ADD COLUMN IF NOT EXISTS photo_cloudinary_url TEXT`
  // Destructive: drop the old age column (no back-fill of DOB)
  await sql`ALTER TABLE workers DROP COLUMN IF EXISTS age`

  // ── employees: add date_of_birth, bank + photo columns ──
  await sql`ALTER TABLE employees ADD COLUMN IF NOT EXISTS date_of_birth DATE`
  await sql`ALTER TABLE employees ADD COLUMN IF NOT EXISTS account_number TEXT`
  await sql`ALTER TABLE employees ADD COLUMN IF NOT EXISTS ifsc_code TEXT`
  await sql`ALTER TABLE employees ADD COLUMN IF NOT EXISTS photo_cloudinary_public_id TEXT`
  await sql`ALTER TABLE employees ADD COLUMN IF NOT EXISTS photo_cloudinary_url TEXT`

  console.log('Migration complete: DOB + bank details + photo columns added; workers.age dropped')
}

main().catch((e) => { console.error(e); process.exit(1) })
