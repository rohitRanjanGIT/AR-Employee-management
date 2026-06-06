import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getSupervisorSites } from '@/actions/sites'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export default async function SupervisorSitesPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session || session.user.role !== 'supervisor') redirect('/login')

  const sites = await getSupervisorSites()

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">My Sites</h1>

      {sites.length === 0 ? (
        <p className="text-muted-foreground text-sm">You have no assigned sites yet.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sites.map((site) => {
            const otherSupervisors = site.siteSupervisorAssignments
            return (
              <Card key={site.id}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">{site.name}</CardTitle>
                    <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono shrink-0">
                      {site.code}
                    </code>
                  </div>
                  <p className="text-sm text-muted-foreground">{site.city.name}</p>
                </CardHeader>
                <CardContent className="space-y-3">
                  {site.siteWorkTypes.length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Work Types</p>
                      <div className="flex flex-wrap gap-1">
                        {site.siteWorkTypes.map((swt) => (
                          <Badge key={swt.id} variant="outline" className="text-xs">
                            {swt.workType.name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {otherSupervisors.length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Other Supervisors</p>
                      <div className="flex flex-wrap gap-1">
                        {otherSupervisors.map((a) => (
                          <span
                            key={a.id}
                            className="inline-flex rounded-full bg-muted px-2 py-0.5 text-xs"
                          >
                            {a.employee.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
