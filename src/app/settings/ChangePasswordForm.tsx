'use client'

import { useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { changeOwnPassword } from '@/actions/profile'

const schema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string().min(1, 'Please confirm your new password'),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })
type FormValues = z.infer<typeof schema>

export function ChangePasswordForm() {
  const [serverError, setServerError] = useState('')
  const [success, setSuccess] = useState(false)
  const [show, setShow] = useState(false)
  const [isPending, startTransition] = useTransition()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  function onSubmit(values: FormValues) {
    setServerError('')
    setSuccess(false)
    startTransition(async () => {
      try {
        await changeOwnPassword({
          currentPassword: values.currentPassword,
          newPassword: values.newPassword,
        })
        setSuccess(true)
        reset()
      } catch (e) {
        setServerError(e instanceof Error ? e.message : 'Something went wrong')
      }
    })
  }

  return (
    <div className="rounded-lg border p-5">
      <h2 className="text-base font-semibold">Change Password</h2>
      <p className="text-sm text-muted-foreground mt-0.5">
        Enter your current password to set a new one.
      </p>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-4">
        <div className="space-y-1.5">
          <Label htmlFor="current-password">Current Password</Label>
          <Input
            id="current-password"
            type={show ? 'text' : 'password'}
            {...register('currentPassword')}
            onChange={() => setSuccess(false)}
          />
          {errors.currentPassword && (
            <p className="text-xs text-destructive">{errors.currentPassword.message}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="new-password">New Password</Label>
          <div className="relative">
            <Input
              id="new-password"
              type={show ? 'text' : 'password'}
              {...register('newPassword')}
              placeholder="Min. 8 characters"
              className="pr-10"
              onChange={() => setSuccess(false)}
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
          {errors.newPassword && (
            <p className="text-xs text-destructive">{errors.newPassword.message}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirm-password">Confirm New Password</Label>
          <Input
            id="confirm-password"
            type={show ? 'text' : 'password'}
            {...register('confirmPassword')}
            onChange={() => setSuccess(false)}
          />
          {errors.confirmPassword && (
            <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>
          )}
        </div>
        {serverError && <p className="text-xs text-destructive">{serverError}</p>}
        {success && <p className="text-xs text-green-600">Password changed.</p>}
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Saving…' : 'Change password'}
        </Button>
      </form>
    </div>
  )
}
