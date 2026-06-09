import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getPendingEditRequests, getAttendanceForAdmin } from '@/actions/attendance'
import { getAllSites } from '@/actions/sites'
import { getAllWorkers } from '@/actions/workers'
import { AttendanceClient } from './AttendanceClient'

interface Props {
  searchParams: Promise<{ tab?: string }>
}

export default async function AdminAttendancePage({ searchParams }: Props) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session || session.user.role !== 'admin') redirect('/login')

  const { tab } = await searchParams

  const [pendingRequests, allSites, workers, records] = await Promise.all([
    getPendingEditRequests(),
    getAllSites(),
    getAllWorkers(),
    getAttendanceForAdmin({}),
  ])

  const activeSites = allSites
    .filter((s) => s.status === 'active')
    .map((s) => ({ id: s.id, name: s.name }))

  const activeWorkers = workers
    .filter((w) => w.status === 'active')
    .map((w) => ({ id: w.id, name: w.name }))

  return (
    <AttendanceClient
      initialTab={tab === 'edit-requests' ? 'edit-requests' : 'records'}
      records={records}
      pendingRequests={pendingRequests}
      sites={activeSites}
      workers={activeWorkers}
    />
  )
}
