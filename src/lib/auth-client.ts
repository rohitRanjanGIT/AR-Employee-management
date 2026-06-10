import { createAuthClient } from 'better-auth/react'
import { inferAdditionalFields } from 'better-auth/client/plugins'
import type { auth } from './auth'

export const authClient = createAuthClient({
  // Omit a hardcoded baseURL so the client calls the auth API on the SAME origin
  // it is served from (works in local dev and on any deployed domain). Only set an
  // explicit baseURL if NEXT_PUBLIC_APP_URL is provided (e.g. a split auth host).
  baseURL: process.env.NEXT_PUBLIC_APP_URL || undefined,
  plugins: [inferAdditionalFields<typeof auth>()],
})
