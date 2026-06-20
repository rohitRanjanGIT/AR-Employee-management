'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  X,
  ChevronLeft,
  ChevronRight,
  Pencil,
  EyeOff,
  Eye,
  Trash2,
} from 'lucide-react'
import { formatDateTime } from '@/lib/utils'
import { lightboxUrl, TAG_LABELS, type PhotoTag, type GalleryPhoto } from '@/lib/site-photos'

export function PhotoLightbox({
  photos,
  index,
  isAdmin,
  onClose,
  onNavigate,
  onEdit,
  onHide,
  onUnhide,
  onDelete,
}: {
  photos: GalleryPhoto[]
  index: number
  isAdmin: boolean
  onClose: () => void
  onNavigate: (next: number) => void
  onEdit: (photo: GalleryPhoto) => void
  onHide: (photo: GalleryPhoto) => void
  onUnhide: (photo: GalleryPhoto) => void
  onDelete: (photo: GalleryPhoto) => void
}) {
  const photo = photos[index]

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft' && index > 0) onNavigate(index - 1)
      if (e.key === 'ArrowRight' && index < photos.length - 1) onNavigate(index + 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [index, photos.length, onClose, onNavigate])

  if (!photo) return null

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/90" onClick={onClose}>
      {/* Top bar */}
      <div
        className="flex items-center justify-end gap-2 p-3"
        onClick={(e) => e.stopPropagation()}
      >
        {photo.canModify && (
          <Button variant="ghost" size="sm" className="text-white hover:bg-white/10 hover:text-white" onClick={() => onEdit(photo)}>
            <Pencil /> Edit
          </Button>
        )}
        {photo.canModify && !photo.isHidden && (
          <Button variant="ghost" size="sm" className="text-white hover:bg-white/10 hover:text-white" onClick={() => onHide(photo)}>
            <EyeOff /> Hide
          </Button>
        )}
        {isAdmin && photo.isHidden && (
          <Button variant="ghost" size="sm" className="text-white hover:bg-white/10 hover:text-white" onClick={() => onUnhide(photo)}>
            <Eye /> Unhide
          </Button>
        )}
        {isAdmin && (
          <Button variant="ghost" size="sm" className="text-red-400 hover:bg-white/10 hover:text-red-300" onClick={() => onDelete(photo)}>
            <Trash2 /> Delete
          </Button>
        )}
        <Button variant="ghost" size="icon-sm" className="text-white hover:bg-white/10 hover:text-white" onClick={onClose}>
          <X />
        </Button>
      </div>

      {/* Image */}
      <div className="relative flex flex-1 items-center justify-center overflow-hidden px-2">
        {index > 0 && (
          <button
            className="absolute left-2 z-10 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
            onClick={(e) => { e.stopPropagation(); onNavigate(index - 1) }}
          >
            <ChevronLeft />
          </button>
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={lightboxUrl(photo.url) ?? photo.url}
          alt={photo.description ?? ''}
          className="max-h-full max-w-full object-contain"
          onClick={(e) => e.stopPropagation()}
        />
        {index < photos.length - 1 && (
          <button
            className="absolute right-2 z-10 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
            onClick={(e) => { e.stopPropagation(); onNavigate(index + 1) }}
          >
            <ChevronRight />
          </button>
        )}
      </div>

      {/* Caption */}
      <div
        className="space-y-2 bg-black/60 p-4 text-white"
        onClick={(e) => e.stopPropagation()}
      >
        {photo.isHidden && (
          <Badge variant="destructive" className="mb-1">Hidden</Badge>
        )}
        {photo.description && <p className="text-sm">{photo.description}</p>}
        {photo.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {photo.tags.map((t) => (
              <Badge key={t} variant="secondary" className="text-xs">
                {TAG_LABELS[t as PhotoTag] ?? t}
              </Badge>
            ))}
          </div>
        )}
        <p className="text-xs text-white/70">
          {photo.siteName ? `${photo.siteName} (${photo.siteCode}) · ` : ''}
          {photo.uploaderName} · {formatDateTime(photo.takenAt ?? photo.uploadedAt)}
        </p>
      </div>
    </div>
  )
}
