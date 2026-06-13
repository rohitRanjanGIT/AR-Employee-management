'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
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
import { updateAdmin } from '@/actions/admins'

type Admin = { userId: string; name: string; email: string }

const schema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
})
type FormValues = z.infer<typeof schema>

export function EditAdminDialog({
  admin,
  open,
  onOpenChange,
}: {
  admin: Admin | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const [serverError, setServerError] = useState('')
  const [isPending, startTransition] = useTransition()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: admin ? { name: admin.name } : undefined,
  })

  function handleClose() {
    reset()
    setServerError('')
  }

  function onSubmit(values: FormValues) {
    if (!admin) return
    setServerError('')
    startTransition(async () => {
      try {
        await updateAdmin(admin.userId, { name: values.name })
        onOpenChange(false)
        router.refresh()
      } catch (e) {
        setServerError(e instanceof Error ? e.message : 'Something went wrong')
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
      <DialogContent className="sm:max-w-lg">
        <DialogTitle>Edit Admin</DialogTitle>
        {admin && (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-admin-name">Name</Label>
              <Input id="edit-admin-name" {...register('name')} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input value={admin.email} disabled />
              <p className="text-xs text-muted-foreground">
                The login email cannot be changed. To reset access, use Reset Password.
              </p>
            </div>

            {serverError && <p className="text-xs text-destructive">{serverError}</p>}

            <DialogFooter>
              <DialogClose render={<Button variant="outline" type="button" />}>Cancel</DialogClose>
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Saving…' : 'Save'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
