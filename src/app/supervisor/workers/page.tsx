import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getWorkersForSupervisor } from '@/actions/workers'
import { getSupervisorSites } from '@/actions/sites'
import { WorkersList } from './WorkersList'

export default async function SupervisorWorkersPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session || session.user.role !== 'supervisor') redirect('/login')

  const [workers, sites] = await Promise.all([getWorkersForSupervisor(), getSupervisorSites()])

  const seenCityIds = new Set<string>()
  const assignedCities = sites
    .map((s) => ({ id: s.cityId, name: s.city.name }))
    .filter((c) => {
      if (seenCityIds.has(c.id)) return false
      seenCityIds.add(c.id)
      return true
    })

  return <WorkersList workers={workers} assignedCities={assignedCities} />
}
