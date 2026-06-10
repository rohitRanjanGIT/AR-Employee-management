import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { employees } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { Badge } from '@/components/ui/badge'
import { SupervisorNav } from '@/components/SupervisorNav'
import { ThemeToggle } from '@/components/ThemeToggle'
import LogoutButton from './dashboard/logout-button'

export default async function SupervisorLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session || session.user.role !== 'supervisor') redirect('/login')

  const [employee] = await db
    .select()
    .from(employees)
    .where(eq(employees.userId, session.user.id))
    .limit(1)

  if (employee?.status === 'inactive') redirect('/login')

  const displayName = employee?.name ?? session.user.name
  const email = session.user.email

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      {/* Mobile-only top bar — desktop session controls live in the sidebar footer */}
      <header className="flex items-center justify-between gap-4 border-b bg-background/95 px-4 py-3 backdrop-blur lg:hidden">
        <span className="text-sm font-semibold tracking-tight">Anuranjan EMS</span>
        <div className="flex items-center gap-2">
          <Badge variant="outline">Supervisor</Badge>
          <ThemeToggle />
          <LogoutButton />
        </div>
      </header>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
        <SupervisorNav userName={displayName} userEmail={email} />
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</main>
      </div>
    </div>
  )
}
