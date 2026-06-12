import 'dotenv/config'
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL!)

async function main() {
  // Site attendance time windows (HH:MM strings, nullable)
  await sql`ALTER TABLE sites ADD COLUMN IF NOT EXISTS morning_attendance_start TEXT`
  await sql`ALTER TABLE sites ADD COLUMN IF NOT EXISTS morning_attendance_end TEXT`
  await sql`ALTER TABLE sites ADD COLUMN IF NOT EXISTS evening_attendance_start TEXT`
  await sql`ALTER TABLE sites ADD COLUMN IF NOT EXISTS evening_attendance_end TEXT`

  // Late flags on attendance
  await sql`ALTER TABLE attendance ADD COLUMN IF NOT EXISTS is_morning_late BOOLEAN NOT NULL DEFAULT FALSE`
  await sql`ALTER TABLE attendance ADD COLUMN IF NOT EXISTS is_evening_late BOOLEAN NOT NULL DEFAULT FALSE`

  console.log('Migration complete: attendance time windows + late flags added')
}

main().catch((e) => { console.error(e); process.exit(1) })
