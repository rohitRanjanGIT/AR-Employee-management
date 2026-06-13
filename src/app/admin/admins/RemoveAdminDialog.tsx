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
import { removeAdmin } from '@/actions/admins'

type Admin = { userId: string; name: string }

export function RemoveAdminDialog({
  admin,
  open,
  onOpenChange,
  onSuccess,
}: {
  admin: Admin | null
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

  const canRemove = !!admin && confirmText.trim() === admin.name

  function handleConfirm() {
    if (!admin || !canRemove) return
    setError('')
    startTransition(async () => {
      try {
        await removeAdmin(admin.userId)
        onOpenChange(false)
        handleClose()
        router.refresh()
        onSuccess?.(`${admin.name} removed permanently.`)
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
        <DialogTitle>Remove Admin</DialogTitle>
        {admin && (
          <div className="space-y-4 mt-1">
            <p className="text-sm text-muted-foreground">
              Permanently removing{' '}
              <span className="font-medium text-foreground">{admin.name}</span> will delete their
              account and end all their sessions. This cannot be undone. To temporarily suspend
              access, use Deactivate instead.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="remove-admin-confirm">
                Type <span className="font-medium text-foreground">{admin.name}</span> to confirm
              </Label>
              <Input
                id="remove-admin-confirm"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={admin.name}
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
