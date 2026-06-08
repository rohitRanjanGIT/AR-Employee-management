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
import { approveWorker } from '@/actions/workers'

type Worker = {
  id: string
  name: string
  wageDaily: string
  otRate2hr: string | null
  otRate4hr: string | null
  otRate6hr: string | null
}

const schema = z.object({
  wageDaily: z.string().min(1, 'Daily wage is required'),
  otRate2hr: z.string().optional(),
  otRate4hr: z.string().optional(),
  otRate6hr: z.string().optional(),
})
type FormValues = z.infer<typeof schema>

export function ApproveWorkerDialog({
  worker,
  open,
  onOpenChange,
}: {
  worker: Worker | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const [serverError, setServerError] = useState('')
  const [isPending, startTransition] = useTransition()

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: worker
      ? {
          wageDaily: worker.wageDaily,
          otRate2hr: worker.otRate2hr ?? '',
          otRate4hr: worker.otRate4hr ?? '',
          otRate6hr: worker.otRate6hr ?? '',
        }
      : { wageDaily: '', otRate2hr: '', otRate4hr: '', otRate6hr: '' },
  })

  function onSubmit(values: FormValues) {
    if (!worker) return
    setServerError('')
    startTransition(async () => {
      try {
        await approveWorker({
          workerId: worker.id,
          wageDaily: values.wageDaily,
          otRate2hr: values.otRate2hr || undefined,
          otRate4hr: values.otRate4hr || undefined,
          otRate6hr: values.otRate6hr || undefined,
        })
        reset()
        onOpenChange(false)
        router.refresh()
      } catch (e) {
        setServerError(e instanceof Error ? e.message : 'Something went wrong')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { reset(); setServerError('') } onOpenChange(o) }}>
      <DialogContent showCloseButton={false}>
        <DialogTitle>Approve Worker</DialogTitle>
        {worker && (
          <>
            <p className="text-sm text-muted-foreground mt-1">
              Confirm rates for <span className="font-medium text-foreground">{worker.name}</span>.
            </p>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
              <div className="space-y-1.5">
                <Label htmlFor="approve-wage">Daily Wage (₹)</Label>
                <Input id="approve-wage" type="number" step="0.01" min={0} {...register('wageDaily')} />
                {errors.wageDaily && (
                  <p className="text-xs text-destructive">{errors.wageDaily.message}</p>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="approve-ot2">OT 2hr (₹)</Label>
                  <Input id="approve-ot2" type="number" step="0.01" min={0} placeholder="Optional" {...register('otRate2hr')} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="approve-ot4">OT 4hr (₹)</Label>
                  <Input id="approve-ot4" type="number" step="0.01" min={0} placeholder="Optional" {...register('otRate4hr')} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="approve-ot6">OT 6hr (₹)</Label>
                  <Input id="approve-ot6" type="number" step="0.01" min={0} placeholder="Optional" {...register('otRate6hr')} />
                </div>
              </div>

              {serverError && <p className="text-xs text-destructive">{serverError}</p>}

              <DialogFooter>
                <DialogClose render={<Button variant="outline" type="button" disabled={isPending} />}>
                  Cancel
                </DialogClose>
                <Button type="submit" disabled={isPending}>
                  {isPending ? 'Approving…' : 'Approve Worker'}
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
