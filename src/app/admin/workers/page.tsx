import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getAllWorkers } from '@/actions/workers'
import { getAllCities } from '@/actions/cities'
import { WorkersTable } from './WorkersTable'

export default async function AdminWorkersPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session || session.user.role !== 'admin') redirect('/login')

  const [workers, cities] = await Promise.all([getAllWorkers(), getAllCities()])
  const activeCities = cities
    .filter((c) => c.status === 'active')
    .map((c) => ({ id: c.id, name: c.name }))

  return <WorkersTable workers={workers} cities={activeCities} />
}
