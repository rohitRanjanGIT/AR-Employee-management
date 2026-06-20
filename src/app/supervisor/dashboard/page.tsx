import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getSupervisorSites } from '@/actions/sites'
import { getWorkersForSupervisor } from '@/actions/workers'
import { getRecentSitePhotosForSupervisor, getUploadableSites } from '@/actions/site-photos'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { RecentPhotosStrip } from '@/components/gallery/RecentPhotosStrip'
import Link from 'next/link'

export default async function SupervisorDashboard() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session || session.user.role !== 'supervisor') redirect('/login')

  const [sites, workers, recentPhotos, uploadableSites] = await Promise.all([
    getSupervisorSites(),
    getWorkersForSupervisor(),
    getRecentSitePhotosForSupervisor(6),
    getUploadableSites(),
  ])
  const siteCount = sites.length
  const pendingCount = workers.filter((w) => w.status === 'pending').length

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Supervisor Dashboard</h1>

      <Card>
        <CardContent className="space-y-2 pt-6">
          <p className="text-muted-foreground">
            You are assigned to{' '}
            <Link href="/supervisor/sites" className="font-medium text-foreground underline underline-offset-4 hover:text-primary">
              {siteCount} site{siteCount !== 1 ? 's' : ''}
            </Link>
            .
          </p>
          {pendingCount > 0 && (
            <p className="text-muted-foreground">
              <Link href="/supervisor/workers" className="font-medium text-foreground underline underline-offset-4 hover:text-primary">
                {pendingCount} worker submission{pendingCount !== 1 ? 's' : ''} pending approval
              </Link>
              .
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm text-muted-foreground">Recent Site Photos</CardTitle>
        </CardHeader>
        <CardContent>
          <RecentPhotosStrip
            photos={recentPhotos}
            basePath="/supervisor/sites"
            showUpload
            uploadableSites={uploadableSites}
          />
        </CardContent>
      </Card>
    </div>
  )
}
