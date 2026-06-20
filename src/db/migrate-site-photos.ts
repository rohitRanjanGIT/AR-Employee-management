import 'dotenv/config'
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL!)

async function main() {
  // Module 1.6 — Site Photo Gallery. Creates the site_photos table with FKs,
  // the three btree indexes, and the GIN index on the tags array.
  await sql`
    CREATE TABLE IF NOT EXISTS site_photos (
      id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      site_id              uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
      city_id              uuid NOT NULL REFERENCES cities(id),
      uploaded_by          text NOT NULL REFERENCES users(id),
      description          text NOT NULL,
      tags                 text[] NOT NULL DEFAULT '{}',
      cloudinary_public_id text NOT NULL,
      cloudinary_url       text NOT NULL,
      taken_at             timestamptz,
      uploaded_at          timestamptz NOT NULL DEFAULT now(),
      is_hidden            boolean NOT NULL DEFAULT false,
      hidden_at            timestamptz,
      hidden_by            text REFERENCES users(id)
    )
  `

  await sql`
    CREATE INDEX IF NOT EXISTS site_photos_site_uploaded_idx
      ON site_photos (site_id, uploaded_at DESC)
  `
  await sql`
    CREATE INDEX IF NOT EXISTS site_photos_uploaded_by_idx
      ON site_photos (uploaded_by)
  `
  await sql`
    CREATE INDEX IF NOT EXISTS site_photos_city_idx
      ON site_photos (city_id)
  `
  // GIN index for tag array && / @> operators (OR / AND tag filtering).
  await sql`
    CREATE INDEX IF NOT EXISTS site_photos_tags_idx
      ON site_photos USING gin (tags)
  `

  console.log('Migration complete: site_photos table + indexes (incl. GIN on tags) created')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
