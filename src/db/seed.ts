import 'dotenv/config'
import { and, eq } from 'drizzle-orm'
import { db } from './index'
import {
  users,
  employees,
  workTypes,
  states,
  cities,
  sites,
  siteWorkTypes,
  siteSupervisorAssignments,
} from './schema'
import { auth } from '@/lib/auth'

async function seed() {
  console.log('Seeding database...')

  // ── Admin ────────────────────────────────────────────────────────────────────
  const adminEmail = 'admin@anuranjan.com'
  const adminPassword = 'Admin@1234'

  try {
    await auth.api.signUpEmail({
      body: { email: adminEmail, password: adminPassword, name: 'Super Admin' },
    })
    await db.update(users).set({ role: 'admin' }).where(eq(users.email, adminEmail))
    console.log(`Admin created: ${adminEmail} / ${adminPassword}`)
  } catch {
    console.log('Admin already exists, skipping.')
  }

  // ── Supervisor ───────────────────────────────────────────────────────────────
  const supervisorEmail = 'supervisor@anuranjan.com'
  const supervisorPassword = 'Supervisor@1234'

  try {
    await auth.api.signUpEmail({
      body: { email: supervisorEmail, password: supervisorPassword, name: 'Sample Supervisor' },
    })
    await db.update(users).set({ role: 'supervisor' }).where(eq(users.email, supervisorEmail))
    const sup = await db.query.users.findFirst({ where: eq(users.email, supervisorEmail) })
    if (sup) {
      await db.insert(employees).values({ userId: sup.id, name: sup.name, status: 'active' })
    }
    console.log(`Supervisor created: ${supervisorEmail} / ${supervisorPassword}`)
  } catch {
    console.log('Supervisor already exists, skipping.')
  }

  // ── Default work type ────────────────────────────────────────────────────────
  await db.insert(workTypes).values({ name: 'General Construction' }).onConflictDoNothing()
  console.log('Default work type ensured.')

  // ── Sample state ─────────────────────────────────────────────────────────────
  await db.insert(states).values({ name: 'Maharashtra' }).onConflictDoNothing()
  const state = await db.query.states.findFirst({ where: eq(states.name, 'Maharashtra') })
  if (!state) throw new Error('State seed failed')
  console.log('Sample state ensured: Maharashtra')

  // ── Sample city ──────────────────────────────────────────────────────────────
  await db
    .insert(cities)
    .values({ name: 'Mumbai', shortCode: 'MUM', stateId: state.id, status: 'active' })
    .onConflictDoNothing()
  const city = await db.query.cities.findFirst({ where: eq(cities.shortCode, 'MUM') })
  if (!city) throw new Error('City seed failed')
  console.log('Sample city ensured: Mumbai (MUM)')

  // ── Sample site ───────────────────────────────────────────────────────────────
  await db
    .insert(sites)
    .values({
      cityId: city.id,
      name: 'Sample Construction Site',
      code: 'MUM-S1',
      status: 'active',
    })
    .onConflictDoNothing()
  const site = await db.query.sites.findFirst({ where: eq(sites.code, 'MUM-S1') })
  if (!site) throw new Error('Site seed failed')
  console.log('Sample site ensured: Sample Construction Site (MUM-S1)')

  // ── Link site to default work type ───────────────────────────────────────────
  const workType = await db.query.workTypes.findFirst({
    where: eq(workTypes.name, 'General Construction'),
  })
  if (workType) {
    await db
      .insert(siteWorkTypes)
      .values({ siteId: site.id, workTypeId: workType.id })
      .onConflictDoNothing()
  }

  // ── Assign supervisor to sample site ─────────────────────────────────────────
  const supUser = await db.query.users.findFirst({ where: eq(users.email, supervisorEmail) })
  const supEmployee = supUser
    ? await db.query.employees.findFirst({ where: eq(employees.userId, supUser.id) })
    : null

  if (supEmployee) {
    const alreadyAssigned = await db.query.siteSupervisorAssignments.findFirst({
      where: and(
        eq(siteSupervisorAssignments.siteId, site.id),
        eq(siteSupervisorAssignments.employeeId, supEmployee.id)
      ),
    })
    if (!alreadyAssigned) {
      await db
        .insert(siteSupervisorAssignments)
        .values({ siteId: site.id, employeeId: supEmployee.id })
      console.log('Supervisor assigned to sample site.')
    } else {
      console.log('Supervisor already assigned to sample site, skipping.')
    }
  }

  console.log('\nSeed complete.')
  console.log(`  Admin:      ${adminEmail} / ${adminPassword}`)
  console.log(`  Supervisor: ${supervisorEmail} / ${supervisorPassword}`)
}

seed().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
