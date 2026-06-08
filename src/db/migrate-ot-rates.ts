import 'dotenv/config'
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL!)

async function main() {
  await sql`ALTER TABLE workers ADD COLUMN IF NOT EXISTS ot_rate_2hr decimal(10,2)`
  await sql`ALTER TABLE workers ADD COLUMN IF NOT EXISTS ot_rate_4hr decimal(10,2)`
  await sql`ALTER TABLE workers ADD COLUMN IF NOT EXISTS ot_rate_6hr decimal(10,2)`
  await sql`ALTER TABLE workers DROP COLUMN IF EXISTS ot_rate`
  console.log('Done: ot_rate split into ot_rate_2hr / ot_rate_4hr / ot_rate_6hr')
}

main().catch((e) => { console.error(e); process.exit(1) })
