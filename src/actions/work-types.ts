'use server'

import { db } from '@/db'
import { workTypes } from '@/db/schema'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session || session.user.role !== 'admin') throw new Error('Unauthorised')
  return session
}

const createWorkTypeSchema = z.object({
  name: z.string().min(1).max(100),
})

export async function createWorkType(input: z.infer<typeof createWorkTypeSchema>) {
  await requireAdmin()
  const data = createWorkTypeSchema.parse(input)

  const existing = await db.query.workTypes.findFirst({
    where: (wt, { eq }) => eq(wt.name, data.name),
  })
  if (existing) throw new Error('Work type name already in use')

  await db.insert(workTypes).values(data)
  revalidatePath('/admin/work-types')
}

export async function getAllWorkTypes() {
  return db.query.workTypes.findMany({ orderBy: (wt, { asc }) => [asc(wt.name)] })
}
