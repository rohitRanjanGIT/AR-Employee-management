import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getSupervisorWorkerBalances, getMyAdvanceRequests } from '@/actions/advances'
import { SupervisorAdvancesClient } from './SupervisorAdvancesClient'

export default async function SupervisorAdvancesPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session || session.user.role !== 'supervisor') redirect('/login')

  // The scoped balances list doubles as the request dialog's worker picker
  // (same set of workers, already carries the outstanding balance).
  const [workers, requests] = await Promise.all([
    getSupervisorWorkerBalances(),
    getMyAdvanceRequests(),
  ])

  return <SupervisorAdvancesClient workers={workers} requests={requests} />
}
