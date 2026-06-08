'use server'

import { db } from '@/db'
import { workTypes } from '@/db/schema'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session || session.user.role !== 'admin') throw new Error('Unauthorised')
  return session
}

const nameSchema = z.object({ name: z.string().min(1).max(100) })

export async function createWorkType(input: z.infer<typeof nameSchema>) {
  await requireAdmin()
  const data = nameSchema.parse(input)

  const existing = await db.query.workTypes.findFirst({
    where: (wt, { eq }) => eq(wt.name, data.name),
  })
  if (existing) throw new Error('Work type name already in use')

  await db.insert(workTypes).values(data)
  revalidatePath('/admin/work-types')
}

export async function updateWorkType(id: string, input: z.infer<typeof nameSchema>) {
  await requireAdmin()
  const data = nameSchema.parse(input)

  const conflict = await db.query.workTypes.findFirst({
    where: (wt, { and, eq, ne }) => and(eq(wt.name, data.name), ne(wt.id, id)),
  })
  if (conflict) throw new Error('Work type name already in use')

  await db.update(workTypes).set({ name: data.name }).where(eq(workTypes.id, id))
  revalidatePath('/admin/work-types')
}

export async function deleteWorkType(id: string) {
  await requireAdmin()

  const used = await db.query.siteWorkTypes.findFirst({
    where: (swt, { eq }) => eq(swt.workTypeId, id),
  })
  if (used) throw new Error('Cannot delete: work type is assigned to one or more sites')

  await db.delete(workTypes).where(eq(workTypes.id, id))
  revalidatePath('/admin/work-types')
}

export async function getAllWorkTypes() {
  return db.query.workTypes.findMany({ orderBy: (wt, { asc }) => [asc(wt.name)] })
}
