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
import { updateWorker, uploadWorkerPhoto } from '@/actions/workers'
import { validateAadhaar } from '@/lib/aadhaar-validate'
import { PhotoUpload, resolvePhoto } from '@/components/PhotoUpload'

type City = { id: string; name: string }
type Worker = {
  id: string
  name: string
  cityId: string
  dateOfBirth: string | null
  phone: string | null
  emergencyContact: string | null
  category: 'skilled' | 'semi_skilled' | 'helper'
  wageDaily: string
  otRate2hr: string | null
  otRate4hr: string | null
  otRate6hr: string | null
  accountNumber: string | null
  ifscCode: string | null
  photoCloudinaryUrl: string | null
  photoCloudinaryPublicId: string | null
}

const CATEGORIES = [
  { value: 'skilled', label: 'Skilled' },
  { value: 'semi_skilled', label: 'Semi-Skilled' },
  { value: 'helper', label: 'Helper' },
] as const

const CATEGORY_LABELS: Record<string, string> = {
  skilled: 'Skilled', semi_skilled: 'Semi-Skilled', helper: 'Helper',
}

const schema = z.object({
  cityId: z.string().uuid('City is required'),
  name: z.string().min(1, 'Name is required').max(200),
  dateOfBirth: z.string().optional(),
  phone: z.string().max(15).optional(),
  emergencyContact: z.string().max(200).optional(),
  category: z.enum(['skilled', 'semi_skilled', 'helper']),
  wageDaily: z.string().min(1, 'Daily wage is required'),
  otRate2hr: z.string().optional(),
  otRate4hr: z.string().optional(),
  otRate6hr: z.string().optional(),
  accountNumber: z.string().max(40).optional(),
  ifscCode: z.string().max(20).optional(),
  aadhaar: z.string().optional().refine(
    (v) => !v || (v.length === 12 && /^\d{12}$/.test(v) && validateAadhaar(v)),
    'Must be a valid 12-digit Aadhaar number'
  ),
})
type FormValues = z.infer<typeof schema>

export function EditWorkerDialog({
  worker,
  cities,
  open,
  onOpenChange,
}: {
  worker: Worker | null
  cities: City[]
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const [selectedCityName, setSelectedCityName] = useState(
    worker ? (cities.find((c) => c.id === worker.cityId)?.name ?? '') : ''
  )
  const [selectedCategoryLabel, setSelectedCategoryLabel] = useState(
    worker ? (CATEGORY_LABELS[worker.category] ?? '') : ''
  )
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoRemoved, setPhotoRemoved] = useState(false)
  const [serverError, setServerError] = useState('')
  const [isPending, startTransition] = useTransition()

  const { register, handleSubmit, reset, control, watch, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: worker
      ? {
          cityId: worker.cityId,
          name: worker.name,
          dateOfBirth: worker.dateOfBirth ?? '',
          phone: worker.phone ?? '',
          emergencyContact: worker.emergencyContact ?? '',
          category: worker.category,
          wageDaily: worker.wageDaily,
          otRate2hr: worker.otRate2hr ?? '',
          otRate4hr: worker.otRate4hr ?? '',
          otRate6hr: worker.otRate6hr ?? '',
          accountNumber: worker.accountNumber ?? '',
          ifscCode: worker.ifscCode ?? '',
          aadhaar: '',
        }
      : undefined,
  })
  const nameValue = watch('name') ?? ''

  function handleClose() {
    reset()
    setServerError('')
    setPhotoFile(null)
    setPhotoRemoved(false)
    if (worker) {
      setSelectedCityName(cities.find((c) => c.id === worker.cityId)?.name ?? '')
      setSelectedCategoryLabel(CATEGORY_LABELS[worker.category] ?? '')
    }
  }

  function onSubmit(values: FormValues) {
    if (!worker) return
    setServerError('')
    startTransition(async () => {
      try {
        const photo = await resolvePhoto({
          file: photoFile,
          removed: photoRemoved,
          existing: { publicId: worker.photoCloudinaryPublicId, url: worker.photoCloudinaryUrl },
          upload: uploadWorkerPhoto,
        })
        await updateWorker(worker.id, {
          cityId: values.cityId,
          name: values.name,
          dateOfBirth: values.dateOfBirth || undefined,
          phone: values.phone || undefined,
          emergencyContact: values.emergencyContact || undefined,
          category: values.category,
          wageDaily: values.wageDaily,
          otRate2hr: values.otRate2hr || undefined,
          otRate4hr: values.otRate4hr || undefined,
          otRate6hr: values.otRate6hr || undefined,
          accountNumber: values.accountNumber || undefined,
          ifscCode: values.ifscCode || undefined,
          ...photo,
          aadhaar: values.aadhaar || undefined,
        })
        handleClose()
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
      onOpenChange={(o) => { if (!o) handleClose(); onOpenChange(o) }}
    >
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogTitle>Edit Worker</DialogTitle>
        {worker && (
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
              <Label htmlFor="ew-name">Name</Label>
              <Input id="ew-name" {...register('name')} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ew-dob">Date of Birth</Label>
                <Input id="ew-dob" type="date" {...register('dateOfBirth')} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ew-phone">Phone</Label>
                <Input id="ew-phone" {...register('phone')} placeholder="Optional" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ew-emergency">Emergency Contact</Label>
              <Input id="ew-emergency" {...register('emergencyContact')} placeholder="Optional" />
            </div>

            <PhotoUpload
              key={worker.id}
              name={nameValue}
              initialUrl={worker.photoCloudinaryUrl}
              onChange={(file, removed) => { setPhotoFile(file); setPhotoRemoved(removed) }}
              disabled={isPending}
            />

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
              <Label htmlFor="ew-wage">Daily Wage (₹)</Label>
              <Input id="ew-wage" type="number" step="0.01" min={0} {...register('wageDaily')} />
              {errors.wageDaily && <p className="text-xs text-destructive">{errors.wageDaily.message}</p>}
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ew-ot2">OT 2hr (₹)</Label>
                <Input id="ew-ot2" type="number" step="0.01" min={0} placeholder="Optional" {...register('otRate2hr')} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ew-ot4">OT 4hr (₹)</Label>
                <Input id="ew-ot4" type="number" step="0.01" min={0} placeholder="Optional" {...register('otRate4hr')} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ew-ot6">OT 6hr (₹)</Label>
                <Input id="ew-ot6" type="number" step="0.01" min={0} placeholder="Optional" {...register('otRate6hr')} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ew-acct">Account Number</Label>
                <Input id="ew-acct" {...register('accountNumber')} placeholder="Optional" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ew-ifsc">IFSC Code</Label>
                <Input id="ew-ifsc" {...register('ifscCode')} placeholder="Optional" className="uppercase" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ew-aadhaar">Aadhaar Number</Label>
              <Input
                id="ew-aadhaar"
                type="text"
                inputMode="numeric"
                maxLength={12}
                {...register('aadhaar')}
                placeholder="Leave blank to keep existing"
              />
              <p className="text-xs text-muted-foreground">Only enter a new 12-digit number to update.</p>
              {errors.aadhaar && <p className="text-xs text-destructive">{errors.aadhaar.message}</p>}
            </div>

            {serverError && <p className="text-xs text-destructive">{serverError}</p>}

            <DialogFooter>
              <DialogClose render={<Button variant="outline" type="button" disabled={isPending} />}>Cancel</DialogClose>
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Saving…' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
