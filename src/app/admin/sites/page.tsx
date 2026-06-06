import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getAllSites, getSupervisorEmployees } from '@/actions/sites'
import { getAllWorkTypes } from '@/actions/work-types'
import { getAllCities } from '@/actions/cities'
import { SitesTable } from './SitesTable'

export default async function SitesPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session || session.user.role !== 'admin') redirect('/login')

  const [sites, workTypes, cities, supervisors] = await Promise.all([
    getAllSites(),
    getAllWorkTypes(),
    getAllCities(),
    getSupervisorEmployees(),
  ])

  return (
    <SitesTable
      sites={sites}
      workTypes={workTypes}
      cities={cities}
      supervisors={supervisors}
    />
  )
}
