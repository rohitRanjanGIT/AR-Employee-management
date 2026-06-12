'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
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
import { updateSiteAttendanceWindows } from '@/actions/sites'

type Site = {
  id: string
  name: string
  morningAttendanceStart: string | null
  morningAttendanceEnd: string | null
  eveningAttendanceStart: string | null
  eveningAttendanceEnd: string | null
}

export function EditTimeWindowsDialog({
  site,
  open,
  onOpenChange,
}: {
  site: Site | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const [morningStart, setMorningStart] = useState('')
  const [morningEnd, setMorningEnd] = useState('')
  const [eveningStart, setEveningStart] = useState('')
  const [eveningEnd, setEveningEnd] = useState('')
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()
  const [hydratedFor, setHydratedFor] = useState<string | null>(null)

  // Pre-fill from the site whenever a new site target is opened
  if (site && hydratedFor !== site.id) {
    setMorningStart(site.morningAttendanceStart ?? '')
    setMorningEnd(site.morningAttendanceEnd ?? '')
    setEveningStart(site.eveningAttendanceStart ?? '')
    setEveningEnd(site.eveningAttendanceEnd ?? '')
    setError('')
    setHydratedFor(site.id)
  }

  function handleSubmit() {
    if (!site) return
    const morningComplete = (!morningStart && !morningEnd) || (!!morningStart && !!morningEnd)
    const eveningComplete = (!eveningStart && !eveningEnd) || (!!eveningStart && !!eveningEnd)
    if (!morningComplete || !eveningComplete) {
      setError('Both start and end times must be provided for each shift')
      return
    }
    setError('')
    startTransition(async () => {
      try {
        await updateSiteAttendanceWindows({
          siteId: site.id,
          morningAttendanceStart: morningStart || null,
          morningAttendanceEnd: morningEnd || null,
          eveningAttendanceStart: eveningStart || null,
          eveningAttendanceEnd: eveningEnd || null,
        })
        onOpenChange(false)
        router.refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Something went wrong')
      }
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) setHydratedFor(null)
        onOpenChange(o)
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogTitle>Edit Time Windows</DialogTitle>
        {site && (
          <div className="space-y-4 mt-1">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{site.name}</span> — marking outside
              these windows is flagged as late. Clear both fields to remove the restriction.
            </p>
            <div className="space-y-1.5">
              <Label>Morning</Label>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  type="time"
                  value={morningStart}
                  onChange={(e) => setMorningStart(e.target.value)}
                  aria-label="Morning start"
                />
                <Input
                  type="time"
                  value={morningEnd}
                  onChange={(e) => setMorningEnd(e.target.value)}
                  aria-label="Morning end"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Evening</Label>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  type="time"
                  value={eveningStart}
                  onChange={(e) => setEveningStart(e.target.value)}
                  aria-label="Evening start"
                />
                <Input
                  type="time"
                  value={eveningEnd}
                  onChange={(e) => setEveningEnd(e.target.value)}
                  aria-label="Evening end"
                />
              </div>
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
        )}
        <DialogFooter className="mt-2">
          <DialogClose render={<Button variant="outline" type="button" disabled={isPending} />}>
            Cancel
          </DialogClose>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
