'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { format, subDays } from 'date-fns'
import { ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
import { classifyDate, todayIST, type DateContext } from '@/lib/attendance'
import {
  markMorningAttendance,
  markEveningAttendance,
  submitAttendanceEditRequest,
} from '@/actions/attendance'

type Worker = {
  id: string
  name: string
  category: 'skilled' | 'semi_skilled' | 'helper'
  wageDaily: string
  otRate2hr: string | null
}

type AttendanceRow = {
  id: string
  workerId: string
  siteId: string
  morningMarkedAt: Date | null
  eveningMarkedAt: Date | null
  ot: 'none' | '2hr' | '4hr'
  editRequestStatus: 'pending' | 'approved' | 'rejected' | null
  isLocked: boolean
}

type Site = {
  id: string
  name: string
  code: string
  city: { id: string; name: string }
}

interface Props {
  siteId: string
  date: string
  site: Site
  workers: Worker[]
  thisSiteAttendance: AttendanceRow[]
  allCityAttendance: AttendanceRow[]
}

const CATEGORY_LABELS: Record<string, string> = {
  skilled: 'Skilled',
  semi_skilled: 'Semi-Skilled',
  helper: 'Helper',
}

function navigateDate(current: string, delta: number): string {
  const d = new Date(current + 'T00:00:00')
  d.setDate(d.getDate() + delta)
  return format(d, 'yyyy-MM-dd')
}

export function AttendanceMarking({
  siteId,
  date,
  site,
  workers,
  thisSiteAttendance,
  allCityAttendance,
}: Props) {
  const router = useRouter()
  const [tab, setTab] = useState<'morning' | 'evening'>('morning')
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set())
  const [otMap, setOtMap] = useState<Record<string, 'none' | '2hr' | '4hr'>>({})
  const [isPending, startTransition] = useTransition()

  // Edit request dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<AttendanceRow | null>(null)
  const [editWorker, setEditWorker] = useState<Worker | null>(null)
  const [editMorning, setEditMorning] = useState(false)
  const [editEvening, setEditEvening] = useState(false)
  const [editOt, setEditOt] = useState<'none' | '2hr' | '4hr'>('none')
  const [editOtName, setEditOtName] = useState('None')
  const [editReason, setEditReason] = useState('')
  const [editPending, startEditTransition] = useTransition()
  const [toast, setToast] = useState<string | null>(null)

  const dateContext: DateContext = classifyDate(date)
  const today = todayIST()
  const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd')
  const canNavigatePrev = dateContext !== 'too_old'
  const canNavigateNext = date < today

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  // Build lookup maps
  const attendanceByWorkerId = new Map(thisSiteAttendance.map((a) => [a.workerId, a]))
  const allCityMarkedWorkerIds = new Set(
    allCityAttendance
      .filter((a) => {
        if (tab === 'morning') return a.morningMarkedAt != null
        return a.eveningMarkedAt != null
      })
      .map((a) => a.workerId)
  )

  // Workers that can be freshly checked (not yet marked on this shift at any site)
  const unmarkedWorkers = workers.filter((w) => !allCityMarkedWorkerIds.has(w.id))
  // Workers already marked (at any site in city for this shift)
  const markedWorkers = workers.filter((w) => allCityMarkedWorkerIds.has(w.id))

  function toggleWorker(id: string) {
    setCheckedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleSubmit() {
    const presentWorkerIds = Array.from(checkedIds)
    startTransition(async () => {
      try {
        const result =
          tab === 'morning'
            ? await markMorningAttendance({ siteId, date, presentWorkerIds })
            : await markEveningAttendance({ siteId, date, presentWorkerIds, otMap })
        setCheckedIds(new Set())
        setOtMap({})
        router.refresh()
        if (result?.late) {
          showToast('Attendance marked outside the scheduled window — it will be flagged as late.')
        } else {
          showToast(`${tab === 'morning' ? 'Morning' : 'Evening'} attendance marked`)
        }
      } catch (e) {
        showToast((e as Error).message)
      }
    })
  }

  function openEditDialog(row: AttendanceRow, worker: Worker) {
    setEditTarget(row)
    setEditWorker(worker)
    setEditMorning(row.morningMarkedAt != null)
    setEditEvening(row.eveningMarkedAt != null)
    setEditOt(row.ot)
    setEditOtName(row.ot === 'none' ? 'None' : row.ot === '2hr' ? '2 Hours' : '4 Hours')
    setEditReason('')
    setEditDialogOpen(true)
  }

  function handleEditSubmit() {
    if (!editTarget || !editReason.trim()) return
    startEditTransition(async () => {
      try {
        await submitAttendanceEditRequest({
          attendanceId: editTarget.id,
          proposedMorningPresent: editMorning,
          proposedEveningPresent: editEvening,
          proposedOt: editOt,
          reason: editReason.trim(),
        })
        setEditDialogOpen(false)
        router.refresh()
        showToast('Edit request submitted')
      } catch (e) {
        showToast((e as Error).message)
      }
    })
  }

  const isEditRequestMode = dateContext === 'edit_request'
  const isTooOld = dateContext === 'too_old'

  return (
    <div className="space-y-4 max-w-lg mx-auto">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-foreground text-background px-4 py-2 rounded shadow text-sm">
          {toast}
        </div>
      )}

      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => router.push('/supervisor/attendance')}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold">{site.name}</h1>
            <p className="text-xs text-muted-foreground">{site.city.name}</p>
          </div>
        </div>

        {/* Date navigation */}
        <div className="flex items-center gap-2 mt-3">
          <Button
            variant="outline"
            size="sm"
            disabled={!canNavigatePrev}
            onClick={() => router.push(`/supervisor/attendance/${siteId}?date=${navigateDate(date, -1)}`)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium min-w-[120px] text-center">
            {date === today
              ? 'Today'
              : date === yesterday
                ? 'Yesterday'
                : formatDate(date)}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={!canNavigateNext}
            onClick={() => router.push(`/supervisor/attendance/${siteId}?date=${navigateDate(date, 1)}`)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Edit request mode banner */}
      {isEditRequestMode && (
        <div className="flex items-start gap-2 rounded-lg border border-yellow-500/30 bg-yellow-50 dark:bg-yellow-950/20 p-3 text-sm text-yellow-800 dark:text-yellow-300">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>Editing attendance for this date requires admin approval. Use &quot;Request Edit&quot; per worker.</span>
        </div>
      )}

      {isTooOld && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          This date is too far in the past. Attendance can no longer be edited.
        </div>
      )}

      {/* Tab toggle — only show for today/yesterday */}
      {!isEditRequestMode && !isTooOld && (
        <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
          <button
            className={`px-4 py-1.5 text-sm rounded-md font-medium transition-colors ${
              tab === 'morning' ? 'bg-background shadow text-foreground' : 'text-muted-foreground'
            }`}
            onClick={() => { setTab('morning'); setCheckedIds(new Set()); setOtMap({}) }}
          >
            Morning
          </button>
          <button
            className={`px-4 py-1.5 text-sm rounded-md font-medium transition-colors ${
              tab === 'evening' ? 'bg-background shadow text-foreground' : 'text-muted-foreground'
            }`}
            onClick={() => { setTab('evening'); setCheckedIds(new Set()); setOtMap({}) }}
          >
            Evening
          </button>
        </div>
      )}

      {/* Edit request mode: show all workers with current status + request button */}
      {isEditRequestMode && (
        <div className="space-y-2">
          {workers.length === 0 && (
            <p className="text-sm text-muted-foreground">No active workers in this city.</p>
          )}
          {workers.map((worker) => {
            const row = attendanceByWorkerId.get(worker.id)
            const isPendingRequest = row?.editRequestStatus === 'pending'
            return (
              <div
                key={worker.id}
                className="flex items-center gap-3 rounded-lg border px-3 py-2.5"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{worker.name}</p>
                  <p className="text-xs text-muted-foreground">{CATEGORY_LABELS[worker.category]}</p>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
                  {row ? (
                    <>
                      <span>{row.morningMarkedAt ? '🌅' : '—'}</span>
                      <span>{row.eveningMarkedAt ? '🌆' : '—'}</span>
                    </>
                  ) : (
                    <span>No record</span>
                  )}
                  {isPendingRequest ? (
                    <Badge variant="outline" className="text-xs">Pending</Badge>
                  ) : row && !row.isLocked ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs h-7"
                      onClick={() => row && openEditDialog(row, worker)}
                    >
                      Request Edit
                    </Button>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Normal marking mode */}
      {!isEditRequestMode && !isTooOld && (
        <>
          {/* Unmarked workers */}
          <div className="space-y-2">
            {unmarkedWorkers.length === 0 && markedWorkers.length === 0 && (
              <p className="text-sm text-muted-foreground">No active workers in this city.</p>
            )}
            {unmarkedWorkers.map((worker) => {
              const checked = checkedIds.has(worker.id)
              const existingRow = attendanceByWorkerId.get(worker.id)
              const hasMorningMark = existingRow?.morningMarkedAt != null
              const showOt = tab === 'evening' && checked && hasMorningMark
              const otVal = otMap[worker.id] ?? 'none'
              const otLabel =
                otVal === 'none' ? 'No OT' : otVal === '2hr' ? '2 Hours' : '4 Hours'

              return (
                <div key={worker.id} className="rounded-lg border px-3 py-2.5">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleWorker(worker.id)}
                      className="h-4 w-4 rounded accent-foreground cursor-pointer"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{worker.name}</p>
                      <p className="text-xs text-muted-foreground">{CATEGORY_LABELS[worker.category]}</p>
                    </div>
                    {tab === 'evening' && existingRow?.morningMarkedAt && (
                      <span className="text-xs text-muted-foreground">🌅 marked</span>
                    )}
                  </div>
                  {showOt && (
                    <div className="mt-2 ml-7">
                      <Select
                        value={otVal}
                        onValueChange={(v: string | null) => {
                          if (v) {
                            setOtMap((prev) => ({
                              ...prev,
                              [worker.id]: v as 'none' | '2hr' | '4hr',
                            }))
                          }
                        }}
                      >
                        <SelectTrigger className="h-8 text-xs w-36">
                          <span className="text-foreground">{otLabel}</span>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No OT</SelectItem>
                          <SelectItem value="2hr">2 Hours OT</SelectItem>
                          <SelectItem value="4hr">4 Hours OT</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Already marked workers (dimmed) */}
          {markedWorkers.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-3 my-1">
                <div className="flex-1 border-t border-dashed" />
                <p className="text-xs text-muted-foreground shrink-0">Already marked today</p>
                <div className="flex-1 border-t border-dashed" />
              </div>
              {markedWorkers.map((worker) => (
                <div
                  key={worker.id}
                  className="flex items-center gap-3 rounded-lg border px-3 py-2.5 opacity-40"
                >
                  <input type="checkbox" disabled className="h-4 w-4 rounded" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{worker.name}</p>
                    <p className="text-xs text-muted-foreground">{CATEGORY_LABELS[worker.category]}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Submit button */}
          <div className="sticky bottom-4 pt-2">
            <Button
              className="w-full"
              disabled={checkedIds.size === 0 || isPending}
              onClick={handleSubmit}
            >
              {isPending
                ? 'Marking...'
                : `Mark ${tab === 'morning' ? 'Morning' : 'Evening'} — ${checkedIds.size} worker${checkedIds.size !== 1 ? 's' : ''} present`}
            </Button>
          </div>
        </>
      )}

      {/* Edit Request Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogTitle>Request Attendance Edit</DialogTitle>
          {editWorker && (
            <div className="space-y-4 py-2">
              <p className="text-sm font-medium">{editWorker.name}</p>
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={editMorning}
                    onChange={(e) => setEditMorning(e.target.checked)}
                    className="h-4 w-4 rounded accent-foreground"
                  />
                  Morning Present
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={editEvening}
                    onChange={(e) => setEditEvening(e.target.checked)}
                    className="h-4 w-4 rounded accent-foreground"
                  />
                  Evening Present
                </label>
                {editMorning && editEvening && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Overtime</p>
                    <Select
                      value={editOt}
                      onValueChange={(v: string | null) => {
                        if (v) {
                          setEditOt(v as 'none' | '2hr' | '4hr')
                          setEditOtName(v === 'none' ? 'None' : v === '2hr' ? '2 Hours' : '4 Hours')
                        }
                      }}
                    >
                      <SelectTrigger className="w-40">
                        <span className="text-foreground">{editOtName}</span>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="2hr">2 Hours</SelectItem>
                        <SelectItem value="4hr">4 Hours</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Reason (required)</p>
                  <textarea
                    value={editReason}
                    onChange={(e) => setEditReason(e.target.value)}
                    placeholder="Explain why this edit is needed..."
                    rows={3}
                    maxLength={500}
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <p className="text-xs text-muted-foreground text-right">{editReason.length}/500</p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <Button
              onClick={handleEditSubmit}
              disabled={editPending || !editReason.trim()}
            >
              {editPending ? 'Submitting...' : 'Submit Request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
