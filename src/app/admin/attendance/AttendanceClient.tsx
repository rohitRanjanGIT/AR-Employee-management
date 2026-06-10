'use client'

import { useState } from 'react'
import { AttendanceOverview } from './AttendanceOverview'
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

type Tab = 'overview' | 'records' | 'edit-requests'

interface Props {
  initialTab: Tab
  records: AttendanceRecord[]
  pendingRequests: PendingRecord[]
  sites: { id: string; name: string; cityName: string }[]
  workers: { id: string; name: string }[]
  cityWorkerCounts: { city: string; total: number }[]
}

export function AttendanceClient({
  initialTab,
  records,
  pendingRequests,
  sites,
  workers,
  cityWorkerCounts,
}: Props) {
  const [tab, setTab] = useState<Tab>(initialTab)
  const [toast, setToast] = useState<string | null>(null)
  // Drill-down target from the overview → preselects filters in the records table
  const [drill, setDrill] = useState<{ siteId: string; date: string } | null>(null)

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  function viewSite(siteId: string, date: string) {
    setDrill({ siteId, date })
    setTab('records')
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
          onViewSite={viewSite}
        />
      )}

      {tab === 'records' && (
        <AttendanceTable
          key={drill ? `${drill.siteId}-${drill.date}` : 'all'}
          records={records}
          sites={sites}
          workers={workers}
          initialSiteId={drill?.siteId}
          initialDate={drill?.date}
          onToast={showToast}
        />
      )}

      {tab === 'edit-requests' && (
        <EditRequestsTable records={pendingRequests} onToast={showToast} />
      )}
    </div>
  )
}
