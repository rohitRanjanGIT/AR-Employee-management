import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getAllAdmins } from '@/actions/admins'
import { AdminsTable } from './AdminsTable'

export default async function AdminsPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session || session.user.role !== 'admin') redirect('/login')

  const { admins } = await getAllAdmins()

  return <AdminsTable admins={admins} />
}
