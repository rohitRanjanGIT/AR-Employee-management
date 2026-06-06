import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getAllWorkTypes } from '@/actions/work-types'
import { WorkTypesClient } from './WorkTypesClient'

export default async function WorkTypesPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session || session.user.role !== 'admin') redirect('/login')

  const workTypes = await getAllWorkTypes()

  return <WorkTypesClient workTypes={workTypes} />
}
