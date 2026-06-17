/**
 * Computes a person's age from their date of birth. Display-only — age is never
 * stored. Returns "-" when DOB is null/blank/invalid (the site-wide empty marker).
 */
export function computeAge(dob: Date | string | null | undefined): string {
  if (!dob) return '-'
  const birth =
    typeof dob === 'string'
      ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(dob) ? `${dob}T00:00:00` : dob)
      : dob
  if (isNaN(birth.getTime())) return '-'
  const now = new Date()
  let age = now.getFullYear() - birth.getFullYear()
  const m = now.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--
  return age >= 0 ? String(age) : '-'
}
