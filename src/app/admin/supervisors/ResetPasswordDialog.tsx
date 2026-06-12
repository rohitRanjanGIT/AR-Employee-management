'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff } from 'lucide-react'
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
import { resetSupervisorPassword } from '@/actions/profile'

type Supervisor = { id: string; name: string }

export function ResetPasswordDialog({
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
  const [newPassword, setNewPassword] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  function handleClose() {
    setNewPassword('')
    setShow(false)
    setError('')
  }

  function handleSubmit() {
    if (!supervisor) return
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    setError('')
    startTransition(async () => {
      try {
        await resetSupervisorPassword({ employeeId: supervisor.id, newPassword })
        onOpenChange(false)
        handleClose()
        router.refresh()
        onSuccess?.('Password reset. Share the new password with the supervisor.')
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
      <DialogContent>
        <DialogTitle>Reset Password</DialogTitle>
        {supervisor && (
          <div className="space-y-4 mt-1">
            <p className="text-sm text-muted-foreground">
              Set a new password for{' '}
              <span className="font-medium text-foreground">{supervisor.name}</span>.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="reset-password">New Password</Label>
              <div className="relative">
                <Input
                  id="reset-password"
                  type={show ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value)
                    setError('')
                  }}
                  placeholder="Min. 8 characters"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShow((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
            <p className="text-xs text-yellow-600">
              This will immediately end the supervisor&apos;s current session.
            </p>
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
        )}
        <DialogFooter className="mt-2">
          <DialogClose render={<Button variant="outline" type="button" disabled={isPending} />}>
            Cancel
          </DialogClose>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? 'Resetting…' : 'Reset Password'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
