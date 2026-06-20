import 'server-only'
import exifr from 'exifr'

/**
 * Parses EXIF `DateTimeOriginal` + `OffsetTimeOriginal` from an image buffer and
 * returns the capture instant as a UTC Date — or null when EXIF is absent or
 * unparseable (common after messaging-app re-saves).
 *
 * - If an offset is present, it is honoured.
 * - If no offset, the timestamp is assumed to be in Asia/Kolkata (+05:30).
 * - Stored upstream as a `timestamptz` (UTC).
 */
export async function parseTakenAt(buffer: Buffer): Promise<Date | null> {
  let parsed: Record<string, unknown> | undefined
  try {
    parsed = await exifr.parse(buffer, {
      pick: ['DateTimeOriginal', 'OffsetTimeOriginal'],
      reviveValues: false, // keep raw strings so we control timezone interpretation
    })
  } catch {
    return null
  }
  if (!parsed) return null

  const raw = parsed.DateTimeOriginal
  if (typeof raw !== 'string') return null

  // EXIF format: "YYYY:MM:DD HH:MM:SS"
  const m = raw.match(/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/)
  if (!m) return null
  const [, y, mo, d, h, mi, s] = m

  const offset =
    typeof parsed.OffsetTimeOriginal === 'string'
      ? normalizeOffset(parsed.OffsetTimeOriginal)
      : '+05:30' // no offset → assume Asia/Kolkata

  if (!offset) return null

  const iso = `${y}-${mo}-${d}T${h}:${mi}:${s}${offset}`
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? null : date
}

/** Normalises an EXIF offset string (e.g. "+05:30", "+0530", "Z") to ISO form. */
function normalizeOffset(value: string): string | null {
  const v = value.trim()
  if (v === 'Z' || v === '+00:00' || v === '-00:00') return 'Z'
  const m = v.match(/^([+-])(\d{2}):?(\d{2})$/)
  if (!m) return null
  return `${m[1]}${m[2]}:${m[3]}`
}
