import 'dotenv/config'
import { eq } from 'drizzle-orm'
import { db } from './index'
import { users } from './schema'
import { auth } from '@/lib/auth'

// One-off: creates the ANURANJAN admin account.
// Login id is "ANURANJAN" — the login form maps a bare id (no "@") to this email.
const ID = 'ANURANJAN'
const EMAIL = `${ID.toLowerCase()}@anuranjan.com` // anuranjan@anuranjan.com
const PASSWORD = 'AIRPL@1357'

async function main() {
  try {
    await auth.api.signUpEmail({
      body: { email: EMAIL, password: PASSWORD, name: ID },
    })
    console.log(`Created account: ${EMAIL}`)
  } catch {
    console.log('Account already exists — ensuring admin role.')
  }

  // Ensure role is admin (idempotent whether freshly created or pre-existing)
  await db.update(users).set({ role: 'admin', status: 'active' }).where(eq(users.email, EMAIL))

  console.log('\nAdmin ready.')
  console.log(`  Login id: ${ID}`)
  console.log(`  Password: ${PASSWORD}`)
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
