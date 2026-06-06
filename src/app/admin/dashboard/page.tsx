import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { employees } from '@/db/schema'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import LogoutButton from './logout-button'

export default async function AdminDashboard() {
  const session = await auth.api.getSession({ headers: await headers() })

  if (!session || session.user.role !== 'admin') {
    redirect('/login')
  }

  const [employee] = await db
    .select()
    .from(employees)
    .where(eq(employees.userId, session.user.id))
    .limit(1)

  const displayName = employee?.name ?? session.user.name

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b px-6 py-3 flex items-center justify-between">
        <span className="font-semibold text-lg">Anuranjan EMS</span>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{displayName}</span>
          <Badge variant="outline">Admin</Badge>
          <LogoutButton />
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Welcome, {displayName}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Role: <span className="font-medium text-foreground">Admin</span>
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
