import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import {
  getFinalizationPreview,
  getUnfinalizedEarlierMonths,
  isMonthFinalized,
} from '@/actions/payroll-finalization'
import { FinalizationReview } from './FinalizationReview'

interface Props {
  params: Promise<{ siteId: string; yearMonth: string }>
}

export default async function FinalizePayrollPage({ params }: Props) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session || session.user.role !== 'admin') redirect('/login')

  const { siteId, yearMonth } = await params

  // Already finalized → send to the read-only snapshot view instead.
  if (await isMonthFinalized(siteId, yearMonth)) {
    redirect(`/admin/payroll/sites/${siteId}/snapshot/${yearMonth}`)
  }

  let preview: Awaited<ReturnType<typeof getFinalizationPreview>>
  try {
    preview = await getFinalizationPreview(siteId, yearMonth)
  } catch (e) {
    return (
      <div className="space-y-4">
        <Link
          href={`/admin/payroll/sites/${siteId}`}
          className="text-sm text-primary hover:underline"
        >
          ← Back to Site Payroll
        </Link>
        <p className="text-sm text-destructive">
          {e instanceof Error ? e.message : 'Unable to load finalization preview.'}
        </p>
      </div>
    )
  }

  const earlierUnfinalized = await getUnfinalizedEarlierMonths(siteId, yearMonth)

  return <FinalizationReview preview={preview} earlierUnfinalized={earlierUnfinalized} />
}
