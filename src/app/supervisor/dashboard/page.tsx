import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getSupervisorSites } from '@/actions/sites'
import { getWorkersForSupervisor } from '@/actions/workers'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'

export default async function SupervisorDashboard() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session || session.user.role !== 'supervisor') redirect('/login')

  const [sites, workers] = await Promise.all([getSupervisorSites(), getWorkersForSupervisor()])
  const siteCount = sites.length
  const pendingCount = workers.filter((w) => w.status === 'pending').length

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Supervisor Dashboard</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
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
    </div>
  )
}
