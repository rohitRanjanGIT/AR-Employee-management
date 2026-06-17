/**
 * Client-safe Cloudinary URL helpers (no SDK / secrets). Server-side upload &
 * delete live in `lib/cloudinary.ts` (server-only).
 */

/**
 * Injects an avatar delivery transform (square fill, auto format/quality) into a
 * stored Cloudinary `secure_url`. Returns the input unchanged if it is not a
 * recognised Cloudinary upload URL.
 */
export function avatarUrl(url: string | null | undefined, size = 200): string | null {
  if (!url) return null
  const marker = '/upload/'
  const i = url.indexOf(marker)
  if (i === -1) return url
  const transform = `c_fill,g_face,w_${size},h_${size},f_auto,q_auto`
  return `${url.slice(0, i + marker.length)}${transform}/${url.slice(i + marker.length)}`
}
