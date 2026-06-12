'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { updateOwnProfile } from '@/actions/profile'

const schema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  phone: z.string().max(15).optional(),
})
type FormValues = z.infer<typeof schema>

export function ProfileForm({ name, phone }: { name: string; phone: string }) {
  const router = useRouter()
  const [serverError, setServerError] = useState('')
  const [success, setSuccess] = useState(false)
  const [isPending, startTransition] = useTransition()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: { name, phone: phone ?? '' },
  })

  function onSubmit(values: FormValues) {
    setServerError('')
    setSuccess(false)
    startTransition(async () => {
      try {
        await updateOwnProfile({ name: values.name, phone: values.phone || undefined })
        setSuccess(true)
        router.refresh()
      } catch (e) {
        setServerError(e instanceof Error ? e.message : 'Something went wrong')
      }
    })
  }

  return (
    <div className="rounded-lg border p-5">
      <h2 className="text-base font-semibold">Profile</h2>
      <p className="text-sm text-muted-foreground mt-0.5">Update your name and phone number.</p>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-4">
        <div className="space-y-1.5">
          <Label htmlFor="profile-name">Name</Label>
          <Input id="profile-name" {...register('name')} onChange={() => setSuccess(false)} />
          {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="profile-phone">Phone</Label>
          <Input id="profile-phone" {...register('phone')} placeholder="Optional" onChange={() => setSuccess(false)} />
          {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
        </div>
        {serverError && <p className="text-xs text-destructive">{serverError}</p>}
        {success && <p className="text-xs text-green-600">Profile updated.</p>}
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Saving…' : 'Save changes'}
        </Button>
      </form>
    </div>
  )
}
