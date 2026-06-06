import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { employees } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { Badge } from '@/components/ui/badge'
import { AdminNav } from '@/components/AdminNav'
import LogoutButton from './dashboard/logout-button'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session || session.user.role !== 'admin') redirect('/login')

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
      <AdminNav />
      <main className="flex-1 p-6">{children}</main>
    </div>
  )
}
