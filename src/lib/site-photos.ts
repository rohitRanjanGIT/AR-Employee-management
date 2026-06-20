/**
 * Client-safe site-gallery helpers (no SDK / secrets). Server-side upload, delete
 * and EXIF parsing live in `lib/cloudinary.ts` + `lib/exif.ts` (server-only).
 */

// ─── Locked tag vocabulary (no free-form tags) ────────────────────────────────

export const PHOTO_TAGS = ['site', 'material', 'team', 'process', 'brochure'] as const

export type PhotoTag = (typeof PHOTO_TAGS)[number]

/** The 'site' tag is special: choosing it requires attaching the photo to a site. */
export const SITE_TAG: PhotoTag = 'site'

export function isValidTag(tag: string): tag is PhotoTag {
  return (PHOTO_TAGS as readonly string[]).includes(tag)
}

export const TAG_LABELS: Record<PhotoTag, string> = {
  site: 'Site',
  material: 'Material',
  team: 'Team',
  process: 'Process',
  brochure: 'Brochure',
}

/** Fixed color per tag — always-visible, color-coded badges keep the grid scannable. */
export const TAG_COLORS: Record<PhotoTag, string> = {
  site: 'bg-blue-500/80',
  material: 'bg-orange-500/80',
  team: 'bg-green-500/80',
  process: 'bg-purple-500/80',
  brochure: 'bg-pink-500/80',
}

export function tagColor(tag: string): string {
  return (TAG_COLORS as Record<string, string>)[tag] ?? 'bg-gray-500/80'
}

// ─── Upload limits (mirrored server-side in lib/cloudinary.ts + the action) ────

export const MAX_BATCH = 10
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024 // 10 MB
export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
export const ACCEPT_ATTR = 'image/jpeg,image/png,image/webp,image/heic,image/heif'

// ─── Shared types (kept here so they can be imported by both the 'use server'
//     action module and client components — a 'use server' file may only export
//     async functions) ───────────────────────────────────────────────────────

export type GalleryPhoto = {
  id: string
  // Null when the photo is a site-less (admin-only) general photo.
  siteId: string | null
  siteName: string | null
  siteCode: string | null
  cityId: string | null
  cityName: string | null
  description: string | null
  tags: string[]
  url: string
  uploadedBy: string
  uploaderName: string
  takenAt: Date | null
  uploadedAt: Date
  isHidden: boolean
  canModify: boolean
}

export type GalleryFilters = {
  tags?: PhotoTag[]
  matchAllTags?: boolean
  uploaderId?: string
  includeHidden?: boolean
  // global gallery only
  siteId?: string
  cityId?: string
}

export type UploadResult = {
  succeeded: number
  failed: number
  failures: { filename: string; reason: string }[]
}

// ─── Cloudinary delivery transforms ───────────────────────────────────────────

function withTransform(url: string | null | undefined, transform: string): string | null {
  if (!url) return null
  const marker = '/upload/'
  const i = url.indexOf(marker)
  if (i === -1) return url
  return `${url.slice(0, i + marker.length)}${transform}/${url.slice(i + marker.length)}`
}

/** 200×200 square crop — masonry thumbnails / dashboard strips. */
export function thumbUrl(url: string | null | undefined): string | null {
  return withTransform(url, 'c_fill,w_200,h_200,f_auto,q_auto')
}

/** ~400px wide fit — grid cards. */
export function gridUrl(url: string | null | undefined): string | null {
  return withTransform(url, 'c_fit,w_400,h_400,f_auto,q_auto')
}

/** 1200px wide — lightbox. */
export function lightboxUrl(url: string | null | undefined): string | null {
  return withTransform(url, 'c_limit,w_1200,f_auto,q_auto')
}

// ─── Relative time ("2 hours ago") ────────────────────────────────────────────

export function relativeTime(input: Date | string | null | undefined): string {
  if (!input) return ''
  const then = typeof input === 'string' ? new Date(input) : input
  const seconds = Math.round((Date.now() - then.getTime()) / 1000)
  if (seconds < 45) return 'just now'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`
  const days = Math.round(hours / 24)
  if (days < 30) return `${days} day${days !== 1 ? 's' : ''} ago`
  const months = Math.round(days / 30)
  if (months < 12) return `${months} month${months !== 1 ? 's' : ''} ago`
  const years = Math.round(months / 12)
  return `${years} year${years !== 1 ? 's' : ''} ago`
}
