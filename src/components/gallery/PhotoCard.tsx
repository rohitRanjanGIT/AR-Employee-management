'use client'

import { Pencil, Trash2, EyeOff, Eye } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { gridUrl, tagColor, TAG_LABELS, relativeTime, type PhotoTag, type GalleryPhoto } from '@/lib/site-photos'

/**
 * Square gallery cell. Layered, hover-revealed chrome:
 *  - always-visible color-coded tag pills (top-left)
 *  - hover edit/hide/delete circular buttons (top-right)
 *  - hover gradient info bar (uploader [admin only] + date)
 * The image area opens the lightbox; action buttons stop propagation.
 */
export function PhotoCard({
  photo,
  isAdmin,
  showUploader,
  onOpen,
  onEdit,
  onHide,
  onUnhide,
  onDelete,
}: {
  photo: GalleryPhoto
  isAdmin: boolean
  showUploader: boolean
  onOpen: () => void
  onEdit: () => void
  onHide: () => void
  onUnhide: () => void
  onDelete: () => void
}) {
  const date = formatDate(photo.takenAt ?? photo.uploadedAt)

  return (
    <div className="group relative aspect-square overflow-hidden rounded-lg border bg-muted">
      {/* Image (click → lightbox) */}
      <button type="button" onClick={onOpen} className="absolute inset-0 size-full">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={gridUrl(photo.url) ?? photo.url}
          alt={photo.description ?? ''}
          className="size-full object-cover transition-transform duration-200 group-hover:scale-105"
        />
      </button>

      {/* Tag pills, top-left, always visible */}
      <div className="pointer-events-none absolute left-2 top-2 flex max-w-[75%] flex-wrap gap-1">
        {photo.isHidden && (
          <span className="rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-white">
            Hidden
          </span>
        )}
        {photo.tags.map((t) => (
          <span
            key={t}
            className={`inline-block max-w-full truncate rounded px-1.5 py-0.5 text-[10px] font-semibold text-white ${tagColor(t)}`}
          >
            {TAG_LABELS[t as PhotoTag] ?? t}
            {t === 'site' && photo.siteCode ? ` · ${photo.siteCode}` : ''}
          </span>
        ))}
      </div>

      {/* Action buttons, top-right, hover only */}
      <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        {photo.canModify && (
          <button
            type="button"
            onClick={onEdit}
            title="Edit"
            className="flex size-7 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-primary"
          >
            <Pencil className="size-3.5" />
          </button>
        )}
        {photo.canModify && !photo.isHidden && (
          <button
            type="button"
            onClick={onHide}
            title="Hide"
            className="flex size-7 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-primary"
          >
            <EyeOff className="size-3.5" />
          </button>
        )}
        {isAdmin && photo.isHidden && (
          <button
            type="button"
            onClick={onUnhide}
            title="Unhide"
            className="flex size-7 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-primary"
          >
            <Eye className="size-3.5" />
          </button>
        )}
        {isAdmin && (
          <button
            type="button"
            onClick={onDelete}
            title="Delete"
            className="flex size-7 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-red-600"
          >
            <Trash2 className="size-3.5" />
          </button>
        )}
      </div>

      {/* Bottom info bar, gradient, hover only */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3 opacity-0 transition-opacity group-hover:opacity-100">
        {showUploader && (
          <p className="truncate text-xs font-medium text-white">{photo.uploaderName}</p>
        )}
        <p className="text-xs text-white/70">{relativeTime(photo.takenAt ?? photo.uploadedAt)} · {date}</p>
      </div>
    </div>
  )
}
