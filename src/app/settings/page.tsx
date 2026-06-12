import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { employees } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { ProfileForm } from './ProfileForm'
import { ChangePasswordForm } from './ChangePasswordForm'

export default async function SettingsPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect('/login')

  const [employee] = await db
    .select()
    .from(employees)
    .where(eq(employees.userId, session.user.id))
    .limit(1)

  const name = employee?.name ?? session.user.name
  const phone = employee?.phone ?? ''

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <h1 className="text-xl font-semibold">Account Settings</h1>
      <div className="grid gap-6 lg:grid-cols-2">
        <ProfileForm name={name} phone={phone} />
        <ChangePasswordForm />
      </div>
    </div>
  )
}
