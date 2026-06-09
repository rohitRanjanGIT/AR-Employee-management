'use client'

import { useState } from 'react'
import { AttendanceTable } from './AttendanceTable'
import { EditRequestsTable } from './EditRequestsTable'
import { Badge } from '@/components/ui/badge'

type AttendanceRecord = {
  id: string
  date: string
  morningMarkedAt: Date | null
  eveningMarkedAt: Date | null
  ot: 'none' | '2hr' | '4hr'
  derivedStatus: 'full' | 'half' | 'absent'
  isEdited: boolean
  isLocked: boolean
  worker: { id: string; name: string; category: string }
  site: { id: string; name: string; city: { name: string } }
  morningMarkedByEmployee: { name: string } | null
  eveningMarkedByEmployee: { name: string } | null
}

type PendingRecord = {
  id: string
  date: string
  morningMarkedAt: Date | null
  eveningMarkedAt: Date | null
  editRequest: unknown
  worker: { name: string }
  site: { name: string; city: { name: string } }
}

interface Props {
  initialTab: 'records' | 'edit-requests'
  records: AttendanceRecord[]
  pendingRequests: PendingRecord[]
  sites: { id: string; name: string }[]
  workers: { id: string; name: string }[]
}

export function AttendanceClient({ initialTab, records, pendingRequests, sites, workers }: Props) {
  const [tab, setTab] = useState<'records' | 'edit-requests'>(initialTab)
  const [toast, setToast] = useState<string | null>(null)

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  return (
    <div className="space-y-4">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-foreground text-background px-4 py-2 rounded shadow text-sm">
          {toast}
        </div>
      )}

      <h1 className="text-xl font-semibold">Attendance</h1>

      {/* Tab bar */}
      <div className="flex gap-1 border-b">
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            tab === 'records'
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => setTab('records')}
        >
          Attendance Records
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-1.5 ${
            tab === 'edit-requests'
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => setTab('edit-requests')}
        >
          Edit Requests
          {pendingRequests.length > 0 && (
            <Badge variant="destructive" className="text-xs h-5 px-1.5">
              {pendingRequests.length}
            </Badge>
          )}
        </button>
      </div>

      {tab === 'records' && (
        <AttendanceTable records={records} sites={sites} workers={workers} onToast={showToast} />
      )}

      {tab === 'edit-requests' && (
        <EditRequestsTable records={pendingRequests} onToast={showToast} />
      )}
    </div>
  )
}
