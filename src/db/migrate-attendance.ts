import 'dotenv/config'
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL!)

async function main() {
  // Create enums
  await sql`
    DO $$ BEGIN
      CREATE TYPE ot_type AS ENUM ('none', '2hr', '4hr');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$
  `

  await sql`
    DO $$ BEGIN
      CREATE TYPE attendance_status AS ENUM ('full', 'half', 'absent');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$
  `

  await sql`
    DO $$ BEGIN
      CREATE TYPE edit_request_status AS ENUM ('pending', 'approved', 'rejected');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$
  `

  // Create attendance table
  await sql`
    CREATE TABLE IF NOT EXISTS attendance (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      site_id UUID NOT NULL REFERENCES sites(id),
      worker_id UUID NOT NULL REFERENCES workers(id),
      city_id UUID NOT NULL REFERENCES cities(id),
      date DATE NOT NULL,

      morning_marked_at TIMESTAMP,
      morning_marked_by UUID REFERENCES employees(id),

      evening_marked_at TIMESTAMP,
      evening_marked_by UUID REFERENCES employees(id),

      ot ot_type NOT NULL DEFAULT 'none',

      wage_daily_snapshot DECIMAL(10,2) NOT NULL,
      ot_rate_snapshot DECIMAL(10,2),

      derived_status attendance_status NOT NULL DEFAULT 'half',

      is_edited BOOLEAN NOT NULL DEFAULT FALSE,
      edit_request JSONB,
      edit_request_status edit_request_status,

      is_locked BOOLEAN NOT NULL DEFAULT FALSE,

      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

      CONSTRAINT worker_site_date_unique UNIQUE (worker_id, site_id, date)
    )
  `

  console.log('Migration complete: attendance table created')
}

main().catch((e) => { console.error(e); process.exit(1) })
