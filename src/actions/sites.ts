'use server'

import { db } from '@/db'
import {
  sites,
  siteWorkTypes,
  siteSupervisorAssignments,
  siteSnapshots,
  employees,
  cities,
  users,
} from '@/db/schema'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { eq, and, count } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session || session.user.role !== 'admin') throw new Error('Unauthorised')
  return session
}

async function requireAuth() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) throw new Error('Unauthorised')
  return session
}

export async function generateSiteCode(cityId: string, siteName: string): Promise<string> {
  const city = await db.query.cities.findFirst({ where: eq(cities.id, cityId) })
  if (!city) throw new Error('City not found')

  const siteCount = await db.select({ count: count() }).from(sites).where(eq(sites.cityId, cityId))
  const index = (siteCount[0]?.count ?? 0) + 1
  const nameAbbrev = siteName.replace(/\s+/g, '').slice(0, 2).toUpperCase()
  return `${city.shortCode}S${index}${nameAbbrev}`
}

const createSiteSchema = z.object({
  cityId: z.string().uuid(),
  name: z.string().min(1).max(200),
  code: z.string().min(2).max(20).toUpperCase(),
  tenderPrice: z.string().optional(),
  totalProjectCost: z.string().optional(),
  workTypeIds: z.array(z.string().uuid()).optional(),
})

export async function createSite(input: z.infer<typeof createSiteSchema>) {
  await requireAdmin()
  const data = createSiteSchema.parse(input)

  const city = await db.query.cities.findFirst({ where: eq(cities.id, data.cityId) })
  if (!city) throw new Error('City not found')
  if (city.status !== 'active') throw new Error('Cannot create a site under an inactive city')

  const existingCode = await db.query.sites.findFirst({ where: eq(sites.code, data.code) })
  if (existingCode) throw new Error('Site code already in use')

  const [site] = await db
    .insert(sites)
    .values({
      cityId: data.cityId,
      name: data.name,
      code: data.code,
      tenderPrice: data.tenderPrice ?? null,
      totalProjectCost: data.totalProjectCost ?? null,
    })
    .returning()

  if (data.workTypeIds && data.workTypeIds.length > 0) {
    await db.insert(siteWorkTypes).values(
      data.workTypeIds.map((workTypeId) => ({ siteId: site.id, workTypeId }))
    )
  }

  revalidatePath('/admin/sites')
  return site
}

export async function getAllSites() {
  await requireAdmin()
  return db.query.sites.findMany({
    with: {
      city: true,
      siteWorkTypes: { with: { workType: true } },
      siteSupervisorAssignments: { with: { employee: true } },
    },
    orderBy: (s, { asc }) => [asc(s.name)],
  })
}

export async function getSupervisorSites() {
  const session = await requireAuth()

  const employee = await db.query.employees.findFirst({
    where: eq(employees.userId, session.user.id),
  })
  if (!employee) return []

  const assignments = await db.query.siteSupervisorAssignments.findMany({
    where: eq(siteSupervisorAssignments.employeeId, employee.id),
    with: {
      site: {
        with: {
          city: true,
          siteWorkTypes: { with: { workType: true } },
          siteSupervisorAssignments: { with: { employee: true } },
        },
      },
    },
  })

  return assignments.map((a) => a.site)
}

export async function getSupervisorEmployees() {
  await requireAdmin()
  return db
    .select({ employee: employees, userName: users.name, userEmail: users.email })
    .from(employees)
    .innerJoin(users, eq(employees.userId, users.id))
    .where(eq(users.role, 'supervisor'))
}

export async function assignSupervisorToSite(siteId: string, employeeId: string) {
  await requireAdmin()

  const existing = await db.query.siteSupervisorAssignments.findFirst({
    where: and(
      eq(siteSupervisorAssignments.siteId, siteId),
      eq(siteSupervisorAssignments.employeeId, employeeId)
    ),
  })
  if (existing) throw new Error('Supervisor already assigned to this site')

  await db.insert(siteSupervisorAssignments).values({ siteId, employeeId })
  revalidatePath('/admin/sites')
}

export async function revokeSupervisorFromSite(siteId: string, employeeId: string) {
  await requireAdmin()

  await db
    .delete(siteSupervisorAssignments)
    .where(
      and(
        eq(siteSupervisorAssignments.siteId, siteId),
        eq(siteSupervisorAssignments.employeeId, employeeId)
      )
    )
  revalidatePath('/admin/sites')
}

export async function deactivateSite(siteId: string) {
  await requireAdmin()

  const site = await db.query.sites.findFirst({
    where: eq(sites.id, siteId),
    with: { siteSupervisorAssignments: { with: { employee: true } } },
  })
  if (!site) throw new Error('Site not found')
  if (site.status === 'inactive') throw new Error('Site already inactive')

  const supervisorSnapshot = site.siteSupervisorAssignments.map((a) => ({
    employeeId: a.employee.id,
    name: a.employee.name,
    phone: a.employee.phone,
    assignedAt: a.assignedAt,
    deactivatedAt: new Date().toISOString(),
  }))

  await db.insert(siteSnapshots).values({ siteId: site.id, supervisors: supervisorSnapshot })
  await db.update(sites).set({ status: 'inactive' }).where(eq(sites.id, siteId))
  await db.delete(siteSupervisorAssignments).where(eq(siteSupervisorAssignments.siteId, siteId))

  revalidatePath('/admin/sites')
}

export async function getSiteSnapshot(siteId: string) {
  await requireAdmin()
  return db.query.siteSnapshots.findFirst({
    where: eq(siteSnapshots.siteId, siteId),
    with: { site: { with: { city: true } } },
  })
}
