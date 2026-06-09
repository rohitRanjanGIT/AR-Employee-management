import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { getPendingEditRequests } from '@/actions/attendance'

export default async function AdminDashboard() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session || session.user.role !== 'admin') redirect('/login')

  const pendingEditRequests = await getPendingEditRequests()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-center min-h-[20vh]">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Admin Dashboard</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Use the module sidebar to manage cities, sites, workers, attendance, and work types.
            </p>
          </CardContent>
        </Card>
      </div>

      {pendingEditRequests.length > 0 && (
        <div className="flex justify-center">
          <Link href="/admin/attendance?tab=edit-requests">
            <Card className="w-full max-w-md hover:bg-muted/50 transition-colors cursor-pointer">
              <CardContent className="flex items-center justify-between pt-6">
                <p className="text-sm font-medium">Pending attendance edit requests</p>
                <Badge variant="destructive">{pendingEditRequests.length}</Badge>
              </CardContent>
            </Card>
          </Link>
        </div>
      )}
    </div>
  )
}
