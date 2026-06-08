'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus } from 'lucide-react'
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
import { createWorkerAsAdmin } from '@/actions/workers'
import { validateAadhaar } from '@/lib/aadhaar-validate'

type City = { id: string; name: string }

const CATEGORIES = [
  { value: 'skilled', label: 'Skilled' },
  { value: 'semi_skilled', label: 'Semi-Skilled' },
  { value: 'helper', label: 'Helper' },
] as const

const schema = z.object({
  cityId: z.string().uuid('City is required'),
  name: z.string().min(1, 'Name is required').max(200),
  age: z.string().min(1, 'Age is required').refine(
    (v) => { const n = parseInt(v, 10); return n >= 18 && n <= 45 },
    'Age must be between 18 and 45'
  ),
  phone: z.string().max(15).optional(),
  emergencyContact: z.string().max(200).optional(),
  category: z.enum(['skilled', 'semi_skilled', 'helper']),
  wageDaily: z.string().min(1, 'Daily wage is required'),
  otRate2hr: z.string().optional(),
  otRate4hr: z.string().optional(),
  otRate6hr: z.string().optional(),
  aadhaar: z.string()
    .min(1, 'Aadhaar is required')
    .length(12, 'Must be exactly 12 digits')
    .regex(/^\d{12}$/, 'Only digits allowed')
    .refine(validateAadhaar, 'Aadhaar number failed checksum validation'),
})
type FormValues = z.infer<typeof schema>

export function CreateWorkerDialog({ cities }: { cities: City[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [selectedCityName, setSelectedCityName] = useState('')
  const [selectedCategoryLabel, setSelectedCategoryLabel] = useState('')
  const [serverError, setServerError] = useState('')
  const [isPending, startTransition] = useTransition()

  const { register, handleSubmit, reset, control, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  function handleClose() {
    reset()
    setSelectedCityName('')
    setSelectedCategoryLabel('')
    setServerError('')
  }

  function onSubmit(values: FormValues) {
    setServerError('')
    startTransition(async () => {
      try {
        await createWorkerAsAdmin({
          cityId: values.cityId,
          name: values.name,
          age: parseInt(values.age, 10),
          phone: values.phone || undefined,
          emergencyContact: values.emergencyContact || undefined,
          category: values.category,
          wageDaily: values.wageDaily,
          otRate2hr: values.otRate2hr || undefined,
          otRate4hr: values.otRate4hr || undefined,
          otRate6hr: values.otRate6hr || undefined,
          aadhaar: values.aadhaar,
        })
        handleClose()
        setOpen(false)
        router.refresh()
      } catch (e) {
        setServerError(e instanceof Error ? e.message : 'Something went wrong')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); setOpen(o) }}>
      <DialogTrigger render={<Button><Plus className="size-4" />Add Worker</Button>} />
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogTitle>Add Worker</DialogTitle>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label>City</Label>
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
            {errors.cityId && <p className="text-xs text-destructive">{errors.cityId.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="w-name">Name</Label>
            <Input id="w-name" {...register('name')} placeholder="Full name" />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="w-age">Age</Label>
              <Input id="w-age" type="number" min={18} max={45} {...register('age')} placeholder="18–45" />
              {errors.age && <p className="text-xs text-destructive">{errors.age.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="w-phone">Phone</Label>
              <Input id="w-phone" {...register('phone')} placeholder="Optional" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="w-emergency">Emergency Contact</Label>
            <Input id="w-emergency" {...register('emergencyContact')} placeholder="Optional" />
          </div>

          <div className="space-y-1.5">
            <Label>Category</Label>
            <Controller
              control={control}
              name="category"
              render={({ field }) => (
                <Select
                  value={field.value ?? ''}
                  onValueChange={(v) => {
                    field.onChange(v ?? '')
                    setSelectedCategoryLabel(CATEGORIES.find((c) => c.value === v)?.label ?? '')
                  }}
                >
                  <SelectTrigger className="w-full">
                    <span className={selectedCategoryLabel ? 'text-foreground' : 'text-muted-foreground'}>
                      {selectedCategoryLabel || 'Select category'}
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.category && <p className="text-xs text-destructive">{errors.category.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="w-wage">Daily Wage (₹)</Label>
            <Input id="w-wage" type="number" step="0.01" min={0} {...register('wageDaily')} placeholder="0.00" />
            {errors.wageDaily && <p className="text-xs text-destructive">{errors.wageDaily.message}</p>}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="w-ot2">OT 2hr (₹)</Label>
              <Input id="w-ot2" type="number" step="0.01" min={0} placeholder="Optional" {...register('otRate2hr')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="w-ot4">OT 4hr (₹)</Label>
              <Input id="w-ot4" type="number" step="0.01" min={0} placeholder="Optional" {...register('otRate4hr')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="w-ot6">OT 6hr (₹)</Label>
              <Input id="w-ot6" type="number" step="0.01" min={0} placeholder="Optional" {...register('otRate6hr')} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="w-aadhaar">Aadhaar Number</Label>
            <Input
              id="w-aadhaar"
              type="text"
              inputMode="numeric"
              maxLength={12}
              {...register('aadhaar')}
              placeholder="12-digit number"
            />
            <p className="text-xs text-muted-foreground">Required. Enter all 12 digits, no spaces or dashes.</p>
            {errors.aadhaar && <p className="text-xs text-destructive">{errors.aadhaar.message}</p>}
          </div>

          {serverError && <p className="text-xs text-destructive">{serverError}</p>}

          <DialogFooter>
            <DialogClose render={<Button variant="outline" type="button" />}>Cancel</DialogClose>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Creating…' : 'Add Worker'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
