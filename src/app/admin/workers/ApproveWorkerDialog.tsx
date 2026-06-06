'use client'

import { useTransition } from 'react'
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
import { useState } from 'react'

type Worker = { id: string; name: string; wageDaily: string; otRate: string | null }

const schema = z.object({
  wageDaily: z.string().min(1, 'Daily wage is required'),
  otRate: z.string().optional(),
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
      ? { wageDaily: worker.wageDaily, otRate: worker.otRate ?? '' }
      : { wageDaily: '', otRate: '' },
  })

  function onSubmit(values: FormValues) {
    if (!worker) return
    setServerError('')
    startTransition(async () => {
      try {
        await approveWorker({
          workerId: worker.id,
          wageDaily: values.wageDaily,
          otRate: values.otRate || undefined,
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
              Review and confirm rates for{' '}
              <span className="font-medium text-foreground">{worker.name}</span>.
            </p>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="approve-wage">Daily Wage (₹)</Label>
                  <Input
                    id="approve-wage"
                    type="number"
                    step="0.01"
                    min={0}
                    {...register('wageDaily')}
                  />
                  {errors.wageDaily && (
                    <p className="text-xs text-destructive">{errors.wageDaily.message}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="approve-ot">OT Rate (₹)</Label>
                  <Input
                    id="approve-ot"
                    type="number"
                    step="0.01"
                    min={0}
                    placeholder="Optional"
                    {...register('otRate')}
                  />
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
