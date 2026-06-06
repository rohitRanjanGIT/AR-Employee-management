import 'dotenv/config'
import { eq } from 'drizzle-orm'
import { db } from './index'
import { users, workTypes } from './schema'
import { auth } from '@/lib/auth'

async function seed() {
  console.log('Seeding database...')

  const adminEmail = 'admin@anuranjan.com'
  const adminPassword = 'Admin@1234'

  try {
    await auth.api.signUpEmail({
      body: {
        email: adminEmail,
        password: adminPassword,
        name: 'Super Admin',
      },
    })

    await db
      .update(users)
      .set({ role: 'admin' })
      .where(eq(users.email, adminEmail))

    console.log(`Admin created: ${adminEmail} / ${adminPassword}`)
  } catch {
    console.log('Admin may already exist, skipping...')
  }

  const supervisorEmail = 'supervisor@anuranjan.com'
  const supervisorPassword = 'Supervisor@1234'

  try {
    await auth.api.signUpEmail({
      body: {
        email: supervisorEmail,
        password: supervisorPassword,
        name: 'Sample Supervisor',
      },
    })

    await db
      .update(users)
      .set({ role: 'supervisor' })
      .where(eq(users.email, supervisorEmail))

    console.log(`Supervisor created: ${supervisorEmail} / ${supervisorPassword}`)
  } catch {
    console.log('Supervisor may already exist, skipping...')
  }

  try {
    await db.insert(workTypes).values({ name: 'General Construction' }).onConflictDoNothing()
    console.log('Default work type seeded.')
  } catch (e) {
    console.log('Work type seed skipped:', e)
  }

  console.log('Seed complete.');
}

seed()
