import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { employees } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { Badge } from '@/components/ui/badge'
import { AdminNav } from '@/components/AdminNav'
import { ThemeToggle } from '@/components/ThemeToggle'
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
    <div className="min-h-screen bg-background text-foreground lg:flex">
      <AdminNav />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b bg-background/95 px-4 py-3 backdrop-blur sm:px-6">
          <div>
            <span className="block text-base font-semibold leading-none sm:text-lg">Anuranjan EMS</span>
            <span className="mt-1 hidden text-xs text-muted-foreground sm:block">Admin workspace</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="hidden text-sm text-muted-foreground md:inline">{displayName}</span>
            <Badge variant="outline">Admin</Badge>
            <ThemeToggle />
            <LogoutButton />
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  )
}
