# Module 1.1 — Cities & Sites

## Objective
Admin can fully manage states, cities, work types, and sites. Supervisor can view their assigned sites only. Site deactivation creates a permanent snapshot. Nothing outside this scope.

---

## Prerequisites
- Module 1.0 gate checklist fully passed
- Admin can log in and reach `/admin/dashboard`
- All 13 tables live in Neon

---

## Scope

**Admin can:**
- Create and view states (with city/site counts)
- Create cities under a state (with auto-suggested short code)
- Create, view, and manage work types
- Create sites under a city (with auto-generated editable code)
- Assign supervisors to sites
- Revoke supervisor access from a site
- Deactivate a site → triggers permanent snapshot
- Cannot create a site under an inactive city

**Supervisor can:**
- View their assigned sites only
- View other supervisors on shared sites
- Cannot create, edit, or deactivate anything

---

## Packages to Install

```bash
pnpm exec shadcn add dialog select checkbox popover separator table --yes
```

> **base-nova note:** The shadcn `form` component is not available in the base-nova registry. Use react-hook-form directly with `register`, `Controller`, and manual error display.

---

## Step 1 — Static Geo Data

Create `src/lib/india-geo.ts` — a static map of all 36 Indian states/UTs to their major cities. Used for autocomplete in the Add State and Add City dialogs. No external API needed.

```ts
export const INDIA_GEO: Record<string, string[]> = {
  'Maharashtra': ['Mumbai', 'Pune', 'Nagpur', /* ... */],
  'Uttar Pradesh': ['Lucknow', 'Kanpur', /* ... */],
  // all 36 states/UTs
}

export const INDIA_STATES = Object.keys(INDIA_GEO).sort()

export function getCitiesForState(state: string): string[] {
  return INDIA_GEO[state] ?? []
}
```

---

## Step 2 — Schema Changes

### Add `states` table (before `cities`)

```ts
export const states = pgTable('states', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})
```

### Add `status` to `cities`, add `stateId` FK (required)

```ts
export const cities = pgTable('cities', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  shortCode: text('short_code').notNull().unique(),
  stateId: uuid('state_id').notNull().references(() => states.id),
  status: text('status', { enum: ['active', 'inactive'] }).notNull().default('active'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})
```

> `stateId` is NOT NULL — state is required when creating a city. Safe to add without a default because the cities table is empty at this point.

### Add all Drizzle relations

Add the following at the bottom of `schema.ts` after all table declarations:

```ts
import { relations } from 'drizzle-orm'

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
}))

export const workTypesRelations = relations(workTypes, ({ many }) => ({
  siteWorkTypes: many(siteWorkTypes),
}))

export const siteWorkTypesRelations = relations(siteWorkTypes, ({ one }) => ({
  site: one(sites, { fields: [siteWorkTypes.siteId], references: [sites.id] }),
  workType: one(workTypes, { fields: [siteWorkTypes.workTypeId], references: [workTypes.id] }),
}))

export const siteSupervisorAssignmentsRelations = relations(siteSupervisorAssignments, ({ one }) => ({
  site: one(sites, { fields: [siteSupervisorAssignments.siteId], references: [sites.id] }),
  employee: one(employees, { fields: [siteSupervisorAssignments.employeeId], references: [employees.id] }),
}))

export const siteSnapshotsRelations = relations(siteSnapshots, ({ one }) => ({
  site: one(sites, { fields: [siteSnapshots.siteId], references: [sites.id] }),
}))

export const employeesRelations = relations(employees, ({ one, many }) => ({
  user: one(users, { fields: [employees.userId], references: [users.id] }),
  city: one(cities, { fields: [employees.cityId], references: [cities.id] }),
  siteSupervisorAssignments: many(siteSupervisorAssignments),
}))
```

After updating schema, run:
```bash
pnpm drizzle-kit push
pnpm tsc --noEmit
```

---

## Step 3 — Server Actions

### `src/actions/states.ts`

```ts
'use server'
// createState(input) — validates unique name, inserts, revalidates /admin/cities
// getAllStates()     — returns states with cityCount and siteCount per state
//                     (3 parallel queries: states + city counts + site counts via city join)
```

`getAllStates` shape:
```ts
{ id, name, createdAt, cityCount: number, siteCount: number }[]
```

### `src/actions/cities.ts`

```ts
'use server'
// createCity(input)          — requires stateId (uuid), name, shortCode; checks unique shortCode
// getAllCities()              — returns cities with state relation included
// cityHasActiveSites(cityId) — exported for future city deactivation logic
```

`createCity` schema:
```ts
z.object({
  name: z.string().min(1).max(100),
  shortCode: z.string().min(2).max(10).toUpperCase(),
  stateId: z.string().uuid('State is required'),
})
```

### `src/actions/work-types.ts`

```ts
'use server'
// createWorkType(input) — validates unique name, inserts, revalidates /admin/work-types
// getAllWorkTypes()      — no auth required (used in site creation)
```

### `src/actions/sites.ts`

```ts
'use server'
// generateSiteCode(cityId, siteName) — {CITY_SHORT_CODE}S{INDEX}{FIRST_2_OF_NAME}
// createSite(input)                  — checks city active, unique code, attaches work types
// getAllSites()                       — admin only, with city + workTypes + supervisorAssignments
// getSupervisorSites()               — returns [] (not throws) if no employee record found
// getSupervisorEmployees()           — joins employees + users WHERE role = 'supervisor'
// assignSupervisorToSite(siteId, employeeId)
// revokeSupervisorFromSite(siteId, employeeId)
// deactivateSite(siteId)             — snapshot → mark inactive → delete assignments
// getSiteSnapshot(siteId)            — admin only, with site + city
```

---

## Step 4 — Shared Layouts & Navigation

### Admin layout — `src/app/admin/layout.tsx`

Server component. Role check (`admin`) is the first thing — redirects to `/login` if failed. Renders:
- Shared header (app name, user display name, Admin badge, logout button)
- `<AdminNav />` tab bar
- `{children}`

All admin pages no longer render their own header — the layout handles it.

### Supervisor layout — `src/app/supervisor/layout.tsx`

Same pattern for `supervisor` role.

### `src/components/AdminNav.tsx` (client component)

Tab nav with active indicator using `usePathname()`. Links:
- Dashboard → `/admin/dashboard`
- Cities → `/admin/cities`
- Sites → `/admin/sites`
- Work Types → `/admin/work-types`

### `src/components/SupervisorNav.tsx` (client component)

Links:
- Dashboard → `/supervisor/dashboard`
- Sites → `/supervisor/sites`

---

## Step 5 — Admin: Work Types Page

`src/app/admin/work-types/page.tsx` — server component, role check, fetches work types, renders `WorkTypesClient`.

`src/app/admin/work-types/WorkTypesClient.tsx` — client component:
- Page title + "Add Work Type" button → `Dialog`
- TanStack Table: Name, Created At
- Empty state: "No work types yet. Add one to get started."
- On success: `router.refresh()` to re-render server component with fresh data

---

## Step 6 — Admin: Cities Page

`src/app/admin/cities/page.tsx` — server component, role check, fetches `[cities, states]` in parallel, renders `CitiesClient`.

`src/app/admin/cities/CitiesClient.tsx` — two sections on one page:

### States section (top)
- TanStack Table columns: **State**, **Cities** (count), **Sites** (count)
- "Add State" button → dialog:
  - Name input with native `<datalist>` autocomplete from `INDIA_STATES`
  - Duplicate name rejected with inline error
- Empty state: "No states added yet. Add a state to get started."

### Cities section (below)
- TanStack Table columns: City, State, Short Code, Status, Added
- "Add City" button → dialog:
  - **State** (required) — Select dropdown from DB states
  - **City Name** (required) — input with `<datalist>` filtered to cities in selected state via `getCitiesForState()`; disabled until state is selected
  - **Short Code** — auto-suggested as first 3 uppercase chars of city name, editable
  - Duplicate short code rejected with inline error
- Empty state changes based on whether states exist

> **City name autocomplete:** When state changes, city name field clears and its datalist repopulates with cities for that state from `india-geo.ts`. Admin can still type any custom name.

> **Short code auto-suggest:** `value.replace(/\s+/g, '').slice(0, 3).toUpperCase()` — fires on every city name keystroke.

---

## Step 7 — Admin: Sites Page

File structure:
```
src/app/admin/sites/
  page.tsx                   ← server component
  SitesTable.tsx             ← TanStack Table, client component
  CreateSiteDialog.tsx       ← create site form
  AssignSupervisorDialog.tsx ← assign supervisor to site
  DeactivateSiteDialog.tsx   ← confirm deactivation
  SiteSupervisorList.tsx     ← inline chip list with revoke popover
  [siteId]/snapshot/page.tsx ← snapshot view
```

### `page.tsx` (server component)
- Role check: admin only
- Fetches in parallel: `getAllSites()`, `getAllWorkTypes()`, `getAllCities()`, `getSupervisorEmployees()`
- Renders `<SitesTable />` with all data as props

### `SitesTable.tsx` (client component)
- Client-side filtering by city and status using `useMemo`
- TanStack Table columns: Site Name, Code (monospace badge), City, Work Types (badges), Supervisors (`SiteSupervisorList`), Tender Price, Project Cost, Status, Actions
- Actions column: active sites → Assign + Deactivate buttons; inactive sites → "View Snapshot" link
- Composes `CreateSiteDialog`, `AssignSupervisorDialog`, `DeactivateSiteDialog`

### `CreateSiteDialog.tsx`
- City Select (required) + site name input + site code (auto-generated, editable) + optional prices + work type checkboxes
- Site code generation: `useEffect` watches `cityId` + `name` with 500ms debounce → calls `generateSiteCode()` server action → populates code field; shows `<RefreshCw>` spinner while pending
- Work types: `useState` array managed separately from react-hook-form (simpler than `useFieldArray`)
- City name is controlled via `Controller` from react-hook-form

### `AssignSupervisorDialog.tsx`
- Filters `supervisors` prop to exclude already-assigned employee IDs
- Shows "All available supervisors already assigned" when list is empty

### `DeactivateSiteDialog.tsx`
- Confirm dialog with site name in body text
- Destructive red button calls `deactivateSite(siteId)`

### `SiteSupervisorList.tsx`
- Inline chip per assignment
- Each chip has ✕ icon → `Popover` confirm → calls `revokeSupervisorFromSite()`
- Empty state: "No supervisors assigned"

---

## Step 8 — Supervisor: Sites Page

`src/app/supervisor/sites/page.tsx` — server component, supervisor role check, calls `getSupervisorSites()`.

- Card grid (shadcn `Card`) — one card per assigned site
- Each card: site name, code (monospace), city, work type badges, other supervisor name chips
- No actions — read only
- Empty state: "You have no assigned sites yet."

> `getSupervisorSites()` returns `[]` (not throws) when no employee record exists for the logged-in user — this is expected for newly created supervisor accounts not yet linked to an employee.

---

## Step 9 — Supervisor Dashboard Update

`src/app/supervisor/dashboard/page.tsx`:
- Calls `getSupervisorSites()` and counts results
- Renders: "You are assigned to {n} site(s)" with a link to `/supervisor/sites`

---

## Step 10 — Site Snapshot View (Admin)

`src/app/admin/sites/[siteId]/snapshot/page.tsx` — server component, admin only.

- Fetches snapshot via `getSiteSnapshot(siteId)`, returns 404 if not found
- Renders site info card (name, code, city, deactivation date)
- Table of supervisors at closure (name, phone, assigned date, deactivated date) from the JSONB `supervisors` field
- Placeholder cards for Workers, Wages, Materials, Expenses: "Data will be available after relevant modules are completed."

---

## Key Implementation Notes

### Site code generation race condition
`generateSiteCode` uses count-based index. Concurrent creation in the same city can produce duplicate codes. The `UNIQUE` constraint on `sites.code` catches this — show a "Code already taken, please edit the code" error and let admin adjust manually.

### Base UI Select display fix
`Select.Value` in base-nova renders the raw value string (UUID), not the item label. **Always** track the display name in local state and render it directly inside `SelectTrigger`. See Module 1.0 for the pattern.

### `router.refresh()` after server actions
Server actions call `revalidatePath` but the client needs `router.refresh()` to actually re-fetch and re-render the server component with fresh data. Call `router.refresh()` in the client after every successful action.

### No city deactivation UI in 1.1
City deactivation is blocked if active sites exist. The helper `cityHasActiveSites()` is exported from `cities.ts` for use in future modules. No deactivation UI is built in 1.1.

---

## Module 1.1 Gate Checklist

```
[ ] Schema updated: states table exists, cities.stateId NOT NULL, cities.status column
[ ] pnpm drizzle-kit push runs without errors
[ ] All Drizzle relations added and pnpm tsc --noEmit passes
[ ] Admin nav shows: Dashboard, Cities, Sites, Work Types
[ ] Supervisor nav shows: Dashboard, Sites

STATES
[ ] Admin can add a state
[ ] State name autocompletes from INDIA_STATES datalist
[ ] Duplicate state name is rejected with inline error
[ ] States table shows: State name, Cities count, Sites count
[ ] Counts update after adding cities / sites to the state

WORK TYPES
[ ] Admin can create a work type
[ ] Duplicate work type name is rejected with inline error
[ ] Work types appear in the table

CITIES
[ ] Admin must add a state before adding a city
[ ] City name field is disabled until a state is selected
[ ] City name autocompletes to cities in the selected state
[ ] Short code is auto-suggested from city name (first 3 chars), editable
[ ] Duplicate short code is rejected with inline error
[ ] Cities appear in the table with correct State column

SITES — CREATE
[ ] Select dropdowns (city, supervisor) show the selected item's name — not a UUID
[ ] Admin can open Create Site dialog
[ ] Selecting city + typing name auto-generates site code
[ ] Site code is editable before saving
[ ] Duplicate site code is rejected with inline error
[ ] Site can be created with no work types
[ ] Site can be created with one or more work types
[ ] Created site appears in the table with correct city, code, work types

SITES — SUPERVISORS
[ ] Admin can assign a supervisor to a site
[ ] Duplicate assignment is rejected with inline error
[ ] Supervisor name appears as a chip on the site row
[ ] Admin can revoke a supervisor from a site via the ✕ chip button
[ ] Revocation requires confirmation before executing

SITES — DEACTIVATION
[ ] Deactivate button appears only on active sites
[ ] Confirmation dialog shows site name
[ ] After deactivation: site status changes to inactive
[ ] After deactivation: all supervisor chips removed from row
[ ] Site snapshot record created in DB (verify in Neon console)
[ ] Snapshot contains correct supervisor list as JSONB
[ ] "View Snapshot" link appears on inactive site rows
[ ] Snapshot page renders: site info + supervisor table + placeholder sections

SUPERVISOR VIEW
[ ] Supervisor can log in and reach /supervisor/dashboard
[ ] Supervisor dashboard shows correct assigned site count with link
[ ] Supervisor sites page shows only their assigned sites
[ ] Supervisor can see other supervisors on shared sites (names only)
[ ] Supervisor cannot see any create/edit/deactivate controls
[ ] Supervisor with no employee record sees 0 sites (no error thrown)

EDGE CASES
[ ] Creating a city without selecting a state is blocked
[ ] Creating a site under an inactive city is blocked
[ ] Deactivating an already-inactive site returns an error

QUALITY
[ ] pnpm tsc --noEmit — zero type errors
[ ] pnpm lint — zero lint errors
[ ] Git commit: "feat: module 1.1 cities and sites"
```

---

*Next: Module 1.2 — Workers*
