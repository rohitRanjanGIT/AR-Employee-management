import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { db } from '@/db'
import * as schema from '@/db/schema'

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      user: schema.users,
      session: schema.sessions,
      account: schema.accounts,
      verification: schema.verifications,
    },
  }),
  emailAndPassword: {
    enabled: true,
  },
  session: {
    // Sessions last 2 hours from login. updateAge ≥ expiresIn disables the
    // sliding-renewal window, so it's a hard 2-hour cap — re-login required after.
    expiresIn: 60 * 60 * 2, // 2 hours (seconds)
    updateAge: 60 * 60 * 2, // 2 hours (seconds)
  },
  user: {
    additionalFields: {
      role: {
        type: 'string',
        defaultValue: 'supervisor',
        required: false,
      },
      status: {
        type: 'string',
        defaultValue: 'active',
        required: false,
      },
    },
  },
})
