# Anuranjan EMS — Agent Context

## What this project is

A construction company Employee Management System for **Anuranjan**. It manages construction sites across Indian cities, the supervisors assigned to them, and the workers employed at each site. Built as a Next.js web app deployed on Vercel with a Neon Postgres database.

---

## Tech stack

| Concern | Library |
|---|---|
| Framework | Next.js 15 App Router (RSC + server actions) |
| Database | Neon Postgres via `@neondatabase/serverless` |
| ORM | Drizzle ORM (`drizzle-orm` + `drizzle-kit`) |
| Auth | better-auth (email/password, session cookies) |
| UI components | shadcn/ui — **base-nova style** (uses `@base-ui/react`, NOT Radix UI) |
| Styling | Tailwind CSS v4 |
| Tables | TanStack Table v8 |
| Forms | react-hook-form v7 + zod v4 + `@hookform/resolvers` v5 |
| Package manager | pnpm (use `pnpm`, never `npm` or `yarn`) |
| Deployment | Vercel |

---

## Roles

Four roles exist in the `role` enum: `admin`, `supervisor`, `accounts`, `sales`.

Only `admin` and `supervisor` have UI built so far.

| Role | Entry point | Access |
|---|---|---|
| `admin` | `/admin/dashboard` | Full management of states, cities, sites, work types, workers |
| `supervisor` | `/supervisor/dashboard` | Assigned sites + submit/resubmit workers |

**Seed credentials:**
- Admin: `admin@anuranjan.com` / `Admin@1234`
- Supervisor: `supervisor@anuranjan.com` / `Supervisor@1234`

---

## Key file locations

```
src/
├── env.ts                        # env var validation — import env vars from here, never process.env!
├── db/
│   ├── schema.ts                 # ALL 13 tables + all Drizzle relations in one file
│   ├── index.ts                  # Drizzle client (exports `db`)
│   ├── seed.ts                   # Seeds users, work type, sample state/city/site, supervisor assignment (idempotent)
│   └── migrate-ot-rates.ts       # One-off: splits ot_rate into ot_rate_2hr/4hr/6hr (already run)
├── lib/
│   ├── auth.ts                   # better-auth server instance (exports `auth`)
│   ├── auth-client.ts            # better-auth client (exports `authClient`)
│   ├── utils.ts                  # shadcn `cn()` utility
│   ├── india-geo.ts              # Static map: Indian state → major cities list
│   ├── aadhaar.ts                # Server-only: AES-256-GCM encrypt/decrypt + re-exports from aadhaar-validate
│   └── aadhaar-validate.ts       # Client-safe: Verhoeff checksum (validateAadhaar), maskAadhaar
├── middleware.ts                 # Optimistic session cookie check, redirects to /login
├── actions/
│   ├── states.ts                 # createState, getAllStates (with city+site counts)
│   ├── cities.ts                 # createCity, getAllCities (with state), cityHasActiveSites
│   ├── work-types.ts             # createWorkType, updateWorkType, deleteWorkType, getAllWorkTypes
│   ├── sites.ts                  # createSite, getAllSites, getSupervisorSites,
│   │                             # getSupervisorEmployees (active only), assignSupervisorToSite,
│   │                             # revokeSupervisorFromSite, deactivateSite, getSiteSnapshot
│   ├── supervisors.ts            # createSupervisor, getAllSupervisors, updateSupervisor,
│   │                             # deactivateSupervisor, reactivateSupervisor
│   └── workers.ts                # createWorkerAsAdmin, submitWorkerAsSupervisor, getAllWorkers,
│                                 # getWorkersForSupervisor, approveWorker, rejectWorker,
│                                 # resubmitWorker, updateWorker, deleteWorker,
│                                 # revealAadhaar, reassignWorkerCity
├── components/
│   ├── AdminNav.tsx              # Tab nav for admin (client, uses usePathname)
│   ├── SupervisorNav.tsx         # Tab nav for supervisor
│   └── ui/                       # shadcn components (base-nova style)
└── app/
    ├── page.tsx                  # Redirects to /login
    ├── login/page.tsx            # Email/password login
    ├── admin/
    │   ├── layout.tsx            # Auth check + header + AdminNav (shared for all admin pages)
    │   ├── dashboard/page.tsx
    │   ├── cities/
    │   │   ├── page.tsx          # Server: fetches cities + states
    │   │   └── CitiesClient.tsx  # Two-section UI: States table + Cities table
    │   ├── work-types/
    │   │   ├── page.tsx
    │   │   └── WorkTypesClient.tsx  # Create/edit/delete work types
    │   ├── sites/
    │   │   ├── page.tsx          # Server: fetches sites + supervisors + work types + cities
    │   │   ├── SitesTable.tsx    # Main TanStack table with filters
    │   │   ├── CreateSiteDialog.tsx
    │   │   ├── AssignSupervisorDialog.tsx
    │   │   ├── DeactivateSiteDialog.tsx
    │   │   ├── SiteSupervisorList.tsx
    │   │   └── [siteId]/snapshot/page.tsx
    │   ├── supervisors/
    │   │   ├── page.tsx              # Server: fetches supervisors + active cities
    │   │   ├── SupervisorsTable.tsx  # TanStack table with status filter
    │   │   ├── CreateSupervisorDialog.tsx
    │   │   ├── EditSupervisorDialog.tsx
    │   │   └── DeactivateConfirmDialog.tsx  # handles both deactivate + reactivate
    │   └── workers/
    │       ├── page.tsx              # Server: fetches workers + active cities
    │       ├── WorkersTable.tsx      # TanStack table; simplified columns; View/Approve/Reject per row
    │       ├── WorkerDetailDialog.tsx  # View all fields; Approve/Reject/Edit/Delete actions
    │       ├── CreateWorkerDialog.tsx
    │       ├── ApproveWorkerDialog.tsx
    │       ├── RejectWorkerDialog.tsx
    │       ├── EditWorkerDialog.tsx
    │       ├── ReassignCityDialog.tsx
    │       └── AadhaarRevealButton.tsx  # 30s auto-mask, reveal logging
    └── supervisor/
        ├── layout.tsx            # Auth check + header + SupervisorNav + status guard
        ├── dashboard/page.tsx    # Shows assigned site count + pending worker submissions
        ├── sites/page.tsx        # Card grid of assigned sites (read-only)
        └── workers/
            ├── page.tsx          # Server: workers + assigned cities
            ├── WorkersList.tsx   # Tabbed: Active / My Submissions / Rejected
            ├── SubmitWorkerDialog.tsx
            └── ResubmitWorkerDialog.tsx
```

All admin and supervisor route folders have a `loading.tsx` skeleton.

---

## Database schema (13 tables)

Declaration order in `schema.ts` matters due to FK references:

```
users, sessions, accounts, verifications   ← better-auth (text PKs)
states                                     ← uuid PK
cities                                     ← uuid PK, FK → states
employees                                  ← uuid PK, FK → users + cities
work_types                                 ← uuid PK
sites                                      ← uuid PK, FK → cities
site_work_types                            ← junction: sites × work_types
site_supervisor_assignments               ← junction: sites × employees
workers                                    ← uuid PK, FK → cities + employees
site_snapshots                             ← uuid PK, FK → sites (JSONB payload)
```

All Drizzle `relations()` are declared at the **bottom** of `schema.ts` — never inline with table declarations.

**Key facts:**
- `cities.stateId` is NOT NULL — state is required when creating a city
- `cities.status` and `sites.status` use `text` enum: `'active' | 'inactive'`
- `site_snapshots.supervisors` is JSONB — captures supervisor list at deactivation time
- `employees.userId` links an employee record to a better-auth user (1:1, unique)
- `workers` are separate from `employees` — employees are company staff (supervisors etc.), workers are site labour
- `workers.aadhaarEncrypted` is NEVER returned to the client — always stripped with destructuring before returning
- `workers.otRate2hr / otRate4hr / otRate6hr` — three OT rate tiers (2hr, 4hr, 6hr overtime); single `otRate` column was removed

**Worker business rules:**
- Aadhaar is required (not optional) and validated with Verhoeff checksum
- Age must be 18–45
- Phone must be unique across all workers and employees
- Workers created by admin start as `active`; submitted by supervisor start as `pending`
- `aadhaarEncrypted` is stripped from all query results before returning to client
- Admin reveal is logged to `aadhaarRevealLogs` JSONB and auto-hides after 30s in UI

---

## Conventions — read before writing any code

### Environment variables
Always import from `src/env.ts`, never use `process.env.X!` directly:
```ts
import { env } from '@/env'
const url = env.DATABASE_URL
```
Exception: `drizzle.config.ts` and `src/db/migrate-*.ts` (CLI/script context, use `dotenv/config` + `process.env`).

### Role checks
Must be the **first** thing in every server component and every server action:
```ts
const session = await auth.api.getSession({ headers: await headers() })
if (!session || session.user.role !== 'admin') redirect('/login') // or throw new Error
```

### Server actions pattern
- File: `src/actions/<module>.ts` with `'use server'` at top
- Auth guard function (`requireAdmin` / `requireAuth`) defined at top of each file
- `revalidatePath` called after mutations
- Client components call `router.refresh()` after a successful action to re-render server data

### Page structure (server + client split)
```
page.tsx          ← server component: role check, DB fetch, pass data as props
FooClient.tsx     ← client component: state, forms, dialogs, TanStack table
```

### Forms
Use `react-hook-form` directly with `register` or `Controller`. The shadcn `form` component is **not available** in base-nova style — do not try to install it.

**Pre-filling edit forms:** always use the `values` prop on `useForm` (not `useEffect` + `reset`):
```ts
useForm({ values: supervisor ? { name: supervisor.name, ... } : undefined })
```

### Drizzle queries
Use `db.query.<table>.findMany({ with: { ... } })` for relational queries. Raw `db.select()` for aggregations (count, group by).

### Schema changes
`drizzle-kit push` requires an interactive TTY and will prompt on column drops. For non-interactive environments (CI, Claude Code tool), write a `src/db/migrate-*.ts` script using `@neondatabase/serverless` directly and run it with `pnpm exec tsx src/db/migrate-*.ts`.

---

## base-nova shadcn — critical differences from standard shadcn

The project uses **base-nova** style which wraps `@base-ui/react` primitives, not Radix UI. The component APIs look similar but have important differences:

### 1. Select does not show item labels in the trigger
`Select.Value` renders the raw `value` string (e.g. a UUID), not the selected item's label. **Always** track the display name in local state and render it directly:

```tsx
const [selectedName, setSelectedName] = useState('')

<Select onValueChange={(v: string | null) => {
  if (v) {
    setSelectedName(items.find(i => i.id === v)?.name ?? '')
    // other updates
  }
}}>
  <SelectTrigger className="w-full">
    <span className={selectedName ? 'text-foreground' : 'text-muted-foreground'}>
      {selectedName || 'Select an option'}
    </span>
  </SelectTrigger>
  <SelectContent>
    {items.map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
  </SelectContent>
</Select>
```

Do **not** import or use `<SelectValue />` for selects that use non-string display values (UUIDs etc.).

### 2. Dialog uses named exports (not dot notation)

```tsx
// ✅ Correct
import { Dialog, DialogContent, DialogTitle, DialogTrigger, DialogClose, DialogFooter } from '@/components/ui/dialog'

<Dialog open={open} onOpenChange={setOpen}>
  <DialogTrigger render={<Button>Open</Button>} />
  <DialogContent>
    <DialogTitle>Title</DialogTitle>
    {/* content */}
    <DialogFooter>
      <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
      <Button type="submit">Save</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>

// ❌ Wrong — Radix dot notation does not exist here
<Dialog.Root> <Dialog.Trigger> <Dialog.Portal>
```

### 3. Trigger / Close render prop
Base UI uses a `render` prop to merge behaviour onto a custom element:
```tsx
<DialogTrigger render={<Button variant="outline" />}>Click me</DialogTrigger>
<DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
```

**PopoverTrigger with non-button element:** add `nativeButton={false}` when the render element is not a `<button>`:
```tsx
<PopoverTrigger nativeButton={false} render={<span className="cursor-pointer" />}>
  Label
</PopoverTrigger>
```

### 4. Select `onValueChange` receives `string | null`
Always handle the null case:
```tsx
onValueChange={(v: string | null) => { if (v) doSomething(v) }}
// or
onValueChange={(v) => setId(v ?? '')}
```

### 5. Checkbox `onCheckedChange`
Receives `(checked: boolean, event: Event)` — not just `boolean`.

---

## Modules completed

| Module | Status | What was built |
|---|---|---|
| 1.0 Foundation | ✅ Done | DB schema, auth, login, dashboards, seed, middleware |
| 1.1 Cities & Sites | ✅ Done | States, cities (with autocomplete), work types, sites, supervisor assignment, deactivation, snapshots |
| 1.1.5 Supervisors | ✅ Done | Create/edit supervisor accounts, view table, deactivate/reactivate, status blocks login, seed creates complete setup |
| 1.2 Workers | ✅ Done | Aadhaar encryption, admin create/approve/reject/reassign, supervisor submit/resubmit, masked Aadhaar with 30s reveal log, tabbed supervisor UI |
| 1.2.5 Worker improvements | ✅ Done | Full CRUD (edit/delete), WorkerDetailDialog, 3-tier OT rates, Aadhaar required+Verhoeff, age 18-45, phone uniqueness, work type edit/delete, loading skeletons, PopoverTrigger fix |

Full specs in `docs/modules/`.

## Modules planned (not started)

- 1.3 Attendance
- 1.4 Wages
- 1.5 Materials
- 1.6 Expenses
- 1.7 Reports

---

## Commands

```bash
pnpm dev                  # Start dev server (Turbopack)
pnpm build                # Production build
pnpm lint                 # ESLint
pnpm tsc --noEmit         # Type check
pnpm drizzle-kit push     # Push schema changes to Neon (interactive — needs TTY)
pnpm seed                 # Run src/db/seed.ts
pnpm exec tsx src/db/migrate-ot-rates.ts  # Already run — splits ot_rate into 3 tiers
```

**Always run `pnpm tsc --noEmit` and `pnpm lint` before finishing any task.**

---

## Security rules

- Aadhaar numbers are encrypted with AES-256-GCM using `AADHAAR_ENCRYPTION_KEY`
- Never log or return decrypted Aadhaar data except through the explicit admin `revealAadhaar` action
- `aadhaarEncrypted` must be stripped from all query results before returning to client (use destructuring: `{ aadhaarEncrypted: _aes, ...w }`)
- Aadhaar reveal is logged to `aadhaarRevealLogs` JSONB on every call
- Role check must be the first line of every server component and server action — no exceptions
- `src/env.ts` must validate all required env vars at startup
- Import `validateAadhaar` from `@/lib/aadhaar-validate` (client-safe) — never from `@/lib/aadhaar` (server-only) in client components
