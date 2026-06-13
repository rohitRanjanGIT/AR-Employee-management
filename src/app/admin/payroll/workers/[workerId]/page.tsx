import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getWorkerLifetimeEarnings, getPayrollFilterOptions } from '@/actions/payroll'
import { WorkerEarningsOverview } from './WorkerEarningsOverview'

interface Props {
  params: Promise<{ workerId: string }>
}

export default async function WorkerEarningsPage({ params }: Props) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session || session.user.role !== 'admin') redirect('/login')

  const { workerId } = await params

  const [earnings, filterOptions] = await Promise.all([
    getWorkerLifetimeEarnings(workerId),
    getPayrollFilterOptions(),
  ])

  return (
    <WorkerEarningsOverview
      workerId={workerId}
      initialData={earnings}
      filterOptions={{
        states: filterOptions.states.map((s) => ({ id: s.id, name: s.name })),
        cities: filterOptions.cities.map((c) => ({
          id: c.id,
          name: c.name,
          stateId: c.stateId,
        })),
        sites: [],
        months: filterOptions.months,
      }}
    />
  )
}
