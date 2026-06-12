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
import { removeSupervisor } from '@/actions/profile'

type Supervisor = { id: string; name: string }

export function RemoveSupervisorDialog({
  supervisor,
  open,
  onOpenChange,
  onSuccess,
}: {
  supervisor: Supervisor | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: (msg: string) => void
}) {
  const router = useRouter()
  const [confirmText, setConfirmText] = useState('')
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  function handleClose() {
    setConfirmText('')
    setError('')
  }

  const canRemove = !!supervisor && confirmText.trim() === supervisor.name

  function handleConfirm() {
    if (!supervisor || !canRemove) return
    setError('')
    startTransition(async () => {
      try {
        await removeSupervisor(supervisor.id)
        onOpenChange(false)
        handleClose()
        router.refresh()
        onSuccess?.(`${supervisor.name} removed permanently.`)
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
        <DialogTitle>Remove Supervisor</DialogTitle>
        {supervisor && (
          <div className="space-y-4 mt-1">
            <p className="text-sm text-muted-foreground">
              Permanently removing{' '}
              <span className="font-medium text-foreground">{supervisor.name}</span> will delete all
              their data including site assignments. This cannot be undone. If you want to
              temporarily suspend access, use Deactivate instead.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="remove-confirm">
                Type <span className="font-medium text-foreground">{supervisor.name}</span> to
                confirm
              </Label>
              <Input
                id="remove-confirm"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={supervisor.name}
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
          <Button variant="destructive" onClick={handleConfirm} disabled={isPending || !canRemove}>
            {isPending ? 'Removing…' : 'Remove'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
