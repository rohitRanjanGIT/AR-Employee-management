'use server'

import { db } from '@/db'
import { states, cities, sites } from '@/db/schema'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { eq, count } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session || session.user.role !== 'admin') throw new Error('Unauthorised')
  return session
}

const createStateSchema = z.object({
  name: z.string().min(1, 'State name is required').max(100),
})

export async function createState(input: z.infer<typeof createStateSchema>) {
  await requireAdmin()
  const data = createStateSchema.parse(input)

  const existing = await db.query.states.findFirst({
    where: (s, { eq }) => eq(s.name, data.name),
  })
  if (existing) throw new Error('State already exists')

  await db.insert(states).values(data)
  revalidatePath('/admin/cities')
}

export async function getAllStates() {
  await requireAdmin()

  const [allStates, cityCounts, siteCounts] = await Promise.all([
    db.query.states.findMany({ orderBy: (s, { asc }) => [asc(s.name)] }),
    db.select({ stateId: cities.stateId, count: count() }).from(cities).groupBy(cities.stateId),
    db
      .select({ stateId: cities.stateId, count: count() })
      .from(sites)
      .innerJoin(cities, eq(sites.cityId, cities.id))
      .groupBy(cities.stateId),
  ])

  const cityCountMap = Object.fromEntries(cityCounts.map((r) => [r.stateId, Number(r.count)]))
  const siteCountMap = Object.fromEntries(siteCounts.map((r) => [r.stateId, Number(r.count)]))

  return allStates.map((s) => ({
    ...s,
    cityCount: cityCountMap[s.id] ?? 0,
    siteCount: siteCountMap[s.id] ?? 0,
  }))
}
