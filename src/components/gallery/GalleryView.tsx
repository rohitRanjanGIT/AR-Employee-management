'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
  DialogFooter,
} from '@/components/ui/dialog'
import { ImagePlus, Images, X } from 'lucide-react'
import {
  getSitePhotos,
  getGlobalGallery,
  getSupervisorGallery,
  hideSitePhoto,
  unhideSitePhoto,
  deleteSitePhoto,
} from '@/actions/site-photos'
import {
  PHOTO_TAGS,
  TAG_LABELS,
  type PhotoTag,
  type GalleryPhoto,
  type GalleryFilters,
} from '@/lib/site-photos'
import { PhotoCard } from './PhotoCard'
import { UploadPhotosDialog } from './UploadPhotosDialog'
import { EditPhotoDialog } from './EditPhotoDialog'
import { PhotoLightbox } from './PhotoLightbox'

type Option = { id: string; name: string; code?: string }

export function GalleryView({
  mode,
  siteId,
  isAdmin,
  canUpload,
  uploadableSites,
  initialPhotos,
  uploaders,
  sites = [],
  cities = [],
}: {
  mode: 'site' | 'global' | 'supervisor'
  siteId?: string
  isAdmin: boolean
  canUpload: boolean
  uploadableSites: { id: string; name: string; code: string }[]
  initialPhotos: GalleryPhoto[]
  uploaders: { id: string; name: string }[]
  sites?: Option[]
  cities?: Option[]
}) {
  const router = useRouter()
  const [photos, setPhotos] = useState<GalleryPhoto[]>(initialPhotos)
  const [loading, setLoading] = useState(false)

  // Filters
  const [tag, setTag] = useState('')
  const [uploaderId, setUploaderId] = useState('')
  const [includeHidden, setIncludeHidden] = useState(false)
  const [filterSiteId, setFilterSiteId] = useState('')
  const [filterCityId, setFilterCityId] = useState('')

  // Dialogs
  const [uploadOpen, setUploadOpen] = useState(false)
  const [editing, setEditing] = useState<GalleryPhoto | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [deleting, setDeleting] = useState<GalleryPhoto | null>(null)
  const [deleteError, setDeleteError] = useState('')
  const [deletingBusy, setDeletingBusy] = useState(false)

  const hasFilter =
    !!tag || !!uploaderId || !!filterSiteId || !!filterCityId || includeHidden

  function currentFilters(): GalleryFilters {
    return {
      tags: tag ? [tag as PhotoTag] : undefined,
      uploaderId: uploaderId || undefined,
      includeHidden: includeHidden || undefined,
      siteId: filterSiteId || undefined,
      cityId: filterCityId || undefined,
    }
  }

  async function fetchPhotos(filters: GalleryFilters) {
    if (mode === 'site') return getSitePhotos(siteId!, filters)
    if (mode === 'supervisor') return getSupervisorGallery(filters)
    return getGlobalGallery(filters)
  }

  const firstRun = useRef(true)
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false
      return
    }
    let cancelled = false
    async function run() {
      setLoading(true)
      try {
        const next = await fetchPhotos(currentFilters())
        if (!cancelled) setPhotos(next)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tag, uploaderId, includeHidden, filterSiteId, filterCityId])

  function clearFilters() {
    setTag('')
    setUploaderId('')
    setFilterSiteId('')
    setFilterCityId('')
    setIncludeHidden(false)
  }

  async function refetchAfterMutation() {
    const next = await fetchPhotos(currentFilters())
    setPhotos(next)
    router.refresh()
  }

  async function doHide(photo: GalleryPhoto) {
    await hideSitePhoto(photo.id)
    setLightboxIndex(null)
    await refetchAfterMutation()
  }
  async function doUnhide(photo: GalleryPhoto) {
    await unhideSitePhoto(photo.id)
    await refetchAfterMutation()
  }
  async function confirmDelete() {
    if (!deleting) return
    setDeleteError('')
    setDeletingBusy(true)
    try {
      await deleteSitePhoto(deleting.id)
      setDeleting(null)
      setLightboxIndex(null)
      await refetchAfterMutation()
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setDeletingBusy(false)
    }
  }

  const tagLabel = tag ? TAG_LABELS[tag as PhotoTag] : 'All tags'
  const uploaderName = uploaderId ? uploaders.find((u) => u.id === uploaderId)?.name ?? '' : 'Anyone'
  const filterSiteName = filterSiteId ? sites.find((s) => s.id === filterSiteId)?.name ?? '' : 'All sites'
  const filterCityName = filterCityId ? cities.find((c) => c.id === filterCityId)?.name ?? '' : 'All cities'

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Tag */}
          <Select value={tag} onValueChange={(v: string | null) => setTag(v ?? '')}>
            <SelectTrigger className="w-36">
              <span className="text-sm">
                <span className="text-muted-foreground">Tag: </span>
                {tagLabel}
              </span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All tags</SelectItem>
              {PHOTO_TAGS.map((t) => (
                <SelectItem key={t} value={t}>
                  {TAG_LABELS[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Site (global + supervisor) */}
          {mode !== 'site' && (
            <Select value={filterSiteId} onValueChange={(v: string | null) => setFilterSiteId(v ?? '')}>
              <SelectTrigger className="w-40">
                <span className="truncate text-sm">
                  <span className="text-muted-foreground">Site: </span>
                  {filterSiteName}
                </span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All sites</SelectItem>
                {sites.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* City (global) */}
          {mode === 'global' && (
            <Select value={filterCityId} onValueChange={(v: string | null) => setFilterCityId(v ?? '')}>
              <SelectTrigger className="w-36">
                <span className="truncate text-sm">
                  <span className="text-muted-foreground">City: </span>
                  {filterCityName}
                </span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All cities</SelectItem>
                {cities.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Uploader (admin) */}
          {isAdmin && (
            <Select value={uploaderId} onValueChange={(v: string | null) => setUploaderId(v ?? '')}>
              <SelectTrigger className="w-40">
                <span className="truncate text-sm">
                  <span className="text-muted-foreground">By: </span>
                  {uploaderName}
                </span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Anyone</SelectItem>
                {uploaders.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Include hidden (admin) */}
          {isAdmin && (
            <label className="flex cursor-pointer items-center gap-1.5 text-sm text-muted-foreground">
              <Checkbox checked={includeHidden} onCheckedChange={(c: boolean) => setIncludeHidden(c)} />
              Include hidden
            </label>
          )}

          {hasFilter && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X /> Clear filters
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <p className="text-sm text-muted-foreground">
            {loading ? 'Loading…' : `${photos.length} image${photos.length !== 1 ? 's' : ''}`}
          </p>
          {canUpload && uploadableSites.length > 0 && (
            <Button size="sm" onClick={() => setUploadOpen(true)}>
              <ImagePlus /> Upload
            </Button>
          )}
        </div>
      </div>

      {/* Grid / empty state */}
      {photos.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <Images className="size-10 text-muted-foreground/40" />
          <p className="text-sm font-medium text-muted-foreground">
            {hasFilter ? 'No images match the current filters.' : 'No images uploaded yet.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {photos.map((photo, i) => (
            <PhotoCard
              key={photo.id}
              photo={photo}
              isAdmin={isAdmin}
              showUploader={isAdmin}
              onOpen={() => setLightboxIndex(i)}
              onEdit={() => {
                setEditing(photo)
                setEditOpen(true)
              }}
              onHide={() => doHide(photo)}
              onUnhide={() => doUnhide(photo)}
              onDelete={() => {
                setDeleting(photo)
                setDeleteError('')
              }}
            />
          ))}
        </div>
      )}

      {/* Upload */}
      <UploadPhotosDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        sites={uploadableSites}
        defaultSiteId={mode === 'site' ? siteId : undefined}
      />

      {/* Edit */}
      <EditPhotoDialog
        photo={editing}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSaved={refetchAfterMutation}
      />

      {/* Lightbox */}
      {lightboxIndex !== null && photos[lightboxIndex] && (
        <PhotoLightbox
          photos={photos}
          index={lightboxIndex}
          isAdmin={isAdmin}
          onClose={() => setLightboxIndex(null)}
          onNavigate={setLightboxIndex}
          onEdit={(p) => {
            setLightboxIndex(null)
            setEditing(p)
            setEditOpen(true)
          }}
          onHide={doHide}
          onUnhide={doUnhide}
          onDelete={(p) => {
            setLightboxIndex(null)
            setDeleting(p)
            setDeleteError('')
          }}
        />
      )}

      {/* Delete confirm (admin) */}
      <Dialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogTitle>Delete photo permanently?</DialogTitle>
          <DialogDescription>
            This removes the image from Cloudinary and the database. It cannot be undone.
          </DialogDescription>
          {deleteError && <p className="text-xs text-destructive">{deleteError}</p>}
          <DialogFooter>
            <DialogClose render={<Button variant="outline" size="sm" type="button" />}>
              Cancel
            </DialogClose>
            <Button variant="destructive" size="sm" onClick={confirmDelete} disabled={deletingBusy}>
              {deletingBusy ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
