function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

export const env = {
  DATABASE_URL: requireEnv('DATABASE_URL'),
  BETTER_AUTH_SECRET: requireEnv('BETTER_AUTH_SECRET'),
  BETTER_AUTH_URL: requireEnv('BETTER_AUTH_URL'),
  AADHAAR_ENCRYPTION_KEY: requireEnv('AADHAAR_ENCRYPTION_KEY'),
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
}
