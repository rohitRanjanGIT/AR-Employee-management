'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogClose,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select'
import { adminEditAttendance } from '@/actions/attendance'
import { formatDate } from '@/lib/utils'

type AttendanceRecord = {
  id: string
  date: string
  morningMarkedAt: Date | null
  eveningMarkedAt: Date | null
  ot: 'none' | '2hr' | '4hr'
  isLocked: boolean
  worker: { name: string }
  site: { name: string; city: { name: string } }
}

interface Props {
  record: AttendanceRecord | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: (msg: string) => void
}

export function AdminEditDialog({ record, open, onOpenChange, onSuccess }: Props) {
  const router = useRouter()
  const [morning, setMorning] = useState(false)
  const [evening, setEvening] = useState(false)
  const [ot, setOt] = useState<'none' | '2hr' | '4hr'>('none')
  const [otName, setOtName] = useState('None')
  const [isPending, startTransition] = useTransition()

  // Sync state when record changes
  function handleOpenChange(o: boolean) {
    if (o && record) {
      setMorning(record.morningMarkedAt != null)
      setEvening(record.eveningMarkedAt != null)
      setOt(record.ot)
      setOtName(record.ot === 'none' ? 'None' : record.ot === '2hr' ? '2 Hours' : '4 Hours')
    }
    onOpenChange(o)
  }

  function handleSubmit() {
    if (!record) return
    startTransition(async () => {
      try {
        await adminEditAttendance({
          attendanceId: record.id,
          morningPresent: morning,
          eveningPresent: evening,
          ot,
        })
        onOpenChange(false)
        router.refresh()
        onSuccess('Attendance updated')
      } catch (e) {
        onSuccess((e as Error).message)
      }
    })
  }

  if (!record) return null

  const showOt = morning && evening

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogTitle>Edit Attendance</DialogTitle>
        <div className="space-y-4 py-2">
          <div className="text-sm space-y-0.5">
            <p className="font-medium">{record.worker.name}</p>
            <p className="text-muted-foreground">
              {record.site.name} · {record.site.city.name} · {formatDate(record.date)}
            </p>
          </div>

          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={morning}
                onChange={(e) => setMorning(e.target.checked)}
                className="h-4 w-4 rounded accent-foreground"
              />
              Morning Present
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={evening}
                onChange={(e) => setEvening(e.target.checked)}
                className="h-4 w-4 rounded accent-foreground"
              />
              Evening Present
            </label>

            {showOt && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Overtime</p>
                <Select
                  value={ot}
                  onValueChange={(v: string | null) => {
                    if (v) {
                      setOt(v as 'none' | '2hr' | '4hr')
                      setOtName(v === 'none' ? 'None' : v === '2hr' ? '2 Hours' : '4 Hours')
                    }
                  }}
                >
                  <SelectTrigger className="w-40">
                    <span className="text-foreground">{otName}</span>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="2hr">2 Hours</SelectItem>
                    <SelectItem value="4hr">4 Hours</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
