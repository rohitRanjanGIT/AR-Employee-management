'use server'

import { db } from '@/db'
import { users, employees, sessions, siteSupervisorAssignments } from '@/db/schema'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { uploadImage, deleteImage } from '@/lib/cloudinary'

async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session || session.user.role !== 'admin') throw new Error('Unauthorised')
  return session
}

// ─── Photo upload (employee/supervisor) ───────────────────────────────────────

export async function uploadEmployeePhoto(formData: FormData): Promise<{ publicId: string; url: string }> {
  await requireAdmin()
  const file = formData.get('file')
  if (!(file instanceof File)) throw new Error('No file provided')
  return uploadImage(file, 'employee')
}

const createSupervisorSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  phone: z.string().max(15).optional(),
  joinDate: z.string().optional(),
  salaryMonthly: z.string().optional(),
  cityId: z.string().uuid().optional(),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  accountNumber: z.string().max(40).optional(),
  ifscCode: z.string().max(20).optional(),
  photoPublicId: z.string().optional(),
  photoUrl: z.string().optional(),
})

export async function createSupervisor(input: z.infer<typeof createSupervisorSchema>) {
  await requireAdmin()
  const data = createSupervisorSchema.parse(input)

  const existing = await db.query.users.findFirst({
    where: eq(users.email, data.email),
  })
  if (existing) throw new Error('Email already in use')

  const result = await auth.api.signUpEmail({
    body: {
      email: data.email,
      password: data.password,
      name: data.name,
    },
  })

  if (!result?.user?.id) throw new Error('Failed to create user account')

  await db
    .update(users)
    .set({ role: 'supervisor', status: 'active' })
    .where(eq(users.id, result.user.id))

  await db.insert(employees).values({
    userId: result.user.id,
    name: data.name,
    phone: data.phone ?? null,
    joinDate: data.joinDate ? new Date(data.joinDate) : null,
    salaryMonthly: data.salaryMonthly ?? null,
    cityId: data.cityId ?? null,
    dateOfBirth: data.dateOfBirth ?? null,
    accountNumber: data.accountNumber ?? null,
    ifscCode: data.ifscCode ?? null,
    photoCloudinaryPublicId: data.photoPublicId ?? null,
    photoCloudinaryUrl: data.photoUrl ?? null,
    status: 'active',
  })

  revalidatePath('/admin/supervisors')
}

export async function getAllSupervisors() {
  await requireAdmin()

  const rows = await db.query.employees.findMany({
    with: {
      user: true,
      city: true,
      siteSupervisorAssignments: {
        with: { site: { with: { city: true } } },
      },
    },
  })

  return rows
    .filter((e) => e.user.role === 'supervisor')
    .map((e) => ({
      id: e.id,
      userId: e.userId,
      name: e.name,
      email: e.user.email,
      phone: e.phone,
      joinDate: e.joinDate,
      salaryMonthly: e.salaryMonthly,
      dateOfBirth: e.dateOfBirth,
      accountNumber: e.accountNumber,
      ifscCode: e.ifscCode,
      photoUrl: e.photoCloudinaryUrl,
      photoPublicId: e.photoCloudinaryPublicId,
      homeCity: e.city ? { id: e.city.id, name: e.city.name } : null,
      status: e.status,
      assignedSites: e.siteSupervisorAssignments.map((a) => ({
        siteId: a.site.id,
        siteName: a.site.name,
        siteCode: a.site.code,
        cityName: a.site.city.name,
      })),
    }))
}

export async function deactivateSupervisor(employeeId: string) {
  await requireAdmin()

  const employee = await db.query.employees.findFirst({
    where: eq(employees.id, employeeId),
    with: { user: true },
  })
  if (!employee) throw new Error('Supervisor not found')
  if (employee.status === 'inactive') throw new Error('Supervisor already inactive')

  await db
    .update(users)
    .set({ status: 'inactive' })
    .where(eq(users.id, employee.userId))

  await db
    .update(employees)
    .set({ status: 'inactive' })
    .where(eq(employees.id, employeeId))

  await db.delete(sessions).where(eq(sessions.userId, employee.userId))

  await db
    .delete(siteSupervisorAssignments)
    .where(eq(siteSupervisorAssignments.employeeId, employeeId))

  revalidatePath('/admin/supervisors')
  revalidatePath('/admin/sites')
}

const updateSupervisorSchema = z.object({
  name: z.string().min(1).max(200),
  phone: z.string().max(15).optional(),
  joinDate: z.string().optional(),
  salaryMonthly: z.string().optional(),
  cityId: z.string().uuid().optional(),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  accountNumber: z.string().max(40).optional(),
  ifscCode: z.string().max(20).optional(),
  photoPublicId: z.string().optional(),
  photoUrl: z.string().optional(),
})

export async function updateSupervisor(
  employeeId: string,
  input: z.infer<typeof updateSupervisorSchema>
) {
  await requireAdmin()
  const data = updateSupervisorSchema.parse(input)

  const employee = await db.query.employees.findFirst({
    where: eq(employees.id, employeeId),
  })
  if (!employee) throw new Error('Supervisor not found')

  // Delete the previous photo when it is being replaced or removed.
  if (
    employee.photoCloudinaryPublicId &&
    employee.photoCloudinaryPublicId !== (data.photoPublicId ?? null)
  ) {
    await deleteImage(employee.photoCloudinaryPublicId)
  }

  await db
    .update(employees)
    .set({
      name: data.name,
      phone: data.phone ?? null,
      joinDate: data.joinDate ? new Date(data.joinDate) : null,
      salaryMonthly: data.salaryMonthly ?? null,
      cityId: data.cityId ?? null,
      dateOfBirth: data.dateOfBirth ?? null,
      accountNumber: data.accountNumber ?? null,
      ifscCode: data.ifscCode ?? null,
      photoCloudinaryPublicId: data.photoPublicId ?? null,
      photoCloudinaryUrl: data.photoUrl ?? null,
    })
    .where(eq(employees.id, employeeId))

  await db.update(users).set({ name: data.name }).where(eq(users.id, employee.userId))

  revalidatePath('/admin/supervisors')
}

export async function reactivateSupervisor(employeeId: string) {
  await requireAdmin()

  const employee = await db.query.employees.findFirst({
    where: eq(employees.id, employeeId),
    with: { user: true },
  })
  if (!employee) throw new Error('Supervisor not found')
  if (employee.status === 'active') throw new Error('Supervisor already active')

  await db
    .update(users)
    .set({ status: 'active' })
    .where(eq(users.id, employee.userId))

  await db
    .update(employees)
    .set({ status: 'active' })
    .where(eq(employees.id, employeeId))

  revalidatePath('/admin/supervisors')
}
