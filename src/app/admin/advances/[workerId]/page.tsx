import { headers } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import { format } from 'date-fns'
import { auth } from '@/lib/auth'
import { getWorkerStatement } from '@/actions/advances'
import { WorkerStatement } from '@/components/WorkerStatement'

interface Props {
  params: Promise<{ workerId: string }>
}

export default async function AdminWorkerStatementPage({ params }: Props) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session || session.user.role !== 'admin') redirect('/login')

  const { workerId } = await params
  const currentMonth = format(new Date(), 'yyyy-MM')

  let data
  try {
    data = await getWorkerStatement(workerId, currentMonth)
  } catch {
    notFound()
  }

  return <WorkerStatement initialData={data} backHref="/admin/advances" />
}
