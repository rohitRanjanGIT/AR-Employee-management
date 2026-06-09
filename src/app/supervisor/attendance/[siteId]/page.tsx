import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getWorkersForAttendance } from '@/actions/attendance'
import { todayIST } from '@/lib/attendance'
import { AttendanceMarking } from './AttendanceMarking'

interface Props {
  params: Promise<{ siteId: string }>
  searchParams: Promise<{ date?: string }>
}

export default async function SiteAttendancePage({ params, searchParams }: Props) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session || session.user.role !== 'supervisor') redirect('/login')

  const { siteId } = await params
  const { date: dateParam } = await searchParams
  const date = dateParam ?? todayIST()

  const data = await getWorkersForAttendance(siteId, date)

  return (
    <AttendanceMarking
      siteId={siteId}
      date={date}
      site={data.site}
      workers={data.workers}
      thisSiteAttendance={data.thisSiteAttendance}
      allCityAttendance={data.allCityAttendance}
    />
  )
}
