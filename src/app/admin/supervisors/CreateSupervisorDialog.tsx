'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
  DialogClose,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select'
import { createSupervisor } from '@/actions/supervisors'

type City = { id: string; name: string }

const schema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  email: z.string().email('Valid email required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  phone: z.string().max(15).optional(),
  joinDate: z.string().optional(),
  salaryMonthly: z.string().optional(),
  cityId: z.string().uuid().optional(),
})
type FormValues = z.infer<typeof schema>

export function CreateSupervisorDialog({ cities }: { cities: City[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [selectedCityName, setSelectedCityName] = useState('')
  const [serverError, setServerError] = useState('')
  const [isPending, startTransition] = useTransition()

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  function handleClose() {
    reset()
    setSelectedCityName('')
    setServerError('')
    setShowPassword(false)
  }

  function onSubmit(values: FormValues) {
    setServerError('')
    startTransition(async () => {
      try {
        await createSupervisor(values)
        handleClose()
        setOpen(false)
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
        setOpen(o)
      }}
    >
      <DialogTrigger render={<Button><Plus className="size-4" />Create Supervisor</Button>} />
      <DialogContent className="sm:max-w-lg">
        <DialogTitle>Create Supervisor</DialogTitle>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label htmlFor="sup-name">Name</Label>
            <Input id="sup-name" {...register('name')} placeholder="Full name" />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sup-email">Email</Label>
            <Input id="sup-email" type="email" {...register('email')} placeholder="supervisor@example.com" />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sup-password">Password</Label>
            <div className="relative">
              <Input
                id="sup-password"
                type={showPassword ? 'text' : 'password'}
                {...register('password')}
                placeholder="Min. 8 characters"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
            <p className="text-xs text-muted-foreground">
              Share this with the supervisor — they cannot reset it themselves.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="sup-phone">Phone</Label>
              <Input id="sup-phone" {...register('phone')} placeholder="Optional" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sup-join-date">Join Date</Label>
              <Input id="sup-join-date" type="date" {...register('joinDate')} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="sup-salary">Monthly Salary (₹)</Label>
              <Input
                id="sup-salary"
                type="number"
                step="0.01"
                {...register('salaryMonthly')}
                placeholder="Optional"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Home City</Label>
              <Controller
                control={control}
                name="cityId"
                render={({ field }) => (
                  <Select
                    value={field.value ?? ''}
                    onValueChange={(v) => {
                      field.onChange(v ?? '')
                      setSelectedCityName(cities.find((c) => c.id === v)?.name ?? '')
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <span className={selectedCityName ? 'text-foreground' : 'text-muted-foreground'}>
                        {selectedCityName || 'Select city'}
                      </span>
                    </SelectTrigger>
                    <SelectContent>
                      {cities.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          {serverError && <p className="text-xs text-destructive">{serverError}</p>}

          <DialogFooter>
            <DialogClose render={<Button variant="outline" type="button" />}>Cancel</DialogClose>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Creating…' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
