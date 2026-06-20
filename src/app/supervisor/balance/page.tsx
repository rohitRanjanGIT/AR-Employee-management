import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getWorkerBalanceOverview } from '@/actions/advances'
import { BalanceList } from '@/components/BalanceList'

export default async function SupervisorBalancePage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session || session.user.role !== 'supervisor') redirect('/login')

  const workers = await getWorkerBalanceOverview()

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Worker Balances</h1>
        <p className="text-sm text-muted-foreground">
          Total earned, advance taken, and net balance for workers at your sites. Click a name for
          the full statement.
        </p>
      </div>
      <BalanceList workers={workers} basePath="/supervisor/balance" />
    </div>
  )
}
