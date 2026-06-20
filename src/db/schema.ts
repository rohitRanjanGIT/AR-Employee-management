import {
  pgTable,
  text,
  timestamp,
  boolean,
  decimal,
  uuid,
  jsonb,
  pgEnum,
  date,
  unique,
  index,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

// ─── Enums ────────────────────────────────────────────────────────────────────

export const roleEnum = pgEnum('role', ['admin', 'supervisor', 'accounts', 'sales'])
export const workerStatusEnum = pgEnum('worker_status', ['pending', 'active', 'rejected', 'archived'])
export const workerCategoryEnum = pgEnum('worker_category', ['skilled', 'semi_skilled', 'helper'])
export const siteStatusEnum = pgEnum('site_status', ['active', 'inactive'])
export const otEnum = pgEnum('ot_type', ['none', '2hr', '4hr'])
export const attendanceStatusEnum = pgEnum('attendance_status', ['full', 'half', 'absent'])
export const editRequestStatusEnum = pgEnum('edit_request_status', ['pending', 'approved', 'rejected'])

// ─── better-auth tables ───────────────────────────────────────────────────────

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  role: roleEnum('role').notNull().default('supervisor'),
  status: text('status', { enum: ['active', 'inactive'] }).notNull().default('active'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expires_at').notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
})

export const accounts = pgTable('accounts', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at'),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const verifications = pgTable('verifications', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

// ─── States ───────────────────────────────────────────────────────────────────

export const states = pgTable('states', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

// ─── Cities ───────────────────────────────────────────────────────────────────

export const cities = pgTable('cities', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  shortCode: text('short_code').notNull().unique(),
  stateId: uuid('state_id')
    .notNull()
    .references(() => states.id),
  status: text('status', { enum: ['active', 'inactive'] }).notNull().default('active'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

// ─── Employees ────────────────────────────────────────────────────────────────

export const employees = pgTable('employees', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id')
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  phone: text('phone'),
  joinDate: timestamp('join_date'),
  aadhaarEncrypted: text('aadhaar_encrypted'),
  aadhaarLastFour: text('aadhaar_last_four'),
  aadhaarRevealLogs: jsonb('aadhaar_reveal_logs').default('[]'),
  salaryMonthly: decimal('salary_monthly', { precision: 12, scale: 2 }),
  cityId: uuid('city_id').references(() => cities.id),
  dateOfBirth: date('date_of_birth'),
  accountNumber: text('account_number'),
  ifscCode: text('ifsc_code'),
  photoCloudinaryPublicId: text('photo_cloudinary_public_id'),
  photoCloudinaryUrl: text('photo_cloudinary_url'),
  status: text('status', { enum: ['active', 'inactive'] }).notNull().default('active'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

// ─── Work Types ───────────────────────────────────────────────────────────────

export const workTypes = pgTable('work_types', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

// ─── Sites ────────────────────────────────────────────────────────────────────

export const sites = pgTable('sites', {
  id: uuid('id').primaryKey().defaultRandom(),
  cityId: uuid('city_id')
    .notNull()
    .references(() => cities.id),
  name: text('name').notNull(),
  code: text('code').notNull().unique(),
  tenderPrice: decimal('tender_price', { precision: 14, scale: 2 }),
  totalProjectCost: decimal('total_project_cost', { precision: 14, scale: 2 }),
  status: siteStatusEnum('status').notNull().default('active'),
  // Attendance time windows — plain HH:MM 24-hour strings; null means no restriction
  morningAttendanceStart: text('morning_attendance_start'),
  morningAttendanceEnd: text('morning_attendance_end'),
  eveningAttendanceStart: text('evening_attendance_start'),
  eveningAttendanceEnd: text('evening_attendance_end'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

// ─── Site Work Types (junction) ───────────────────────────────────────────────

export const siteWorkTypes = pgTable('site_work_types', {
  id: uuid('id').primaryKey().defaultRandom(),
  siteId: uuid('site_id')
    .notNull()
    .references(() => sites.id, { onDelete: 'cascade' }),
  workTypeId: uuid('work_type_id')
    .notNull()
    .references(() => workTypes.id, { onDelete: 'cascade' }),
})

// ─── Site Supervisor Assignments (junction) ───────────────────────────────────

export const siteSupervisorAssignments = pgTable('site_supervisor_assignments', {
  id: uuid('id').primaryKey().defaultRandom(),
  siteId: uuid('site_id')
    .notNull()
    .references(() => sites.id, { onDelete: 'cascade' }),
  employeeId: uuid('employee_id')
    .notNull()
    .references(() => employees.id, { onDelete: 'cascade' }),
  assignedAt: timestamp('assigned_at').notNull().defaultNow(),
})

// ─── Workers ──────────────────────────────────────────────────────────────────

export const workers = pgTable('workers', {
  id: uuid('id').primaryKey().defaultRandom(),
  cityId: uuid('city_id')
    .notNull()
    .references(() => cities.id),
  submittedBy: uuid('submitted_by').references(() => employees.id),
  name: text('name').notNull(),
  dateOfBirth: date('date_of_birth'),
  phone: text('phone'),
  address: text('address'),
  joinDate: timestamp('join_date'),
  emergencyContact: text('emergency_contact'),
  accountNumber: text('account_number'),
  ifscCode: text('ifsc_code'),
  photoCloudinaryPublicId: text('photo_cloudinary_public_id'),
  photoCloudinaryUrl: text('photo_cloudinary_url'),
  category: workerCategoryEnum('category').notNull(),
  wageDaily: decimal('wage_daily', { precision: 10, scale: 2 }).notNull(),
  otRate2hr: decimal('ot_rate_2hr', { precision: 10, scale: 2 }),
  otRate4hr: decimal('ot_rate_4hr', { precision: 10, scale: 2 }),
  otRate6hr: decimal('ot_rate_6hr', { precision: 10, scale: 2 }),
  aadhaarEncrypted: text('aadhaar_encrypted'),
  aadhaarLastFour: text('aadhaar_last_four'),
  aadhaarRevealLogs: jsonb('aadhaar_reveal_logs').default('[]'),
  status: workerStatusEnum('status').notNull().default('pending'),
  rejectionReason: text('rejection_reason'),
  resubmitted: boolean('resubmitted').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

// ─── Site Snapshots ───────────────────────────────────────────────────────────

export const siteSnapshots = pgTable('site_snapshots', {
  id: uuid('id').primaryKey().defaultRandom(),
  siteId: uuid('site_id')
    .notNull()
    .references(() => sites.id),
  deactivatedAt: timestamp('deactivated_at').notNull().defaultNow(),
  supervisors: jsonb('supervisors').notNull().default('[]'),
  workers: jsonb('workers').default('[]'),
  wageTotals: jsonb('wage_totals'),
  materials: jsonb('materials'),
  expenses: jsonb('expenses'),
})

// ─── Attendance ───────────────────────────────────────────────────────────────

export const attendance = pgTable(
  'attendance',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    siteId: uuid('site_id')
      .notNull()
      .references(() => sites.id),
    workerId: uuid('worker_id')
      .notNull()
      .references(() => workers.id),
    cityId: uuid('city_id')
      .notNull()
      .references(() => cities.id),
    date: date('date').notNull(),

    morningMarkedAt: timestamp('morning_marked_at'),
    morningMarkedBy: uuid('morning_marked_by').references(() => employees.id),

    eveningMarkedAt: timestamp('evening_marked_at'),
    eveningMarkedBy: uuid('evening_marked_by').references(() => employees.id),

    ot: otEnum('ot').notNull().default('none'),

    wageDailySnapshot: decimal('wage_daily_snapshot', { precision: 10, scale: 2 }).notNull(),
    otRateSnapshot: decimal('ot_rate_snapshot', { precision: 10, scale: 2 }),

    derivedStatus: attendanceStatusEnum('derived_status').notNull().default('half'),

    isMorningLate: boolean('is_morning_late').notNull().default(false),
    isEveningLate: boolean('is_evening_late').notNull().default(false),

    isEdited: boolean('is_edited').notNull().default(false),
    editRequest: jsonb('edit_request'),
    editRequestStatus: editRequestStatusEnum('edit_request_status'),

    isLocked: boolean('is_locked').notNull().default(false),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    workerSiteDateUnique: unique().on(table.workerId, table.siteId, table.date),
  })
)

// ─── Site Photos ──────────────────────────────────────────────────────────────
// The SITE owns the photo (site_id is the primary relationship); uploaded_by is
// attribution only. city_id is DENORMALIZED — snapshotted from the site's current
// city at upload time (matches the attendance precedent), never re-synced.

export const sitePhotos = pgTable(
  'site_photos',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // Nullable: site-less (admin-only) general photos (e.g. brochures) have no site;
    // cityId is the denormalized snapshot of the site's city when a site is attached.
    siteId: uuid('site_id').references(() => sites.id, { onDelete: 'cascade' }),
    cityId: uuid('city_id').references(() => cities.id),
    uploadedBy: text('uploaded_by')
      .notNull()
      .references(() => users.id),
    description: text('description'),
    tags: text('tags').array().notNull().default([]),
    cloudinaryPublicId: text('cloudinary_public_id').notNull(),
    cloudinaryUrl: text('cloudinary_url').notNull(),
    takenAt: timestamp('taken_at', { withTimezone: true }),
    uploadedAt: timestamp('uploaded_at', { withTimezone: true }).notNull().defaultNow(),
    isHidden: boolean('is_hidden').notNull().default(false),
    hiddenAt: timestamp('hidden_at', { withTimezone: true }),
    hiddenBy: text('hidden_by').references(() => users.id),
  },
  (table) => ({
    siteUploadedIdx: index('site_photos_site_uploaded_idx').on(
      table.siteId,
      table.uploadedAt.desc()
    ),
    uploadedByIdx: index('site_photos_uploaded_by_idx').on(table.uploadedBy),
    cityIdx: index('site_photos_city_idx').on(table.cityId),
    tagsIdx: index('site_photos_tags_idx').using('gin', table.tags),
  })
)

// ─── Relations ────────────────────────────────────────────────────────────────

export const usersRelations = relations(users, ({ one }) => ({
  employee: one(employees, { fields: [users.id], references: [employees.userId] }),
}))

export const statesRelations = relations(states, ({ many }) => ({
  cities: many(cities),
}))

export const citiesRelations = relations(cities, ({ one, many }) => ({
  state: one(states, { fields: [cities.stateId], references: [states.id] }),
  sites: many(sites),
  employees: many(employees),
}))

export const sitesRelations = relations(sites, ({ one, many }) => ({
  city: one(cities, { fields: [sites.cityId], references: [cities.id] }),
  siteWorkTypes: many(siteWorkTypes),
  siteSupervisorAssignments: many(siteSupervisorAssignments),
  siteSnapshots: many(siteSnapshots),
  attendance: many(attendance),
  sitePhotos: many(sitePhotos),
}))

export const workTypesRelations = relations(workTypes, ({ many }) => ({
  siteWorkTypes: many(siteWorkTypes),
}))

export const siteWorkTypesRelations = relations(siteWorkTypes, ({ one }) => ({
  site: one(sites, { fields: [siteWorkTypes.siteId], references: [sites.id] }),
  workType: one(workTypes, { fields: [siteWorkTypes.workTypeId], references: [workTypes.id] }),
}))

export const siteSupervisorAssignmentsRelations = relations(
  siteSupervisorAssignments,
  ({ one }) => ({
    site: one(sites, { fields: [siteSupervisorAssignments.siteId], references: [sites.id] }),
    employee: one(employees, {
      fields: [siteSupervisorAssignments.employeeId],
      references: [employees.id],
    }),
  })
)

export const siteSnapshotsRelations = relations(siteSnapshots, ({ one }) => ({
  site: one(sites, { fields: [siteSnapshots.siteId], references: [sites.id] }),
}))

export const employeesRelations = relations(employees, ({ one, many }) => ({
  user: one(users, { fields: [employees.userId], references: [users.id] }),
  city: one(cities, { fields: [employees.cityId], references: [cities.id] }),
  siteSupervisorAssignments: many(siteSupervisorAssignments),
  submittedWorkers: many(workers),
  morningMarkedAttendance: many(attendance, { relationName: 'morningMarker' }),
  eveningMarkedAttendance: many(attendance, { relationName: 'eveningMarker' }),
}))

export const workersRelations = relations(workers, ({ one, many }) => ({
  city: one(cities, { fields: [workers.cityId], references: [cities.id] }),
  submittedByEmployee: one(employees, {
    fields: [workers.submittedBy],
    references: [employees.id],
  }),
  attendance: many(attendance),
}))

export const sitePhotosRelations = relations(sitePhotos, ({ one }) => ({
  site: one(sites, { fields: [sitePhotos.siteId], references: [sites.id] }),
  city: one(cities, { fields: [sitePhotos.cityId], references: [cities.id] }),
  uploadedByUser: one(users, {
    fields: [sitePhotos.uploadedBy],
    references: [users.id],
    relationName: 'photoUploader',
  }),
  hiddenByUser: one(users, {
    fields: [sitePhotos.hiddenBy],
    references: [users.id],
    relationName: 'photoHider',
  }),
}))

export const attendanceRelations = relations(attendance, ({ one }) => ({
  site: one(sites, { fields: [attendance.siteId], references: [sites.id] }),
  worker: one(workers, { fields: [attendance.workerId], references: [workers.id] }),
  city: one(cities, { fields: [attendance.cityId], references: [cities.id] }),
  morningMarkedByEmployee: one(employees, {
    fields: [attendance.morningMarkedBy],
    references: [employees.id],
    relationName: 'morningMarker',
  }),
  eveningMarkedByEmployee: one(employees, {
    fields: [attendance.eveningMarkedBy],
    references: [employees.id],
    relationName: 'eveningMarker',
  }),
}))
