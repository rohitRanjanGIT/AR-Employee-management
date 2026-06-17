'use client'

import { useState } from 'react'
import { AttendanceOverview } from './AttendanceOverview'
import { AttendanceTable } from './AttendanceTable'
import { EditRequestsTable } from './EditRequestsTable'
import { AdminEditDialog } from './AdminEditDialog'
import { Badge } from '@/components/ui/badge'
import type { AttendanceRecord } from './DayDetail'

type PendingRecord = {
  id: string
  date: string
  morningMarkedAt: Date | null
  eveningMarkedAt: Date | null
  editRequest: unknown
  worker: { name: string }
  site: { name: string; city: { name: string } }
}

type Tab = 'overview' | 'records' | 'edit-requests'

interface Props {
  initialTab: Tab
  records: AttendanceRecord[]
  pendingRequests: PendingRecord[]
  sites: { id: string; name: string; cityName: string }[]
  cityWorkerCounts: { city: string; total: number }[]
}

export function AttendanceClient({
  initialTab,
  records,
  pendingRequests,
  sites,
  cityWorkerCounts,
}: Props) {
  const [tab, setTab] = useState<Tab>(initialTab)
  const [toast, setToast] = useState<string | null>(null)
  const [editRecord, setEditRecord] = useState<AttendanceRecord | null>(null)
  const [editOpen, setEditOpen] = useState(false)

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  function handleEdit(record: AttendanceRecord) {
    setEditRecord(record)
    setEditOpen(true)
  }

  const tabBtn = (value: Tab, active: boolean) =>
    `px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-1.5 ${
      active
        ? 'border-primary text-foreground'
        : 'border-transparent text-muted-foreground hover:text-foreground'
    }`

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
        <button className={tabBtn('overview', tab === 'overview')} onClick={() => setTab('overview')}>
          Overview
        </button>
        <button className={tabBtn('records', tab === 'records')} onClick={() => setTab('records')}>
          Records
        </button>
        <button
          className={tabBtn('edit-requests', tab === 'edit-requests')}
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

      {tab === 'overview' && (
        <AttendanceOverview
          records={records}
          sites={sites}
          cityWorkerCounts={cityWorkerCounts}
          onEdit={handleEdit}
        />
      )}

      {tab === 'records' && (
        <AttendanceTable records={records} sites={sites} onEdit={handleEdit} />
      )}

      {tab === 'edit-requests' && (
        <EditRequestsTable records={pendingRequests} onToast={showToast} />
      )}

      <AdminEditDialog
        record={editRecord}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSuccess={showToast}
      />
    </div>
  )
}
