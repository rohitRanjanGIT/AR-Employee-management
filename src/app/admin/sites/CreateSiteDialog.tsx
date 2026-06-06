'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
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
import { createSite, generateSiteCode } from '@/actions/sites'
import { Plus, RefreshCw } from 'lucide-react'

type City = { id: string; name: string; shortCode: string; status: string }
type WorkType = { id: string; name: string }

const schema = z.object({
  cityId: z.string().uuid('Select a city'),
  name: z.string().min(1, 'Site name is required').max(200),
  code: z.string().min(2, 'Code is required').max(20),
  tenderPrice: z.string().optional(),
  totalProjectCost: z.string().optional(),
})
type FormValues = z.infer<typeof schema>

export function CreateSiteDialog({
  cities,
  workTypes,
}: {
  cities: City[]
  workTypes: WorkType[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [selectedWorkTypes, setSelectedWorkTypes] = useState<string[]>([])
  const [selectedCityName, setSelectedCityName] = useState('')
  const [serverError, setServerError] = useState('')
  const [codeGenerating, setCodeGenerating] = useState(false)
  const [isPending, startTransition] = useTransition()

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    control,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const cityId = watch('cityId')
  const siteName = watch('name')

  useEffect(() => {
    if (!cityId || !siteName || siteName.length < 2) return
    const timer = setTimeout(async () => {
      setCodeGenerating(true)
      try {
        const code = await generateSiteCode(cityId, siteName)
        setValue('code', code)
      } finally {
        setCodeGenerating(false)
      }
    }, 500)
    return () => clearTimeout(timer)
  }, [cityId, siteName, setValue])

  const activeCities = cities.filter((c) => c.status === 'active')

  function toggleWorkType(id: string) {
    setSelectedWorkTypes((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  function onSubmit(values: FormValues) {
    setServerError('')
    startTransition(async () => {
      try {
        await createSite({ ...values, code: values.code.toUpperCase(), workTypeIds: selectedWorkTypes })
        reset()
        setSelectedWorkTypes([])
        setSelectedCityName('')
        setOpen(false)
        router.refresh()
      } catch (e) {
        setServerError(e instanceof Error ? e.message : 'Something went wrong')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { reset(); setSelectedWorkTypes([]); setServerError('') } setOpen(o) }}>
      <DialogTrigger render={<Button><Plus className="size-4" />Create Site</Button>} />
      <DialogContent className="sm:max-w-lg">
        <DialogTitle>Create Site</DialogTitle>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label>City</Label>
            <Controller
              control={control}
              name="cityId"
              render={({ field }) => (
                <Select value={field.value ?? ''} onValueChange={(v) => { field.onChange(v); setSelectedCityName(activeCities.find(c => c.id === v)?.name ?? '') }}>
                  <SelectTrigger className="w-full">
                    <span className={selectedCityName ? 'text-foreground' : 'text-muted-foreground'}>
                      {selectedCityName || 'Select a city'}
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    {activeCities.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.cityId && <p className="text-xs text-destructive">{errors.cityId.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="site-name">Site Name</Label>
            <Input id="site-name" {...register('name')} placeholder="e.g. Supertech Tower" />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="site-code" className="flex items-center gap-2">
              Site Code
              {codeGenerating && <RefreshCw className="size-3 animate-spin text-muted-foreground" />}
            </Label>
            <Input
              id="site-code"
              {...register('code')}
              placeholder="Auto-generated"
              className="uppercase"
              onChange={(e) => setValue('code', e.target.value.toUpperCase())}
            />
            <p className="text-xs text-muted-foreground">Auto-generated. You can edit this.</p>
            {errors.code && <p className="text-xs text-destructive">{errors.code.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="tender-price">Tender Price</Label>
              <Input id="tender-price" {...register('tenderPrice')} placeholder="Optional" type="number" step="0.01" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="project-cost">Project Cost</Label>
              <Input id="project-cost" {...register('totalProjectCost')} placeholder="Optional" type="number" step="0.01" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Work Types</Label>
            {workTypes.length === 0 ? (
              <p className="text-xs text-muted-foreground">No work types available. Add some first.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto rounded-lg border p-2">
                {workTypes.map((wt) => (
                  <label key={wt.id} className="flex items-center gap-2 cursor-pointer text-sm">
                    <Checkbox
                      checked={selectedWorkTypes.includes(wt.id)}
                      onCheckedChange={() => toggleWorkType(wt.id)}
                    />
                    {wt.name}
                  </label>
                ))}
              </div>
            )}
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
