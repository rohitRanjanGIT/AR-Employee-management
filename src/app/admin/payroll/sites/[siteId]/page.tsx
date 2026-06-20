import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { eq } from 'drizzle-orm'
import { sites } from '@/db/schema'
import { getSitePayrollOverview } from '@/actions/payroll'
import { getFinalizedMonthsForSite } from '@/actions/payroll-finalization'
import { SitePayrollOverview } from './SitePayrollOverview'

interface Props {
  params: Promise<{ siteId: string }>
}

export default async function SitePayrollPage({ params }: Props) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session || session.user.role !== 'admin') redirect('/login')

  const { siteId } = await params

  const [overview, finalizedMonths] = await Promise.all([
    getSitePayrollOverview(siteId),
    getFinalizedMonthsForSite(siteId),
  ])

  if (!overview) {
    // Fetch minimal site details for the header even when there is no attendance data
    const site = await db.query.sites.findFirst({
      where: eq(sites.id, siteId),
      with: { city: { with: { state: true } } },
    })

    return (
      <div className="space-y-4">
        <Link href="/admin/payroll" className="text-sm text-primary hover:underline">
          ← Back to Payroll
        </Link>
        <h1 className="text-xl font-semibold">
          {site ? `${site.name} (${site.code})` : 'Site Payroll'}
        </h1>
        <p className="text-sm text-muted-foreground">
          No attendance data recorded for this site yet.
        </p>
      </div>
    )
  }

  return (
    <SitePayrollOverview
      site={overview}
      months={overview.months.map((m) => ({ value: m.yearMonth, label: m.label }))}
      finalizedMonths={finalizedMonths}
    />
  )
}
