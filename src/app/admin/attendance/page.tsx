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
    .map((s) => ({ id: s.id, name: s.name, cityName: s.city.name }))

  const activeWorkers = workers.filter((w) => w.status === 'active')

  const workerFilterOptions = activeWorkers.map((w) => ({ id: w.id, name: w.name }))

  // Active worker headcount per city — drives the coverage metric in the overview
  const cityCountMap = new Map<string, number>()
  for (const w of activeWorkers) {
    cityCountMap.set(w.city.name, (cityCountMap.get(w.city.name) ?? 0) + 1)
  }
  const cityWorkerCounts = [...cityCountMap.entries()].map(([city, total]) => ({ city, total }))

  const initialTab =
    tab === 'edit-requests' ? 'edit-requests' : tab === 'records' ? 'records' : 'overview'

  return (
    <AttendanceClient
      initialTab={initialTab}
      records={records}
      pendingRequests={pendingRequests}
      sites={activeSites}
      workers={workerFilterOptions}
      cityWorkerCounts={cityWorkerCounts}
    />
  )
}
