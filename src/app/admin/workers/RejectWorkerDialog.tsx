'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogClose,
  DialogFooter,
} from '@/components/ui/dialog'
import { rejectWorker } from '@/actions/workers'

type Worker = { id: string; name: string }

const schema = z.object({ reason: z.string().max(500).optional() })
type FormValues = z.infer<typeof schema>

export function RejectWorkerDialog({
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

  const { register, handleSubmit, reset } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { reason: '' },
  })

  function onSubmit(values: FormValues) {
    if (!worker) return
    setServerError('')
    startTransition(async () => {
      try {
        await rejectWorker({ workerId: worker.id, reason: values.reason || undefined })
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
        <DialogTitle>Reject Worker</DialogTitle>
        {worker && (
          <>
            <p className="text-sm text-muted-foreground mt-1">
              Reject submission for{' '}
              <span className="font-medium text-foreground">{worker.name}</span>? The supervisor
              will be able to view the reason and resubmit.
            </p>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
              <div className="space-y-1.5">
                <Label htmlFor="reject-reason">Reason (optional)</Label>
                <textarea
                  id="reject-reason"
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
                  placeholder="Visible to the supervisor"
                  {...register('reason')}
                />
              </div>

              {serverError && <p className="text-xs text-destructive">{serverError}</p>}

              <DialogFooter>
                <DialogClose render={<Button variant="outline" type="button" disabled={isPending} />}>
                  Cancel
                </DialogClose>
                <Button type="submit" variant="destructive" disabled={isPending}>
                  {isPending ? 'Rejecting…' : 'Reject'}
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
