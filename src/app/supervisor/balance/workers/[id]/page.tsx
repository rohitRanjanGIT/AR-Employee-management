import { headers } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import { format } from 'date-fns'
import { auth } from '@/lib/auth'
import { getWorkerStatement } from '@/actions/advances'
import { WorkerStatement } from '@/components/WorkerStatement'

interface Props {
  params: Promise<{ id: string }>
}

export default async function SupervisorBalanceStatementPage({ params }: Props) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session || session.user.role !== 'supervisor') redirect('/login')

  const { id } = await params
  const currentMonth = format(new Date(), 'yyyy-MM')

  // getWorkerStatement enforces supervisor scope server-side — out-of-scope
  // workers throw and resolve to a 404 here.
  let data
  try {
    data = await getWorkerStatement(id, currentMonth)
  } catch {
    notFound()
  }

  return (
    <WorkerStatement
      initialData={data}
      backHref="/supervisor/balance"
      backLabel="Back to Balances"
    />
  )
}
