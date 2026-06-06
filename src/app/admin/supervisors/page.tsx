import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getAllSupervisors } from '@/actions/supervisors'
import { getAllCities } from '@/actions/cities'
import { SupervisorsTable } from './SupervisorsTable'

export default async function SupervisorsPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session || session.user.role !== 'admin') redirect('/login')

  const [supervisors, cities] = await Promise.all([getAllSupervisors(), getAllCities()])
  const activeCities = cities
    .filter((c) => c.status === 'active')
    .map((c) => ({ id: c.id, name: c.name }))

  return <SupervisorsTable supervisors={supervisors} cities={activeCities} />
}
