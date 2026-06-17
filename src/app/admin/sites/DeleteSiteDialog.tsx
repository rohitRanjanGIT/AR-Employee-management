'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogClose,
  DialogFooter,
} from '@/components/ui/dialog'
import { deleteSite } from '@/actions/sites'

type Site = { id: string; name: string }

export function DeleteSiteDialog({
  site,
  open,
  onOpenChange,
}: {
  site: Site | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const [confirmText, setConfirmText] = useState('')
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  function handleClose() {
    setConfirmText('')
    setError('')
  }

  const canDelete = !!site && confirmText.trim() === site.name

  function handleConfirm() {
    if (!site || !canDelete) return
    setError('')
    startTransition(async () => {
      try {
        await deleteSite(site.id)
        onOpenChange(false)
        handleClose()
        router.refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Something went wrong')
      }
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) handleClose()
        onOpenChange(o)
      }}
    >
      <DialogContent showCloseButton={false}>
        <DialogTitle>Delete Site</DialogTitle>
        {site && (
          <div className="space-y-4 mt-1">
            <p className="text-sm text-muted-foreground">
              Permanently deleting{' '}
              <span className="font-medium text-foreground">{site.name}</span> will remove the site
              and <span className="font-medium text-foreground">all related data</span> — attendance
              records, closure snapshots, supervisor assignments and work-type links. This cannot be
              undone. To temporarily close a site, use Deactivate instead.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="delete-site-confirm">
                Type <span className="font-medium text-foreground">{site.name}</span> to confirm
              </Label>
              <Input
                id="delete-site-confirm"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={site.name}
                autoComplete="off"
              />
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
        )}
        <DialogFooter className="mt-2">
          <DialogClose render={<Button variant="outline" type="button" disabled={isPending} />}>
            Cancel
          </DialogClose>
          <Button variant="destructive" onClick={handleConfirm} disabled={isPending || !canDelete}>
            {isPending ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
