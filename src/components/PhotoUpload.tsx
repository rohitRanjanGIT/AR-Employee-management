'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Avatar } from '@/components/Avatar'

const ACCEPT = 'image/jpeg,image/png,image/webp,image/heic,image/heif'
const MAX_BYTES = 8 * 1024 * 1024 // 8 MB

/**
 * Resolves the photo fields to send to a create/update action at submit time.
 * Uploads a newly chosen file to Cloudinary; otherwise keeps the existing photo
 * (or clears it when removed). The server action deletes any replaced asset.
 */
export async function resolvePhoto(opts: {
  file: File | null
  removed: boolean
  existing: { publicId: string | null; url: string | null }
  upload: (fd: FormData) => Promise<{ publicId: string; url: string }>
}): Promise<{ photoPublicId?: string; photoUrl?: string }> {
  if (opts.file) {
    const fd = new FormData()
    fd.append('file', opts.file)
    const r = await opts.upload(fd)
    return { photoPublicId: r.publicId, photoUrl: r.url }
  }
  if (opts.removed) return {}
  return {
    photoPublicId: opts.existing.publicId ?? undefined,
    photoUrl: opts.existing.url ?? undefined,
  }
}

/**
 * Optional single-photo picker. Fully client-side: previews via a blob URL and
 * surfaces the chosen `File` (or a removal flag) to the parent through `onChange`.
 * The parent uploads the file to Cloudinary at save time.
 */
export function PhotoUpload({
  name,
  initialUrl,
  onChange,
  disabled,
}: {
  name: string
  initialUrl: string | null
  onChange: (file: File | null, removed: boolean) => void
  disabled?: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [hasFile, setHasFile] = useState(false)
  const [removed, setRemoved] = useState(false)
  const [error, setError] = useState('')

  // Revoke blob URLs to avoid leaks
  useEffect(() => {
    return () => { if (preview) URL.revokeObjectURL(preview) }
  }, [preview])

  function pick(file: File | null) {
    setError('')
    if (preview) URL.revokeObjectURL(preview)
    if (!file) {
      setPreview(null)
      setHasFile(false)
      return
    }
    if (!ACCEPT.split(',').includes(file.type)) {
      setError('Use a JPG, PNG, WEBP or HEIC image.')
      return
    }
    if (file.size > MAX_BYTES) {
      setError('Image must be 8 MB or smaller.')
      return
    }
    setPreview(URL.createObjectURL(file))
    setHasFile(true)
    setRemoved(false)
    onChange(file, false)
  }

  function remove() {
    setError('')
    if (preview) URL.revokeObjectURL(preview)
    setPreview(null)
    setHasFile(false)
    setRemoved(true)
    if (inputRef.current) inputRef.current.value = ''
    onChange(null, true)
  }

  // Shown image: new preview > (existing, unless removed) > placeholder
  const shownSrc = hasFile ? preview : removed ? null : initialUrl
  const showRemove = hasFile || (!removed && !!initialUrl)

  return (
    <div className="space-y-1.5">
      <Label>Profile Photo</Label>
      <div className="flex items-center gap-3">
        <Avatar src={shownSrc} name={name || '?'} size={56} transform={!hasFile} />
        <div className="flex flex-wrap gap-2">
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            className="hidden"
            disabled={disabled}
            onChange={(e) => pick(e.target.files?.[0] ?? null)}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
          >
            {shownSrc ? 'Change' : 'Upload'}
          </Button>
          {showRemove && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              disabled={disabled}
              onClick={remove}
            >
              Remove
            </Button>
          )}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">Optional. JPG, PNG, WEBP or HEIC, up to 8 MB.</p>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
