import { headers } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getSiteSnapshot } from '@/actions/sites'
import { formatDate, formatDateTime } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

type SupervisorEntry = {
  employeeId: string
  name: string
  phone: string | null
  assignedAt: string
  deactivatedAt: string
}

export default async function SiteSnapshotPage({ params }: { params: Promise<{ siteId: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session || session.user.role !== 'admin') redirect('/login')

  const { siteId } = await params
  const snapshot = await getSiteSnapshot(siteId)
  if (!snapshot) notFound()

  const supervisors = (snapshot.supervisors as SupervisorEntry[]) ?? []

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Link href="/admin/sites" className="text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft className="size-4" />
        </Link>
        <h1 className="text-xl font-semibold">Site Snapshot</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{snapshot.site.name}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-muted-foreground">Code</p>
            <code className="font-mono">{snapshot.site.code}</code>
          </div>
          <div>
            <p className="text-muted-foreground">City</p>
            <p>{snapshot.site.city.name}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Deactivated At</p>
            <p>{formatDateTime(snapshot.deactivatedAt)}</p>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <h2 className="font-medium">Supervisors at Closure</h2>
        {supervisors.length === 0 ? (
          <p className="text-sm text-muted-foreground">No supervisors were assigned at closure.</p>
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Assigned At</TableHead>
                  <TableHead>Deactivated At</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {supervisors.map((s) => (
                  <TableRow key={s.employeeId}>
                    <TableCell>{s.name}</TableCell>
                    <TableCell>{s.phone ?? '—'}</TableCell>
                    <TableCell>{formatDate(s.assignedAt)}</TableCell>
                    <TableCell>{formatDate(s.deactivatedAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {(['Workers', 'Wages', 'Materials', 'Expenses'] as const).map((section) => (
        <div key={section} className="space-y-2">
          <h2 className="font-medium">{section}</h2>
          <Card>
            <CardContent className="py-6">
              <p className="text-sm text-muted-foreground text-center">
                Data will be available after relevant modules are completed.
              </p>
            </CardContent>
          </Card>
        </div>
      ))}
    </div>
  )
}
