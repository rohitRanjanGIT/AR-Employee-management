import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  decimal,
  uuid,
  jsonb,
  pgEnum,
} from 'drizzle-orm/pg-core'

// ─── Enums ────────────────────────────────────────────────────────────────────

export const roleEnum = pgEnum('role', ['admin', 'supervisor', 'accounts', 'sales'])
export const workerStatusEnum = pgEnum('worker_status', ['pending', 'active', 'rejected'])
export const workerCategoryEnum = pgEnum('worker_category', ['skilled', 'semi_skilled', 'helper'])
export const siteStatusEnum = pgEnum('site_status', ['active', 'inactive'])

// ─── better-auth tables ───────────────────────────────────────────────────────

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  role: roleEnum('role').notNull().default('supervisor'),
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

// ─── Cities ───────────────────────────────────────────────────────────────────

export const cities = pgTable('cities', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  shortCode: text('short_code').notNull().unique(),
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
  age: integer('age'),
  phone: text('phone'),
  address: text('address'),
  joinDate: timestamp('join_date'),
  emergencyContact: text('emergency_contact'),
  category: workerCategoryEnum('category').notNull(),
  wageDaily: decimal('wage_daily', { precision: 10, scale: 2 }).notNull(),
  otRate: decimal('ot_rate', { precision: 10, scale: 2 }),
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
