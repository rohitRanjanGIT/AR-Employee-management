'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogClose,
  DialogFooter,
} from '@/components/ui/dialog'
import { deactivateSite } from '@/actions/sites'

type Site = { id: string; name: string }

export function DeactivateSiteDialog({
  site,
  open,
  onOpenChange,
}: {
  site: Site | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleConfirm() {
    if (!site) return
    startTransition(async () => {
      await deactivateSite(site.id)
      onOpenChange(false)
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false}>
        <DialogTitle>Deactivate Site</DialogTitle>
        {site && (
          <p className="text-sm text-muted-foreground mt-1">
            Deactivating <span className="font-medium text-foreground">{site.name}</span> will remove
            all supervisor assignments and create a permanent closure snapshot. This cannot be undone.
          </p>
        )}
        <DialogFooter className="mt-2">
          <DialogClose render={<Button variant="outline" disabled={isPending} />}>Cancel</DialogClose>
          <Button variant="destructive" disabled={isPending} onClick={handleConfirm}>
            {isPending ? 'Deactivating…' : 'Deactivate'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
