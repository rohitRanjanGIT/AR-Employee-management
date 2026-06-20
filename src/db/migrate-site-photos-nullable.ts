import 'dotenv/config'
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL!)

async function main() {
  // Module 1.6 follow-up: site-less (admin-only) general photos (brochure/process/
  // material/team) have no site, so site_id + denormalized city_id become nullable.
  await sql`ALTER TABLE site_photos ALTER COLUMN site_id DROP NOT NULL`
  await sql`ALTER TABLE site_photos ALTER COLUMN city_id DROP NOT NULL`
  console.log('Migration complete: site_photos.site_id + city_id are now nullable')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
