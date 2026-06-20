import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { IndianRupee, Users, Building2, ClipboardClock } from 'lucide-react'
import { getDashboardSummary } from '@/actions/payroll'
import { getRecentSitePhotosForAdmin } from '@/actions/site-photos'
import { formatINR } from '@/lib/payroll'
import { RecentPhotosStrip } from '@/components/gallery/RecentPhotosStrip'

export default async function AdminDashboard() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session || session.user.role !== 'admin') redirect('/login')

  const [summary, recentPhotos] = await Promise.all([
    getDashboardSummary(),
    getRecentSitePhotosForAdmin(8),
  ])

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Dashboard</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Total Wage Cost */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm text-muted-foreground">Total Wage Cost</CardTitle>
            <IndianRupee className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{formatINR(summary.totalWageCost)}</p>
            <p className="text-xs text-muted-foreground mt-1">{summary.currentMonth}</p>
          </CardContent>
        </Card>

        {/* Active Workers */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm text-muted-foreground">Active Workers</CardTitle>
            <Users className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{summary.totalActiveWorkers}</p>
            <p className="text-xs text-muted-foreground mt-1">this month</p>
          </CardContent>
        </Card>

        {/* Top Spending Site */}
        {summary.topSite ? (
          <Link href={`/admin/payroll/sites/${summary.topSite.siteId}`} className="block">
            <Card className="h-full hover:bg-muted/50 transition-colors cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm text-muted-foreground">Top Spending Site</CardTitle>
                <Building2 className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold font-mono">{summary.topSite.code}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatINR(summary.topSite.total)} this month
                </p>
              </CardContent>
            </Card>
          </Link>
        ) : (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm text-muted-foreground">Top Spending Site</CardTitle>
              <Building2 className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">—</p>
              <p className="text-xs text-muted-foreground mt-1">no attendance this month</p>
            </CardContent>
          </Card>
        )}

        {/* Pending Edits */}
        <Link href="/admin/attendance?tab=edit-requests" className="block">
          <Card className="h-full hover:bg-muted/50 transition-colors cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm text-muted-foreground">Pending Edits</CardTitle>
              <ClipboardClock className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <p className="text-2xl font-semibold">{summary.pendingAttendanceEdits}</p>
                {summary.pendingAttendanceEdits > 0 && (
                  <Badge variant="destructive">review</Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">awaiting review</p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Recent Site Activity */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm text-muted-foreground">Recent Site Activity</CardTitle>
          <Link href="/admin/gallery" className="text-xs text-primary hover:underline">
            View gallery
          </Link>
        </CardHeader>
        <CardContent>
          {recentPhotos.length === 0 ? (
            <p className="text-sm text-muted-foreground">No photos uploaded yet.</p>
          ) : (
            <RecentPhotosStrip photos={recentPhotos} basePath="/admin/sites" variant="grid" />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
