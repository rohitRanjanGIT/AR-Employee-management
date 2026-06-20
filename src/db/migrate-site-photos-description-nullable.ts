import 'dotenv/config'
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL!)

async function main() {
  // Module 1.6 follow-up: description is optional — make the column nullable and
  // normalise any existing empty-string descriptions to NULL.
  await sql`ALTER TABLE site_photos ALTER COLUMN description DROP NOT NULL`
  await sql`UPDATE site_photos SET description = NULL WHERE description = ''`
  console.log('Migration complete: site_photos.description is now nullable')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
