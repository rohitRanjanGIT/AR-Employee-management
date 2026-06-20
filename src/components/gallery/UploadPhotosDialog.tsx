'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { UploadCloud, X, Loader2 } from 'lucide-react'
import { uploadSitePhotos } from '@/actions/site-photos'
import {
  PHOTO_TAGS,
  TAG_LABELS,
  SITE_TAG,
  MAX_BATCH,
  MAX_PHOTO_BYTES,
  ACCEPTED_TYPES,
  ACCEPT_ATTR,
  type PhotoTag,
  type UploadResult,
} from '@/lib/site-photos'

type SiteOption = { id: string; name: string; code: string }

export function UploadPhotosDialog({
  open,
  onOpenChange,
  sites,
  defaultSiteId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  sites: SiteOption[]
  defaultSiteId?: string
}) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [siteId, setSiteId] = useState(defaultSiteId ?? (sites.length === 1 ? sites[0].id : ''))
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState<PhotoTag[]>(defaultSiteId ? [SITE_TAG] : [])
  const [files, setFiles] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<UploadResult | null>(null)

  const siteName = sites.find((s) => s.id === siteId)?.name ?? ''
  const wantsSiteTag = tags.includes(SITE_TAG)

  // The site picker appears only when attaching the photos to a site:
  //  - per-site page (defaultSiteId): site is fixed, no picker.
  //  - otherwise (admin or supervisor): revealed by choosing the 'Site' tag.
  //    No 'Site' tag ⇒ a general, site-less photo.
  const showSitePicker = !defaultSiteId && wantsSiteTag

  // Keep blob previews in sync with the selected files (revoke on change/unmount).
  useEffect(() => {
    const urls = files.map((f) => URL.createObjectURL(f))
    setPreviews(urls)
    return () => urls.forEach((u) => URL.revokeObjectURL(u))
  }, [files])

  function reset() {
    setDescription('')
    setTags(defaultSiteId ? [SITE_TAG] : [])
    setFiles([])
    setError('')
    setResult(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  function addFiles(picked: FileList | null) {
    if (!picked) return
    setError('')
    const next = [...files]
    for (const f of Array.from(picked)) {
      if (!ACCEPTED_TYPES.includes(f.type)) {
        setError(`${f.name}: unsupported type. Use JPG, PNG, WEBP or HEIC.`)
        continue
      }
      if (f.size > MAX_PHOTO_BYTES) {
        setError(`${f.name}: exceeds 10 MB.`)
        continue
      }
      if (next.length >= MAX_BATCH) {
        setError(`Maximum ${MAX_BATCH} photos per batch.`)
        break
      }
      next.push(f)
    }
    setFiles(next)
    if (inputRef.current) inputRef.current.value = ''
  }

  function toggleTag(tag: PhotoTag) {
    setTags((t) => (t.includes(tag) ? t.filter((x) => x !== tag) : [...t, tag]))
  }

  async function submit() {
    setError('')
    if (files.length === 0) return setError('Add at least one photo.')

    // Resolve the site the batch attaches to (none for general/site-less photos).
    let submitSiteId = ''
    if (defaultSiteId) {
      submitSiteId = defaultSiteId
    } else if (wantsSiteTag) {
      if (!siteId) return setError("Select a site for the 'Site' tag.")
      submitSiteId = siteId
    }

    setSubmitting(true)
    try {
      const fd = new FormData()
      if (submitSiteId) fd.append('siteId', submitSiteId)
      fd.append('description', description.trim())
      tags.forEach((t) => fd.append('tags', t))
      files.forEach((f) => fd.append('files', f))
      const res = await uploadSitePhotos(fd)
      setResult(res)
      router.refresh()
      if (res.failed === 0) {
        reset()
        onOpenChange(false)
      } else {
        const failedNames = new Set(res.failures.map((f) => f.filename))
        setFiles((prev) => prev.filter((f) => failedNames.has(f.name)))
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset()
        onOpenChange(o)
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogTitle>Upload Photos</DialogTitle>
        <DialogDescription>
          Up to {MAX_BATCH} photos, 10 MB each. One description and tag set applies to the whole
          batch.
        </DialogDescription>

        <div className="space-y-4">
          {/* Tags — asked first */}
          <div className="space-y-1.5">
            <Label>Tags</Label>
            <div className="flex flex-wrap gap-1.5">
              {PHOTO_TAGS.map((tag) => {
                const active = tags.includes(tag)
                return (
                  <button key={tag} type="button" onClick={() => toggleTag(tag)}>
                    <Badge variant={active ? 'default' : 'outline'} className="cursor-pointer">
                      {TAG_LABELS[tag]}
                    </Badge>
                  </button>
                )
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              Optional. Pick the “Site” tag to attach the photos to a specific site.
            </p>
          </div>

          {/* Site — fixed on a site page, or revealed by the rules above */}
          {defaultSiteId ? (
            <div className="space-y-1.5">
              <Label>Site</Label>
              <p className="text-sm">{siteName}</p>
            </div>
          ) : showSitePicker ? (
            <div className="space-y-1.5">
              <Label>Site (required)</Label>
              <Select value={siteId} onValueChange={(v: string | null) => setSiteId(v ?? '')}>
                <SelectTrigger className="w-full">
                  <span className={siteName ? 'text-foreground' : 'text-muted-foreground'}>
                    {siteName || 'Select a site'}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  {sites.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} ({s.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {sites.length === 0 && (
                <p className="text-xs text-muted-foreground">No sites available for upload.</p>
              )}
            </div>
          ) : null}

          {/* Dropzone */}
          <div className="space-y-1.5">
            <Label>Photos ({files.length}/{MAX_BATCH})</Label>
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPT_ATTR}
              multiple
              className="sr-only"
              onChange={(e) => addFiles(e.target.files)}
            />
            <div
              role="button"
              tabIndex={0}
              onClick={() => files.length < MAX_BATCH && inputRef.current?.click()}
              onKeyDown={(e) => {
                if ((e.key === 'Enter' || e.key === ' ') && files.length < MAX_BATCH) {
                  e.preventDefault()
                  inputRef.current?.click()
                }
              }}
              className="cursor-pointer rounded-md border-2 border-dashed border-muted-foreground/30 p-6 text-center transition-colors hover:border-muted-foreground/50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
              aria-disabled={files.length >= MAX_BATCH}
            >
              <UploadCloud className="mx-auto size-6 text-muted-foreground" />
              <p className="mt-1 text-sm">Click to select images</p>
              <p className="text-xs text-muted-foreground">PNG, JPG, WEBP or HEIC up to 10 MB</p>
            </div>

            {/* Preview grid */}
            {previews.length > 0 && (
              <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
                {previews.map((src, i) => (
                  <div
                    key={i}
                    className="group relative aspect-square overflow-hidden rounded-md border bg-muted"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt={files[i]?.name ?? ''} className="size-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
                      className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-red-600"
                      title="Remove"
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="photo-description">Description (optional)</Label>
            <textarea
              id="photo-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              placeholder="What do these photos show?"
            />
          </div>

          {result && result.failed > 0 && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
              <p className="font-medium">
                {result.succeeded} uploaded, {result.failed} failed.
              </p>
              <ul className="mt-1 list-disc pl-4">
                {result.failures.map((f, i) => (
                  <li key={i}>
                    {f.filename}: {f.reason}
                  </li>
                ))}
              </ul>
              <p className="mt-1">The failed files are still queued — use Retry failed.</p>
            </div>
          )}

          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" size="sm" type="button" />}>
            Cancel
          </DialogClose>
          <Button
            type="button"
            size="sm"
            onClick={() => submit()}
            disabled={submitting || files.length === 0}
          >
            {submitting && <Loader2 className="animate-spin" />}
            {submitting
              ? 'Uploading…'
              : result && result.failed > 0
                ? 'Retry failed'
                : 'Upload'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
