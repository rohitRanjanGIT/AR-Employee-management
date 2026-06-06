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
import { deactivateSupervisor, reactivateSupervisor } from '@/actions/supervisors'

type Supervisor = { id: string; name: string }
type Mode = 'deactivate' | 'reactivate'

export function DeactivateConfirmDialog({
  supervisor,
  mode,
  open,
  onOpenChange,
}: {
  supervisor: Supervisor | null
  mode: Mode
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleConfirm() {
    if (!supervisor) return
    startTransition(async () => {
      if (mode === 'deactivate') {
        await deactivateSupervisor(supervisor.id)
      } else {
        await reactivateSupervisor(supervisor.id)
      }
      onOpenChange(false)
      router.refresh()
    })
  }

  const isDeactivate = mode === 'deactivate'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false}>
        <DialogTitle>{isDeactivate ? 'Deactivate Supervisor' : 'Reactivate Supervisor'}</DialogTitle>
        {supervisor && (
          <p className="text-sm text-muted-foreground mt-1">
            {isDeactivate ? (
              <>
                Deactivating{' '}
                <span className="font-medium text-foreground">{supervisor.name}</span> will remove
                them from all site assignments and immediately end their session. They will not be
                able to log in until reactivated.
              </>
            ) : (
              <>
                Reactivate{' '}
                <span className="font-medium text-foreground">{supervisor.name}</span>? They will be
                able to log in again.
              </>
            )}
          </p>
        )}
        <DialogFooter className="mt-2">
          <DialogClose render={<Button variant="outline" disabled={isPending} />}>Cancel</DialogClose>
          <Button
            variant={isDeactivate ? 'destructive' : 'default'}
            disabled={isPending}
            onClick={handleConfirm}
          >
            {isPending
              ? isDeactivate
                ? 'Deactivating…'
                : 'Reactivating…'
              : isDeactivate
                ? 'Deactivate'
                : 'Reactivate'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
