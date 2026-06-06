import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getSupervisorSites } from '@/actions/sites'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'

export default async function SupervisorDashboard() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session || session.user.role !== 'supervisor') redirect('/login')

  const sites = await getSupervisorSites()
  const siteCount = sites.length

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Supervisor Dashboard</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            You are assigned to{' '}
            <Link href="/supervisor/sites" className="font-medium text-foreground underline underline-offset-4 hover:text-primary">
              {siteCount} site{siteCount !== 1 ? 's' : ''}
            </Link>
            .
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
