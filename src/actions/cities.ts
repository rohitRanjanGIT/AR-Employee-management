'use server'

import { db } from '@/db'
import { cities, sites } from '@/db/schema'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { eq, and } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session || session.user.role !== 'admin') throw new Error('Unauthorised')
  return session
}

const createCitySchema = z.object({
  name: z.string().min(1).max(100),
  shortCode: z.string().min(2).max(10).toUpperCase(),
  stateId: z.string().uuid('State is required'),
})

export async function createCity(input: z.infer<typeof createCitySchema>) {
  await requireAdmin()
  const data = createCitySchema.parse(input)

  const existing = await db.query.cities.findFirst({
    where: eq(cities.shortCode, data.shortCode),
  })
  if (existing) throw new Error('Short code already in use')

  await db.insert(cities).values(data)
  revalidatePath('/admin/cities')
}

export async function getAllCities() {
  await requireAdmin()
  return db.query.cities.findMany({
    with: { state: true },
    orderBy: (c, { asc }) => [asc(c.name)],
  })
}

export async function cityHasActiveSites(cityId: string): Promise<boolean> {
  const activeSite = await db.query.sites.findFirst({
    where: and(eq(sites.cityId, cityId), eq(sites.status, 'active')),
  })
  return !!activeSite
}
