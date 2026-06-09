import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getSupervisorSites } from '@/actions/sites'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'

export default async function SupervisorAttendancePage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session || session.user.role !== 'supervisor') redirect('/login')

  const sites = await getSupervisorSites()
  const activeSites = sites.filter((s) => s.status === 'active')

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Attendance</h1>
      <p className="text-sm text-muted-foreground">Select a site to mark attendance.</p>

      {activeSites.length === 0 ? (
        <p className="text-muted-foreground text-sm">You have no active assigned sites.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {activeSites.map((site) => (
            <Link key={site.id} href={`/supervisor/attendance/${site.id}`}>
              <Card className="hover:bg-muted/50 transition-colors cursor-pointer h-full">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">{site.name}</CardTitle>
                    <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono shrink-0">
                      {site.code}
                    </code>
                  </div>
                  <p className="text-sm text-muted-foreground">{site.city.name}</p>
                </CardHeader>
                <CardContent>
                  <Badge variant="outline" className="text-xs">
                    Mark Attendance →
                  </Badge>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
