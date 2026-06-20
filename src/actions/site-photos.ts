'use server'

import { db } from '@/db'
import { sitePhotos, sites, siteSupervisorAssignments, employees } from '@/db/schema'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import {
  eq,
  and,
  or,
  isNull,
  inArray,
  arrayOverlaps,
  arrayContains,
  sql,
  type SQL,
} from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { uploadGalleryImage, deleteImageStrict } from '@/lib/cloudinary'
import { parseTakenAt } from '@/lib/exif'
import {
  PHOTO_TAGS,
  MAX_BATCH,
  MAX_PHOTO_BYTES,
  ACCEPTED_TYPES,
  type GalleryPhoto,
  type GalleryFilters,
  type UploadResult,
} from '@/lib/site-photos'

// ─── Auth guards ──────────────────────────────────────────────────────────────

async function requireAuth() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) throw new Error('Unauthorised')
  return session
}

async function requireAdmin() {
  const session = await requireAuth()
  if (session.user.role !== 'admin') throw new Error('Unauthorised')
  return session
}

/** Site ids the user (supervisor) is CURRENTLY assigned to. Admin handled separately. */
async function getAssignedSiteIds(userId: string): Promise<string[]> {
  const employee = await db.query.employees.findFirst({ where: eq(employees.userId, userId) })
  if (!employee) return []
  const rows = await db.query.siteSupervisorAssignments.findMany({
    where: eq(siteSupervisorAssignments.employeeId, employee.id),
    columns: { siteId: true },
  })
  return rows.map((r) => r.siteId)
}

// ─── Shaping ──────────────────────────────────────────────────────────────────

type RawPhoto = {
  id: string
  siteId: string | null
  cityId: string | null
  description: string | null
  tags: string[]
  cloudinaryUrl: string
  uploadedBy: string
  takenAt: Date | null
  uploadedAt: Date
  isHidden: boolean
  site: { id: string; name: string; code: string } | null
  city: { id: string; name: string } | null
  uploadedByUser: { id: string; name: string; employee: { name: string } | null } | null
}

function shapePhoto(
  p: RawPhoto,
  ctx: { isAdmin: boolean; userId: string; assignedSiteIds: string[] }
): GalleryPhoto {
  // Uploader name resolves via users → employees (employee holds the name and
  // persists for inactive staff); fall back to the user record for admins.
  const uploaderName = p.uploadedByUser?.employee?.name ?? p.uploadedByUser?.name ?? 'Unknown'
  // Uploader can modify their own photo: a site-less (general) one always, a
  // site one only while still assigned to that site. Admin can modify anything.
  const canModify =
    ctx.isAdmin ||
    (p.uploadedBy === ctx.userId &&
      (!p.siteId || ctx.assignedSiteIds.includes(p.siteId)))
  return {
    id: p.id,
    siteId: p.siteId,
    siteName: p.site?.name ?? null,
    siteCode: p.site?.code ?? null,
    cityId: p.cityId,
    cityName: p.city?.name ?? null,
    description: p.description,
    tags: p.tags ?? [],
    url: p.cloudinaryUrl,
    uploadedBy: p.uploadedBy,
    uploaderName,
    takenAt: p.takenAt,
    uploadedAt: p.uploadedAt,
    isHidden: p.isHidden,
    canModify,
  }
}

const photoWith = {
  site: { columns: { id: true, name: true, code: true } },
  city: { columns: { id: true, name: true } },
  uploadedByUser: {
    columns: { id: true, name: true },
    with: { employee: { columns: { name: true } } },
  },
} as const

// COALESCE(taken_at, uploaded_at) DESC — one consistent ordering everywhere.
const orderByTaken = [sql`coalesce(${sitePhotos.takenAt}, ${sitePhotos.uploadedAt}) desc`]

// ─── Filters ──────────────────────────────────────────────────────────────────

const filtersSchema = z.object({
  tags: z.array(z.enum(PHOTO_TAGS)).optional(),
  matchAllTags: z.boolean().optional(),
  uploaderId: z.string().optional(),
  includeHidden: z.boolean().optional(),
  // global gallery only
  siteId: z.string().uuid().optional(),
  cityId: z.string().uuid().optional(),
})

function buildFilterConditions(f: GalleryFilters, isAdmin: boolean): SQL[] {
  const conds: SQL[] = []

  // Supervisors never see hidden photos. Admin sees them only via the toggle.
  if (!isAdmin || !f.includeHidden) {
    conds.push(eq(sitePhotos.isHidden, false))
  }

  if (f.tags && f.tags.length > 0) {
    conds.push(
      f.matchAllTags
        ? arrayContains(sitePhotos.tags, f.tags) // @>  (all selected)
        : arrayOverlaps(sitePhotos.tags, f.tags) // &&  (any selected)
    )
  }
  if (f.uploaderId) conds.push(eq(sitePhotos.uploadedBy, f.uploaderId))
  if (f.siteId) conds.push(eq(sitePhotos.siteId, f.siteId))
  if (f.cityId) conds.push(eq(sitePhotos.cityId, f.cityId))
  return conds
}

// ─── Per-site gallery ─────────────────────────────────────────────────────────

/** Enforces visibility: admin sees any site; supervisor only currently-assigned. */
async function assertSiteAccess(siteId: string) {
  const session = await requireAuth()
  const isAdmin = session.user.role === 'admin'
  const assignedSiteIds = isAdmin ? [] : await getAssignedSiteIds(session.user.id)
  if (!isAdmin && !assignedSiteIds.includes(siteId)) throw new Error('Unauthorised')
  return { session, isAdmin, assignedSiteIds }
}

export async function getSitePhotos(
  siteId: string,
  rawFilters: GalleryFilters = {}
): Promise<GalleryPhoto[]> {
  const { session, isAdmin, assignedSiteIds } = await assertSiteAccess(siteId)
  const f = filtersSchema.parse(rawFilters)

  const conds = buildFilterConditions(f, isAdmin)
  conds.push(eq(sitePhotos.siteId, siteId))

  const rows = (await db.query.sitePhotos.findMany({
    where: and(...conds),
    orderBy: orderByTaken,
    with: photoWith,
  })) as unknown as RawPhoto[]

  return rows.map((r) => shapePhoto(r, { isAdmin, userId: session.user.id, assignedSiteIds }))
}

/** Header + access for a per-site gallery page. `canUpload` is false for non-active sites. */
export async function getGallerySite(siteId: string) {
  const { isAdmin } = await assertSiteAccess(siteId)
  const site = await db.query.sites.findFirst({
    where: eq(sites.id, siteId),
    with: { city: { columns: { id: true, name: true } } },
  })
  if (!site) throw new Error('Site not found')
  return {
    id: site.id,
    name: site.name,
    code: site.code,
    status: site.status,
    cityName: site.city.name,
    canUpload: site.status === 'active',
    isAdmin,
  }
}

/** Distinct uploaders that have photos on a site (for the uploader filter). */
export async function getSiteGalleryUploaders(siteId: string) {
  await assertSiteAccess(siteId)
  const rows = await db
    .selectDistinct({ id: sitePhotos.uploadedBy })
    .from(sitePhotos)
    .where(eq(sitePhotos.siteId, siteId))
  return resolveUploaderNames(rows.map((r) => r.id))
}

// ─── Global gallery (admin only) ──────────────────────────────────────────────

export async function getGlobalGallery(rawFilters: GalleryFilters = {}): Promise<GalleryPhoto[]> {
  const session = await requireAdmin()
  const f = filtersSchema.parse(rawFilters)
  const conds = buildFilterConditions(f, true)

  const rows = (await db.query.sitePhotos.findMany({
    where: conds.length > 0 ? and(...conds) : undefined,
    orderBy: orderByTaken,
    with: photoWith,
  })) as unknown as RawPhoto[]

  return rows.map((r) => shapePhoto(r, { isAdmin: true, userId: session.user.id, assignedSiteIds: [] }))
}

export async function getGlobalGalleryFilterOptions() {
  await requireAdmin()
  const [siteRows, cityRows, uploaderRows] = await Promise.all([
    db.query.sites.findMany({ columns: { id: true, name: true, code: true }, orderBy: (s, { asc }) => [asc(s.name)] }),
    db.query.cities.findMany({ columns: { id: true, name: true }, orderBy: (c, { asc }) => [asc(c.name)] }),
    db.selectDistinct({ id: sitePhotos.uploadedBy }).from(sitePhotos),
  ])
  return {
    sites: siteRows,
    cities: cityRows,
    uploaders: await resolveUploaderNames(uploaderRows.map((r) => r.id)),
  }
}

// ─── Supervisor gallery (across all currently-assigned sites) ─────────────────

/** Photos on any assigned site OR general (site-less) photos the user uploaded. */
function supervisorScope(userId: string, assignedSiteIds: string[]): SQL {
  const ownSiteless = and(isNull(sitePhotos.siteId), eq(sitePhotos.uploadedBy, userId))!
  if (assignedSiteIds.length === 0) return ownSiteless
  return or(inArray(sitePhotos.siteId, assignedSiteIds), ownSiteless)!
}

export async function getSupervisorGallery(rawFilters: GalleryFilters = {}): Promise<GalleryPhoto[]> {
  const session = await requireAuth()
  if (session.user.role !== 'supervisor') throw new Error('Unauthorised')

  const assignedSiteIds = await getAssignedSiteIds(session.user.id)

  const f = filtersSchema.parse(rawFilters)
  const conds = buildFilterConditions(f, false) // never admin: hidden always excluded

  if (f.siteId) {
    // A supervisor may only filter to a site they are assigned to.
    if (!assignedSiteIds.includes(f.siteId)) return []
    // buildFilterConditions already pushed eq(siteId, f.siteId).
  } else {
    // Default scope: photos on any assigned site + the supervisor's own
    // general (site-less) photos.
    conds.push(supervisorScope(session.user.id, assignedSiteIds))
  }

  const rows = (await db.query.sitePhotos.findMany({
    where: and(...conds),
    orderBy: orderByTaken,
    with: photoWith,
  })) as unknown as RawPhoto[]

  return rows.map((r) => shapePhoto(r, { isAdmin: false, userId: session.user.id, assignedSiteIds }))
}

/** Sites (any status) the supervisor is currently assigned to — for the site filter. */
export async function getSupervisorGalleryFilterOptions() {
  const session = await requireAuth()
  if (session.user.role !== 'supervisor') throw new Error('Unauthorised')

  const assignedSiteIds = await getAssignedSiteIds(session.user.id)
  if (assignedSiteIds.length === 0) return { sites: [] as { id: string; name: string; code: string }[] }

  const siteRows = await db.query.sites.findMany({
    where: inArray(sites.id, assignedSiteIds),
    columns: { id: true, name: true, code: true },
    orderBy: (s, { asc }) => [asc(s.name)],
  })
  return { sites: siteRows }
}

async function resolveUploaderNames(userIds: string[]) {
  if (userIds.length === 0) return [] as { id: string; name: string }[]
  const rows = await db.query.users.findMany({
    where: (u, { inArray: ia }) => ia(u.id, userIds),
    columns: { id: true, name: true },
    with: { employee: { columns: { name: true } } },
  })
  return rows
    .map((u) => ({ id: u.id, name: u.employee?.name ?? u.name }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

// ─── Uploadable sites (for the upload dialog dropdown) ─────────────────────────

export async function getUploadableSites() {
  const session = await requireAuth()
  if (session.user.role === 'admin') {
    return db.query.sites.findMany({
      where: eq(sites.status, 'active'),
      columns: { id: true, name: true, code: true },
      orderBy: (s, { asc }) => [asc(s.name)],
    })
  }
  const assignedSiteIds = await getAssignedSiteIds(session.user.id)
  if (assignedSiteIds.length === 0) return []
  return db.query.sites.findMany({
    where: and(inArray(sites.id, assignedSiteIds), eq(sites.status, 'active')),
    columns: { id: true, name: true, code: true },
    orderBy: (s, { asc }) => [asc(s.name)],
  })
}

// ─── Upload (batch) ───────────────────────────────────────────────────────────

export async function uploadSitePhotos(formData: FormData): Promise<UploadResult> {
  const session = await requireAuth()
  const isAdmin = session.user.role === 'admin'

  const rawSiteId = String(formData.get('siteId') ?? '')
  const siteId = rawSiteId || null
  const description = String(formData.get('description') ?? '').trim() || null
  const tags = formData.getAll('tags').map(String)
  const files = formData.getAll('files').filter((f): f is File => f instanceof File)

  if (tags.some((t) => !(PHOTO_TAGS as readonly string[]).includes(t))) {
    throw new Error('Invalid tag')
  }
  // The 'site' tag is an attachment promise — it must come with a site.
  if (tags.includes('site') && !siteId) {
    throw new Error("Select a site for the 'site' tag")
  }
  if (files.length === 0) throw new Error('No photos provided')
  if (files.length > MAX_BATCH) throw new Error(`Maximum ${MAX_BATCH} photos per batch`)

  let cityId: string | null = null

  if (siteId) {
    if (!z.string().uuid().safeParse(siteId).success) throw new Error('Invalid site')
    // Access + site status (block uploads on non-active sites; existing stay viewable).
    const site = await db.query.sites.findFirst({ where: eq(sites.id, siteId) })
    if (!site) throw new Error('Site not found')
    if (site.status !== 'active') throw new Error('Uploads are disabled for closed sites')
    if (!isAdmin) {
      const assignedSiteIds = await getAssignedSiteIds(session.user.id)
      if (!assignedSiteIds.includes(siteId)) throw new Error('Unauthorised')
    }
    cityId = site.cityId
  }
  // Otherwise the batch is a general, site-less photo (cityId stays null). Allowed
  // for any authenticated user — admins and supervisors share the same upload logic.

  // Commit successes, report failures — never roll back a successful upload.
  const results = await Promise.allSettled(
    files.map(async (file) => {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        throw new Error('Unsupported image type')
      }
      if (file.size > MAX_PHOTO_BYTES) {
        throw new Error('Image exceeds 10 MB')
      }
      const buffer = Buffer.from(await file.arrayBuffer())
      const takenAt = await parseTakenAt(buffer)
      const uploaded = await uploadGalleryImage(file)
      await db.insert(sitePhotos).values({
        siteId,
        cityId,
        uploadedBy: session.user.id,
        description,
        tags,
        cloudinaryPublicId: uploaded.publicId,
        cloudinaryUrl: uploaded.url,
        takenAt,
      })
    })
  )

  const failures: { filename: string; reason: string }[] = []
  results.forEach((r, i) => {
    if (r.status === 'rejected') {
      failures.push({
        filename: files[i].name || `photo-${i + 1}`,
        reason: r.reason instanceof Error ? r.reason.message : 'Upload failed',
      })
    }
  })

  if (siteId) {
    revalidatePath(`/admin/sites/${siteId}/gallery`)
    revalidatePath(`/supervisor/sites/${siteId}/gallery`)
  }
  revalidatePath('/admin/gallery')

  return {
    succeeded: results.length - failures.length,
    failed: failures.length,
    failures,
  }
}

// ─── Modify helper ────────────────────────────────────────────────────────────

/**
 * admin, OR the uploader — site-less (general) photos they own always, site
 * photos only while they are CURRENTLY assigned to that site.
 */
async function canModifySitePhoto(
  session: Awaited<ReturnType<typeof requireAuth>>,
  photo: { uploadedBy: string; siteId: string | null }
): Promise<boolean> {
  if (session.user.role === 'admin') return true
  if (photo.uploadedBy !== session.user.id) return false
  if (!photo.siteId) return true // own site-less photo
  const assignedSiteIds = await getAssignedSiteIds(session.user.id)
  return assignedSiteIds.includes(photo.siteId)
}

/** Revalidates the gallery surfaces a photo can appear on (guards null siteId). */
function revalidatePhotoPaths(siteId: string | null) {
  if (siteId) {
    revalidatePath(`/admin/sites/${siteId}/gallery`)
    revalidatePath(`/supervisor/sites/${siteId}/gallery`)
  }
  revalidatePath('/admin/gallery')
}

// ─── Edit description + tags (per row) ────────────────────────────────────────

const editSchema = z.object({
  photoId: z.string().uuid(),
  description: z.string().max(2000),
  tags: z.array(z.enum(PHOTO_TAGS)),
})

// Empty/whitespace descriptions are stored as NULL (description is optional).

export async function editSitePhoto(input: z.infer<typeof editSchema>) {
  const session = await requireAuth()
  const data = editSchema.parse(input)

  const photo = await db.query.sitePhotos.findFirst({
    where: eq(sitePhotos.id, data.photoId),
    columns: { id: true, uploadedBy: true, siteId: true },
  })
  if (!photo) throw new Error('Photo not found')
  if (!(await canModifySitePhoto(session, photo))) throw new Error('Unauthorised')

  await db
    .update(sitePhotos)
    .set({ description: data.description.trim() || null, tags: data.tags })
    .where(eq(sitePhotos.id, data.photoId))

  revalidatePhotoPaths(photo.siteId)
}

// ─── Hide (soft delete, per row) ──────────────────────────────────────────────

export async function hideSitePhoto(photoId: string) {
  const session = await requireAuth()

  const photo = await db.query.sitePhotos.findFirst({
    where: eq(sitePhotos.id, photoId),
    columns: { id: true, uploadedBy: true, siteId: true },
  })
  if (!photo) throw new Error('Photo not found')
  if (!(await canModifySitePhoto(session, photo))) throw new Error('Unauthorised')

  await db
    .update(sitePhotos)
    .set({ isHidden: true, hiddenAt: new Date(), hiddenBy: session.user.id })
    .where(eq(sitePhotos.id, photoId))

  revalidatePhotoPaths(photo.siteId)
}

// ─── Unhide (admin only) ──────────────────────────────────────────────────────

export async function unhideSitePhoto(photoId: string) {
  await requireAdmin()
  const photo = await db.query.sitePhotos.findFirst({
    where: eq(sitePhotos.id, photoId),
    columns: { siteId: true },
  })
  if (!photo) throw new Error('Photo not found')

  await db
    .update(sitePhotos)
    .set({ isHidden: false, hiddenAt: null, hiddenBy: null })
    .where(eq(sitePhotos.id, photoId))

  revalidatePhotoPaths(photo.siteId)
}

// ─── Hard delete (admin only — Cloudinary first) ──────────────────────────────

export async function deleteSitePhoto(photoId: string) {
  await requireAdmin()
  const photo = await db.query.sitePhotos.findFirst({ where: eq(sitePhotos.id, photoId) })
  if (!photo) throw new Error('Photo not found')

  // Delete the asset FIRST. If Cloudinary fails, abort — never orphan a row
  // pointing at a missing asset.
  await deleteImageStrict(photo.cloudinaryPublicId)
  await db.delete(sitePhotos).where(eq(sitePhotos.id, photoId))

  revalidatePhotoPaths(photo.siteId)
}

// ─── Dashboard previews ───────────────────────────────────────────────────────

export async function getRecentSitePhotosForAdmin(limit = 8): Promise<GalleryPhoto[]> {
  const session = await requireAdmin()
  const rows = (await db.query.sitePhotos.findMany({
    where: eq(sitePhotos.isHidden, false),
    orderBy: orderByTaken,
    limit,
    with: photoWith,
  })) as unknown as RawPhoto[]
  return rows.map((r) => shapePhoto(r, { isAdmin: true, userId: session.user.id, assignedSiteIds: [] }))
}

export async function getRecentSitePhotosForSupervisor(limit = 6): Promise<GalleryPhoto[]> {
  const session = await requireAuth()
  const assignedSiteIds = await getAssignedSiteIds(session.user.id)
  const rows = (await db.query.sitePhotos.findMany({
    where: and(supervisorScope(session.user.id, assignedSiteIds), eq(sitePhotos.isHidden, false)),
    orderBy: orderByTaken,
    limit,
    with: photoWith,
  })) as unknown as RawPhoto[]
  return rows.map((r) => shapePhoto(r, { isAdmin: false, userId: session.user.id, assignedSiteIds }))
}
