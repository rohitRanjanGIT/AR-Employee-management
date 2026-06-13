import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getConsolidatedPayroll, getPayrollFilterOptions } from '@/actions/payroll'
import { PayrollClient } from './PayrollClient'

export default async function AdminPayrollPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session || session.user.role !== 'admin') redirect('/login')

  const [filterOptions, initialData] = await Promise.all([
    getPayrollFilterOptions(),
    getConsolidatedPayroll({}),
  ])

  return (
    <PayrollClient
      filterOptions={{
        states: filterOptions.states.map((s) => ({ id: s.id, name: s.name })),
        cities: filterOptions.cities.map((c) => ({
          id: c.id,
          name: c.name,
          stateId: c.stateId,
        })),
        sites: filterOptions.sites.map((s) => ({
          id: s.id,
          name: s.name,
          code: s.code,
          cityId: s.cityId,
          stateId: s.city.stateId,
        })),
        months: filterOptions.months,
      }}
      initialData={initialData}
    />
  )
}
