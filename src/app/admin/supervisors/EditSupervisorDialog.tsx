'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, Controller } from 'react-hook-form'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select'
import { updateSupervisor } from '@/actions/supervisors'

type City = { id: string; name: string }
type Supervisor = {
  id: string
  name: string
  phone: string | null
  joinDate: Date | null
  salaryMonthly: string | null
  homeCity: City | null
}

const schema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  phone: z.string().max(15).optional(),
  joinDate: z.string().optional(),
  salaryMonthly: z.string().optional(),
  cityId: z.string().uuid().optional(),
})
type FormValues = z.infer<typeof schema>

function toDateInputValue(d: Date | null): string {
  if (!d) return ''
  return new Date(d).toISOString().slice(0, 10)
}

export function EditSupervisorDialog({
  supervisor,
  cities,
  open,
  onOpenChange,
}: {
  supervisor: Supervisor | null
  cities: City[]
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const [selectedCityName, setSelectedCityName] = useState(
    supervisor?.homeCity?.name ?? ''
  )
  const [serverError, setServerError] = useState('')
  const [isPending, startTransition] = useTransition()

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: supervisor
      ? {
          name: supervisor.name,
          phone: supervisor.phone ?? '',
          joinDate: toDateInputValue(supervisor.joinDate),
          salaryMonthly: supervisor.salaryMonthly ?? '',
          cityId: supervisor.homeCity?.id ?? '',
        }
      : undefined,
  })

  // Keep display name in sync with the supervisor prop
  // (values prop handles form fields; selectedCityName drives the Select label)
  const derivedCityName = supervisor?.homeCity?.name ?? ''
  if (selectedCityName !== derivedCityName && !open) {
    // reset display name when dialog closes so it's fresh on reopen
  }

  function handleClose() {
    reset()
    setSelectedCityName(supervisor?.homeCity?.name ?? '')
    setServerError('')
  }

  function onSubmit(values: FormValues) {
    if (!supervisor) return
    setServerError('')
    startTransition(async () => {
      try {
        await updateSupervisor(supervisor.id, {
          name: values.name,
          phone: values.phone || undefined,
          joinDate: values.joinDate || undefined,
          salaryMonthly: values.salaryMonthly || undefined,
          cityId: values.cityId || undefined,
        })
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
        <DialogTitle>Edit Supervisor</DialogTitle>
        {supervisor && (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-sup-name">Name</Label>
              <Input id="edit-sup-name" {...register('name')} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-sup-phone">Phone</Label>
                <Input id="edit-sup-phone" {...register('phone')} placeholder="Optional" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-sup-join-date">Join Date</Label>
                <Input id="edit-sup-join-date" type="date" {...register('joinDate')} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-sup-salary">Monthly Salary (₹)</Label>
                <Input
                  id="edit-sup-salary"
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
                        <span className={field.value ? 'text-foreground' : 'text-muted-foreground'}>
                          {field.value
                            ? (cities.find((c) => c.id === field.value)?.name ?? selectedCityName ?? 'Select city')
                            : 'Select city'}
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
                {isPending ? 'Saving…' : 'Save'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
