import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getAllCities } from '@/actions/cities'
import { getAllStates } from '@/actions/states'
import { CitiesClient } from './CitiesClient'

export default async function CitiesPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session || session.user.role !== 'admin') redirect('/login')

  const [cities, states] = await Promise.all([getAllCities(), getAllStates()])

  return <CitiesClient cities={cities} states={states} />
}
