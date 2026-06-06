'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
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
import { reassignWorkerCity } from '@/actions/workers'

type City = { id: string; name: string }
type Worker = { id: string; name: string; cityId: string }

export function ReassignCityDialog({
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
  const [newCityId, setNewCityId] = useState('')
  const [newCityName, setNewCityName] = useState('')
  const [serverError, setServerError] = useState('')
  const [isPending, startTransition] = useTransition()

  const availableCities = worker ? cities.filter((c) => c.id !== worker.cityId) : cities

  function handleClose() {
    setNewCityId('')
    setNewCityName('')
    setServerError('')
  }

  function handleConfirm() {
    if (!worker || !newCityId) return
    setServerError('')
    startTransition(async () => {
      try {
        await reassignWorkerCity(worker.id, newCityId)
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
      onOpenChange={(o) => {
        if (!o) handleClose()
        onOpenChange(o)
      }}
    >
      <DialogContent showCloseButton={false}>
        <DialogTitle>Reassign City</DialogTitle>
        {worker && (
          <>
            <p className="text-sm text-muted-foreground mt-1">
              Reassign <span className="font-medium text-foreground">{worker.name}</span> to a
              different city.
            </p>
            <div className="mt-4 space-y-1.5">
              <Label>New City</Label>
              <Select
                value={newCityId}
                onValueChange={(v) => {
                  setNewCityId(v ?? '')
                  setNewCityName(availableCities.find((c) => c.id === v)?.name ?? '')
                }}
              >
                <SelectTrigger className="w-full">
                  <span className={newCityName ? 'text-foreground' : 'text-muted-foreground'}>
                    {newCityName || 'Select city'}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  {availableCities.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {serverError && <p className="text-xs text-destructive mt-2">{serverError}</p>}

            <DialogFooter className="mt-4">
              <DialogClose render={<Button variant="outline" disabled={isPending} />}>Cancel</DialogClose>
              <Button disabled={isPending || !newCityId} onClick={handleConfirm}>
                {isPending ? 'Reassigning…' : 'Reassign'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
