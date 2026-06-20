import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { employees } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { AdminNav } from '@/components/AdminNav'
import { SupervisorNav } from '@/components/SupervisorNav'

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect('/login')

  const [employee] = await db
    .select()
    .from(employees)
    .where(eq(employees.userId, session.user.id))
    .limit(1)

  const displayName = employee?.name ?? session.user.name
  const email = session.user.email
  const isAdmin = session.user.role === 'admin'

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
        {isAdmin ? (
          <AdminNav userName={displayName} userEmail={email} />
        ) : (
          <SupervisorNav userName={displayName} userEmail={email} />
        )}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</main>
      </div>
    </div>
  )
}
