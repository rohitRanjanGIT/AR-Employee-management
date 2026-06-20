'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogClose,
  DialogFooter,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { editSitePhoto } from '@/actions/site-photos'
import { PHOTO_TAGS, TAG_LABELS, type PhotoTag, type GalleryPhoto } from '@/lib/site-photos'

export function EditPhotoDialog({
  photo,
  open,
  onOpenChange,
  onSaved,
}: {
  photo: GalleryPhoto | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}) {
  const router = useRouter()
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState<PhotoTag[]>([])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  // Sync local state when a new photo opens.
  const [lastId, setLastId] = useState<string | null>(null)
  if (photo && photo.id !== lastId) {
    setLastId(photo.id)
    setDescription(photo.description ?? '')
    setTags(photo.tags.filter((t): t is PhotoTag => (PHOTO_TAGS as readonly string[]).includes(t)))
    setError('')
  }

  function toggleTag(tag: PhotoTag) {
    setTags((t) => (t.includes(tag) ? t.filter((x) => x !== tag) : [...t, tag]))
  }

  async function save() {
    if (!photo) return
    setError('')
    setSaving(true)
    try {
      await editSitePhoto({ photoId: photo.id, description: description.trim(), tags })
      router.refresh()
      onSaved()
      onOpenChange(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogTitle>Edit Photo</DialogTitle>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="edit-description">Description (optional)</Label>
            <textarea
              id="edit-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </div>
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
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" size="sm" type="button" />}>
            Cancel
          </DialogClose>
          <Button type="button" size="sm" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
