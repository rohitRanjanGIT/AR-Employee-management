import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import {
  getPendingAdvances,
  getAdvancesLedger,
  getActiveWorkerBalances,
} from '@/actions/advances'
import { AdminAdvancesClient } from './AdminAdvancesClient'

export default async function AdminAdvancesPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session || session.user.role !== 'admin') redirect('/login')

  const [pending, ledger, balances] = await Promise.all([
    getPendingAdvances(),
    getAdvancesLedger(),
    getActiveWorkerBalances(),
  ])

  return <AdminAdvancesClient pending={pending} ledger={ledger} balances={balances} />
}
