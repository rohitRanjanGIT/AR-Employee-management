'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ImagePlus } from 'lucide-react'
import { thumbUrl, relativeTime, type GalleryPhoto } from '@/lib/site-photos'
import { UploadPhotosDialog } from './UploadPhotosDialog'

/**
 * Dashboard photo teaser. Two variants:
 *  - 'grid'  — dense 4-col grid of 80px thumbnails (admin "recent uploads").
 *  - 'strip' — horizontal scroll of 80px squares + optional trailing Upload tile.
 */
export function RecentPhotosStrip({
  photos,
  basePath,
  variant = 'strip',
  showUpload = false,
  uploadableSites = [],
  globalHref = '/admin/gallery',
}: {
  photos: GalleryPhoto[]
  /** e.g. '/admin/sites' or '/supervisor/sites' — thumbnail links to `${basePath}/${siteId}/gallery`. */
  basePath: string
  variant?: 'grid' | 'strip'
  showUpload?: boolean
  uploadableSites?: { id: string; name: string; code: string }[]
  /** Where site-less (general) photos link to. */
  globalHref?: string
}) {
  const [uploadOpen, setUploadOpen] = useState(false)

  // Dashboard widgets stay quiet when there's nothing to show (unless an Upload tile is wanted).
  if (photos.length === 0 && !showUpload) return null

  const thumb = (p: GalleryPhoto) => (
    <Link
      key={p.id}
      href={p.siteId ? `${basePath}/${p.siteId}/gallery` : globalHref}
      className="group relative size-20 shrink-0 overflow-hidden rounded-lg border bg-muted"
      title={`${p.siteCode ?? 'General'} · ${p.uploaderName} · ${relativeTime(p.takenAt ?? p.uploadedAt)}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={thumbUrl(p.url) ?? p.url}
        alt={p.description ?? ''}
        className="size-full object-cover transition-transform group-hover:scale-105"
      />
    </Link>
  )

  return (
    <>
      {variant === 'grid' ? (
        <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6 lg:grid-cols-8">
          {photos.map(thumb)}
        </div>
      ) : (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {photos.map(thumb)}
          {showUpload && uploadableSites.length > 0 && (
            <button
              type="button"
              onClick={() => setUploadOpen(true)}
              className="flex size-20 shrink-0 flex-col items-center justify-center gap-1 rounded-lg border border-dashed bg-muted/30 text-muted-foreground transition-colors hover:bg-muted"
            >
              <ImagePlus className="size-5" />
              <span className="text-[11px]">Upload</span>
            </button>
          )}
        </div>
      )}

      {showUpload && (
        <UploadPhotosDialog
          open={uploadOpen}
          onOpenChange={setUploadOpen}
          sites={uploadableSites}
        />
      )}
    </>
  )
}
