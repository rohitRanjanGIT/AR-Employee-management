'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogClose,
  DialogFooter,
} from '@/components/ui/dialog'
import { deactivateAdmin, reactivateAdmin } from '@/actions/admins'

type Admin = { userId: string; name: string }
type Mode = 'deactivate' | 'reactivate'

export function AdminStatusDialog({
  admin,
  mode,
  open,
  onOpenChange,
  onError,
}: {
  admin: Admin | null
  mode: Mode
  open: boolean
  onOpenChange: (open: boolean) => void
  onError?: (msg: string) => void
}) {
  const router = useRouter()
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  const isDeactivate = mode === 'deactivate'

  function handleConfirm() {
    if (!admin) return
    setError('')
    startTransition(async () => {
      try {
        if (isDeactivate) {
          await deactivateAdmin(admin.userId)
        } else {
          await reactivateAdmin(admin.userId)
        }
        onOpenChange(false)
        router.refresh()
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Something went wrong'
        setError(msg)
        onError?.(msg)
      }
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) setError('')
        onOpenChange(o)
      }}
    >
      <DialogContent showCloseButton={false}>
        <DialogTitle>{isDeactivate ? 'Deactivate Admin' : 'Reactivate Admin'}</DialogTitle>
        {admin && (
          <p className="text-sm text-muted-foreground mt-1">
            {isDeactivate ? (
              <>
                Deactivating{' '}
                <span className="font-medium text-foreground">{admin.name}</span> will immediately
                end their session and block login until reactivated.
              </>
            ) : (
              <>
                Reactivate{' '}
                <span className="font-medium text-foreground">{admin.name}</span>? They will be able
                to log in again.
              </>
            )}
          </p>
        )}
        {error && <p className="text-xs text-destructive mt-2">{error}</p>}
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
