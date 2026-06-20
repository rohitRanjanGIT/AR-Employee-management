import { headers } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getFinalizedSnapshot } from '@/actions/payroll-finalization'
import { FinalizedSnapshotView, type SnapshotViewModel } from './FinalizedSnapshotView'

interface Props {
  params: Promise<{ siteId: string; yearMonth: string }>
}

export default async function FinalizedSnapshotPage({ params }: Props) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session || session.user.role !== 'admin') redirect('/login')

  const { siteId, yearMonth } = await params

  const snapshot = await getFinalizedSnapshot(siteId, yearMonth)
  if (!snapshot) notFound()

  const site = snapshot.siteSnapshot as {
    name: string
    code: string
    cityName: string
    stateName: string
  }

  // Shape into a fully-serializable view model (numbers + ISO strings).
  const model: SnapshotViewModel = {
    siteId: snapshot.siteId,
    yearMonth: snapshot.yearMonth,
    finalizedAt: snapshot.finalizedAt.toISOString(),
    finalizedBy: snapshot.finalizedBy,
    site,
    grandTotal: snapshot.grandTotal,
    workers: snapshot.workers.map((w) => {
      const ws = w.workerSnapshot as { name: string; category: string; cityName: string }
      return {
        snapshotId: w.id,
        workerId: w.workerId,
        workerName: ws.name,
        workerCategory: ws.category,
        fullDays: w.fullDays,
        halfDays: w.halfDays,
        otTwoHrCount: w.otTwoHrCount,
        otFourHrCount: w.otFourHrCount,
        grossWage: Number(w.grossWage),
        adjustmentAmount: Number(w.adjustmentAmount),
        adjustmentReason: w.adjustmentReason,
        finalWage: Number(w.finalWage),
        advanceRecovered: Number(w.advanceRecovered),
        netPaid: Number(w.finalWage) - Number(w.advanceRecovered),
        currentTotal: w.currentTotal,
        corrections: w.corrections.map((c) => ({
          id: c.id,
          amount: Number(c.finalWage),
          reason: c.adjustmentReason,
          finalizedAt: c.finalizedAt.toISOString(),
          finalizedBy: c.finalizedByUser?.name ?? 'Unknown',
        })),
      }
    }),
  }

  return <FinalizedSnapshotView model={model} />
}
