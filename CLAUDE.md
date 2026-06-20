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
| Image storage | Cloudinary (`cloudinary` v2 SDK, server-side signed upload/delete) |
| Package manager | pnpm (use `pnpm`, never `npm` or `yarn`) |
| Deployment | Vercel |

---

## Roles

Four roles exist in the `role` enum: `admin`, `supervisor`, `accounts`, `sales`.

Only `admin` and `supervisor` have UI built so far.

| Role | Entry point | Access |
|---|---|---|
| `admin` | `/admin/dashboard` | Full management of states, cities, sites, work types, workers; manage other admins + supervisors at `/admin/admins` and `/admin/supervisors` |
| `supervisor` | `/supervisor/dashboard` | Assigned sites + submit/resubmit workers |

**Admins vs supervisors at the data layer:** supervisors are created with an `employees` row (profile: phone/salary/city/site assignments). **Admins have NO `employees` row** — they exist only as a `users` row with `role='admin'` (seed + `create-admin.ts` never insert an employee). The Admins module (`actions/admins.ts`) therefore manages admins purely at the `users` level (name/email/status/password). `/settings` falls back to `session.user.name` when no employee row exists.

**Admin-management guards** (in `actions/admins.ts`): an admin can never act on their **own** account (edit/reset/deactivate/remove are blocked — use `/settings`), and you cannot deactivate or remove the **last active admin** (prevents lockout).

**Session lifetime:** hard 2-hour cap — `auth.ts` sets `session.expiresIn = 7200` with `updateAge = 7200` (equal, so no sliding renewal). Re-login required after 2h. Existing sessions keep their original expiry until they age out.

**Seed credentials:**
- Admin: `admin@anuranjan.com` / `Admin@1234`
- Supervisor: `supervisor@anuranjan.com` / `Supervisor@1234`
- Admin (via `create-admin.ts`): login id `ANURANJAN` / `AIRPL@1357` (stored as `anuranjan@anuranjan.com`)

**Login id mapping:** better-auth requires a valid email at sign-in. The login form maps any
identifier without `@` to `<id>@anuranjan.com` (lowercased) before calling `signIn.email`. So
`ANURANJAN` resolves to `anuranjan@anuranjan.com`. Note this applies to **any** `@anuranjan.com`
account — e.g. `supervisor` resolves to `supervisor@anuranjan.com`. Full emails pass through unchanged.

---

## Key file locations

```
src/
├── env.ts                        # env var validation — import env vars from here, never process.env!
├── db/
│   ├── schema.ts                 # ALL 14 tables + all Drizzle relations in one file
│   ├── index.ts                  # Drizzle client (exports `db`)
│   ├── seed.ts                   # Seeds users, work type, sample state/city/site, supervisor assignment (idempotent)
│   ├── migrate-ot-rates.ts       # One-off: splits ot_rate into ot_rate_2hr/4hr/6hr (already run)
│   ├── migrate-attendance.ts     # One-off: creates attendance table + enums (already run)
│   ├── migrate-attendance-windows.ts  # One-off: adds site time windows + late flags (already run)
│   ├── migrate-profile-bank-dob.ts    # One-off: drops workers.age, adds DOB+bank+photo cols on workers+employees (already run)
│   ├── migrate-worker-archived.ts     # One-off: adds 'archived' to worker_status enum (already run)
│   ├── migrate-site-photos.ts         # One-off: creates site_photos table + indexes incl. GIN on tags (already run)
│   ├── migrate-site-photos-nullable.ts # One-off: makes site_photos.site_id + city_id nullable (already run)
│   └── create-admin.ts           # One-off: creates the ANURANJAN admin (already run, idempotent)
├── lib/
│   ├── auth.ts                   # better-auth server instance (exports `auth`)
│   ├── auth-client.ts            # better-auth client (exports `authClient`)
│   ├── utils.ts                  # shadcn `cn()` + formatDate() (DD/MM/YYYY) + formatDateTime() (DD/MM/YYYY, HH:mm)
│   ├── age.ts                    # computeAge(dob) → display-only age string ('-' when null); age is never stored
│   ├── cloudinary.ts             # Server-only: uploadImage(file, folder)/deleteImage(publicId) via signed SDK
│   │                             # (2 MB max + image-type guard; same cap enforced client-side in PhotoUpload)
│   ├── cloudinary-url.ts         # Client-safe: avatarUrl() injects f_auto/q_auto/c_fill avatar transform
│   ├── india-geo.ts              # Static map: Indian state → major cities list
│   ├── attendance.ts             # todayIST(), classifyDate(), derivedStatus(), isWithinWindow(), computeWageForRow()
│   ├── payroll.ts                # computeRowWage(), month helpers (getMonthBounds/toYearMonth/formatYearMonth/
│   │                             # isCurrentMonth/getMonthRange), formatINR(), payroll aggregation types
│   ├── aadhaar.ts                # Server-only: AES-256-GCM encrypt/decrypt + re-exports from aadhaar-validate
│   ├── aadhaar-validate.ts       # Client-safe: Verhoeff checksum (validateAadhaar), maskAadhaar
│   ├── exif.ts                   # Server-only: parseTakenAt(buffer) → UTC Date|null (DateTimeOriginal +
│   │                             # OffsetTimeOriginal; no offset ⇒ Asia/Kolkata) via exifr
│   └── site-photos.ts            # Client-safe: PHOTO_TAGS vocab + TAG_LABELS, upload limits, thumb/grid/
│                                 # lightbox Cloudinary transforms, relativeTime(), shared gallery types
├── middleware.ts                 # Optimistic session cookie check, redirects to /login
├── actions/
│   ├── states.ts                 # createState, getAllStates (with city+site counts)
│   ├── cities.ts                 # createCity, getAllCities (with state), cityHasActiveSites
│   ├── work-types.ts             # createWorkType, updateWorkType, deleteWorkType, getAllWorkTypes
│   ├── sites.ts                  # createSite, getAllSites, getSupervisorSites,
│   │                             # getSupervisorEmployees (active only), assignSupervisorToSite,
│   │                             # revokeSupervisorFromSite, deactivateSite, deleteSite (permanent cascade:
│   │                             # removes attendance + snapshots, then site), getSiteSnapshot,
│   │                             # updateSiteAttendanceWindows
│   ├── supervisors.ts            # createSupervisor, getAllSupervisors, updateSupervisor,
│   │                             # deactivateSupervisor, reactivateSupervisor, uploadEmployeePhoto
│   │                             # (create/update carry DOB + bank + photo)
│   ├── admins.ts                 # getAllAdmins (+live session count), createAdmin, updateAdmin (name),
│   │                             # deactivate/reactivateAdmin, resetAdminPassword, removeAdmin.
│   │                             # Users-level (admins have NO employee row); guards: no self-action,
│   │                             # cannot deactivate/remove the last active admin
│   ├── workers.ts                # createWorkerAsAdmin, submitWorkerAsSupervisor, getAllWorkers,
│   │                             # getWorkersForSupervisor, approveWorker, rejectWorker,
│   │                             # resubmitWorker, updateWorker, archiveWorker, restoreWorker,
│   │                             # deleteWorker (permanent cascade), revealAadhaar, reassignWorkerCity,
│   │                             # uploadWorkerPhoto. getWorkersForSupervisor STRIPS accountNumber/ifscCode
│   ├── profile.ts                # updateOwnProfile, changeOwnPassword, resetSupervisorPassword
│   │                             # (via auth.$context password hasher), removeSupervisor (hard delete)
│   ├── attendance.ts             # getWorkersForAttendance, markMorningAttendance, markEveningAttendance,
│   │                             # submitAttendanceEditRequest, resolveAttendanceEditRequest,
│   │                             # adminEditAttendance, getAttendanceForAdmin,
│   │                             # getAttendanceForSupervisor, getPendingEditRequests
│   ├── payroll.ts                # getDashboardSummary, getConsolidatedPayroll, getSitePayrollOverview,
│   │                             # getWorkerLifetimeEarnings, getPayrollFilterOptions (all admin-only)
│   └── site-photos.ts            # Module 1.6 gallery: getSitePhotos, getGallerySite, getGlobalGallery,
│                                 # get*FilterOptions, getSiteGalleryUploaders, getUploadableSites,
│                                 # uploadSitePhotos (batch allSettled), editSitePhoto, hide/unhide/
│                                 # deleteSitePhoto, getRecentSitePhotosForAdmin/Supervisor.
│                                 # Visibility + canModifySitePhoto enforced server-side
├── components/
│   ├── Avatar.tsx                # Circular avatar: Cloudinary photo (via avatarUrl transform) or initials fallback
│   ├── PhotoUpload.tsx           # Optional single-photo picker (blob preview); exports resolvePhoto() submit helper
│   ├── AppSidebar.tsx            # Collapsible sidebar shell (desktop tree + mobile bar, theme + logout); nav configs feed in
│   ├── AdminNav.tsx              # Admin nav config → AppSidebar. Groups: "Site Management" (Cities/Sites/Work Types)
│   │                             # and "Users" (Admins/Supervisors). Workers is its own top-level item (not a login user)
│   ├── SupervisorNav.tsx         # Supervisor nav config → AppSidebar
│   ├── ThemeProvider.tsx         # Light/dark theme context (useTheme)
│   ├── ThemeToggle.tsx           # Standalone theme toggle button (mobile headers)
│   ├── gallery/                  # Module 1.6 site photo gallery (shared admin + supervisor)
│   │   ├── GalleryView.tsx       # Square aspect-ratio grid (2/3/4 cols) + design-style inline-Select
│   │   │                         # toolbar (Tag/Site/City/Uploader + admin Include-hidden + Clear filters
│   │   │                         # + count + Upload) + empty state; lightbox/upload/edit/delete
│   │   │                         # orchestration; re-queries server actions on filter change
│   │   ├── PhotoCard.tsx         # Square cell: always-visible color-coded tag pills (TAG_COLORS; 'site'
│   │   │                         # pill shows the site code), hover edit/hide/unhide/delete circular
│   │   │                         # buttons, hover gradient info bar
│   │   ├── UploadPhotosDialog.tsx # Tag-first flow (identical for admin + supervisor): the 'site' tag reveals
│   │   │                         # the site picker; no 'site' tag ⇒ a general site-less photo. ≤10 photos/10MB; dashed
│   │   │                         # dropzone + preview grid; one description+tag set; partial-failure retry
│   │   ├── EditPhotoDialog.tsx   # Per-row description + tags edit
│   │   ├── PhotoLightbox.tsx     # Full image + meta + action menu (edit/hide/unhide/delete)
│   │   └── RecentPhotosStrip.tsx # Dashboard teaser: 'grid' variant (admin dense 80px) / 'strip' variant
│   │                             # (supervisor horizontal scroll + optional Upload tile)
│   └── ui/                       # shadcn components (base-nova style)
└── app/
    ├── layout.tsx                # Root layout: fonts, ThemeProvider, metadata (title/description)
    ├── icon.png / apple-icon.png / favicon.ico  # Branded favicon (file-convention; auto-linked by Next)
    ├── page.tsx                  # Redirects to /login
    ├── login/page.tsx            # Email/password login; a bare id (no "@") maps to <id>@anuranjan.com
    ├── api/auth/[...all]/route.ts  # better-auth catch-all handler (GET + POST)
    ├── settings/                 # Shared (admin + supervisor)
    │   ├── layout.tsx            # Role-aware: renders AdminNav or SupervisorNav for the session
    │   ├── page.tsx              # Account Settings — fetches own employee record
    │   ├── ProfileForm.tsx       # Update own name + phone
    │   └── ChangePasswordForm.tsx  # Change own password (current → new + confirm)
    ├── admin/
    │   ├── layout.tsx            # Auth check + header + AdminNav (shared for all admin pages)
    │   ├── dashboard/page.tsx    # Four payroll summary cards (wage cost, active workers, top site, pending edits)
    │   ├── cities/
    │   │   ├── page.tsx          # Server: fetches cities + states
    │   │   └── CitiesClient.tsx  # Two-section UI: States table + Cities table
    │   ├── work-types/
    │   │   ├── page.tsx
    │   │   └── WorkTypesClient.tsx  # Create/edit/delete work types
    │   ├── sites/
    │   │   ├── page.tsx          # Server: fetches sites + supervisors + work types + cities
    │   │   ├── SitesTable.tsx    # TanStack table (Name/Code/City/Work Types/Status); row has icon actions
    │   │   │                     # (View Details + View Payroll only) — management actions live in SiteDetailDialog
    │   │   ├── CreateSiteDialog.tsx  # Includes optional attendance time-window fields
    │   │   ├── SiteDetailDialog.tsx  # Read view (price/cost/windows/work types/supervisors w/ revoke) + footer
    │   │   │                         # actions: active→Assign/Edit Windows/Deactivate, inactive→View Snapshot, +Delete
    │   │   ├── AssignSupervisorDialog.tsx
    │   │   ├── DeactivateSiteDialog.tsx
    │   │   ├── DeleteSiteDialog.tsx  # Permanent cascade delete; type-site-name-to-confirm
    │   │   ├── EditTimeWindowsDialog.tsx  # Edit a site's morning/evening attendance windows
    │   │   ├── SiteSupervisorList.tsx  # Supervisor chips with revoke popover (used in SiteDetailDialog)
    │   │   ├── [siteId]/snapshot/page.tsx
    │   │   └── [siteId]/gallery/page.tsx  # Per-site gallery (admin); SiteDetailDialog has a Gallery link
    │   ├── gallery/page.tsx          # Global gallery (admin only): all sites, site/city/uploader/tag/date
    │   │                             # filters + Include-hidden toggle
    │   ├── admins/
    │   │   ├── page.tsx                  # Server: getAllAdmins
    │   │   ├── AdminsTable.tsx           # TanStack table; status filter; live session count; self-row locked
    │   │   ├── CreateAdminDialog.tsx     # name + email + password
    │   │   ├── EditAdminDialog.tsx       # name only (email/login not editable)
    │   │   ├── AdminStatusDialog.tsx     # deactivate/reactivate; surfaces "last active admin" guard
    │   │   ├── ResetAdminPasswordDialog.tsx
    │   │   └── RemoveAdminDialog.tsx     # Permanent hard delete; type-name-to-confirm
    │   ├── supervisors/
    │   │   ├── page.tsx              # Server: fetches supervisors + active cities
    │   │   ├── SupervisorsTable.tsx  # TanStack table; avatar col (no Age/Email cols); row has View + Edit icon
    │   │   │                          # actions only — Reset Password/Deactivate/Remove live in SupervisorDetailDialog
    │   │   ├── SupervisorDetailDialog.tsx  # Read view: avatar/clubbed Age-DOB/salary/sites + admin-only bank block;
    │   │   │                               # footer actions: Edit/Reset Password/Deactivate(Reactivate)/Remove
    │   │   ├── CreateSupervisorDialog.tsx  # + DOB, photo, bank (admin)
    │   │   ├── EditSupervisorDialog.tsx    # + DOB, photo, bank (admin)
    │   │   ├── DeactivateConfirmDialog.tsx  # handles both deactivate + reactivate
    │   │   ├── ResetPasswordDialog.tsx      # Admin sets a new password (ends supervisor's session)
    │   │   └── RemoveSupervisorDialog.tsx   # Permanent hard delete; type-name-to-confirm
    │   ├── workers/
    │   │   ├── page.tsx              # Server: fetches workers + active cities
    │   │   ├── WorkersTable.tsx      # TanStack table; avatar + Age cols; status filter incl. Archived (the "All"
    │   │   │                         # filter EXCLUDES archived — they show only under the Archived filter)
    │   │   ├── WorkerDetailDialog.tsx  # View all fields (avatar/DOB/age + bank block); Approve/Reject/Edit/
    │   │   │                           # Archive (active) / Restore (archived) / Delete (permanent, type-to-confirm)
    │   │   ├── CreateWorkerDialog.tsx
    │   │   ├── ApproveWorkerDialog.tsx
    │   │   ├── RejectWorkerDialog.tsx
    │   │   ├── EditWorkerDialog.tsx
    │   │   ├── ReassignCityDialog.tsx
    │   │   └── AadhaarRevealButton.tsx  # 30s auto-mask, reveal logging
    │   ├── attendance/
    │   │   ├── page.tsx              # Server: fetches all records + pending requests + filter data
    │   │   ├── AttendanceClient.tsx  # Tabbed: Overview | Records | Edit Requests; HOSTS the single AdminEditDialog
    │   │   │                         # (lifted) — passes onEdit to both Overview and Records
    │   │   ├── AttendanceOverview.tsx # Single-day coverage: KPI cards + city-wise + site-wise (with Day Pay,
    │   │   │                         # expand-in-place per-worker detail via DayDetail)
    │   │   ├── AttendanceTable.tsx   # Records ledger: ONE row per site-day (date/site/city/recorded-by/workers/
    │   │   │                         # full-half/OT/Day Pay); filters date+site+city; expand row → DayDetail
    │   │   ├── DayDetail.tsx         # SHARED per-worker detail table + AttendanceRecord type + rowWage()/CATEGORY_LABELS;
    │   │   │                         # used by both AttendanceOverview and AttendanceTable
    │   │   ├── EditRequestsTable.tsx # Pending requests; approve/reject with confirm dialog
    │   │   └── AdminEditDialog.tsx   # Direct morning/evening/OT edit form
    │   └── payroll/
    │       ├── page.tsx              # Server: filter options + initial consolidated payroll
    │       ├── PayrollClient.tsx     # Filters + site cards; re-queries on filter change
    │       ├── PayrollFilters.tsx    # Cascading state/city/site + independent month (native selects)
    │       ├── SitePayrollCard.tsx   # Collapsible site → month table → per-worker breakdown
    │       ├── MonthStatusBadge.tsx  # In Progress / Not Finalized / Finalized badge
    │       ├── types.ts              # Shared payroll display types + CATEGORY_LABELS
    │       ├── sites/[siteId]/       # page.tsx + SitePayrollOverview.tsx (per-site monthly view)
    │       └── workers/[workerId]/   # page.tsx + WorkerEarningsOverview.tsx (lifetime earnings)
    └── supervisor/
        ├── layout.tsx            # Auth check + header + SupervisorNav + status guard
        ├── dashboard/page.tsx    # Shows assigned site count + pending worker submissions
        ├── sites/
        │   ├── page.tsx          # Card grid of assigned sites (read-only) + per-card View Gallery link
        │   └── [siteId]/gallery/page.tsx  # Per-site gallery (current-assignment access enforced server-side)
        ├── workers/
        │   ├── page.tsx          # Server: workers + assigned cities
        │   ├── WorkersList.tsx   # Tabbed: Active / My Submissions / Rejected
        │   ├── SubmitWorkerDialog.tsx
        │   └── ResubmitWorkerDialog.tsx
        └── attendance/
            ├── page.tsx          # Server: card grid of active assigned sites
            └── [siteId]/
                ├── page.tsx              # Server: date param + getWorkersForAttendance
                └── AttendanceMarking.tsx # Client: morning/evening tabs, worker list, OT, edit requests
```

All admin, supervisor, and settings route folders have a `loading.tsx` skeleton.

---

## Database schema (15 tables)

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
attendance                                 ← uuid PK, FK → sites + workers + cities + employees (×2)
site_photos                                ← uuid PK, FK → sites (cascade, NULLABLE) + cities (nullable) + users (×2)
```

All Drizzle `relations()` are declared at the **bottom** of `schema.ts` — never inline with table declarations.

**Key facts:**
- `cities.stateId` is NOT NULL — state is required when creating a city
- `cities.status` and `sites.status` use `text` enum: `'active' | 'inactive'`
- `site_snapshots.supervisors` is JSONB — captures supervisor list at deactivation time
- **Deleting a site** (`deleteSite`) is a permanent cascade: `attendance` and `site_snapshots` reference `sites.id` WITHOUT an onDelete cascade so they are deleted manually first; `site_work_types` + `site_supervisor_assignments` cascade on the site delete. Deactivate (snapshot + status flip) remains the audit-trail path
- `employees.userId` links an employee record to a better-auth user (1:1, unique)
- `workers` are separate from `employees` — employees are company staff (supervisors etc.), workers are site labour
- `workers.aadhaarEncrypted` is NEVER returned to the client — always stripped with destructuring before returning
- `workers.otRate2hr / otRate4hr / otRate6hr` — three OT rate tiers (2hr, 4hr, 6hr overtime); single `otRate` column was removed
- `workers.dateOfBirth` + `employees.dateOfBirth` — nullable `date` ('YYYY-MM-DD'); **age is never stored**, derived for display via `computeAge()` in `lib/age.ts` (shows `-` when null). `workers.age` column was dropped in 1.2.5
- `workers.accountNumber / ifscCode` + `employees.accountNumber / ifscCode` — nullable plaintext bank details (NOT encrypted). **Admin-only**: `getWorkersForSupervisor` strips them; supervisor worker/employee forms never expose them
- `workers.photoCloudinaryPublicId / photoCloudinaryUrl` + same on `employees` — nullable profile photo. Public id is used to delete/replace the Cloudinary asset; secure url is rendered (via `avatarUrl` transform). Replacing/removing a photo deletes the old asset server-side in the create/update/delete actions
- `attendance` unique constraint: `(worker_id, site_id, date)` — one row per worker per site per day
- `attendance.date` is a Drizzle `date()` column — returns a `'YYYY-MM-DD'` string, always compare as strings
- `attendance.wageDailySnapshot / otRateSnapshot` — snapshotted from worker at first mark time, never updated after. `otRateSnapshot` is snapshotted from `worker.otRate2hr` (the flat 2-hour-session rate)
- `attendance.isLocked` — scaffolded for Module 1.5 finalization; blocks all edits once true. **Module 1.4 never sets it** (1.4 payroll is read-only — no finalization, no locking)
- `sites.morningAttendanceStart/End` + `eveningAttendanceStart/End` — nullable `HH:MM` strings; null = no time restriction
- `attendance.isMorningLate/isEveningLate` — set at mark time via `isWithinWindow()` in `lib/attendance.ts`
- `site_photos` (Module 1.6) — `siteId` + denormalized `cityId` are **NULLABLE**: a photo may be **site-less** (a "general" photo — brochure/process/material/team — uploaded without the `site` tag). When attached, the SITE owns the photo (`siteId` cascade-deletes with the site) and `cityId` snapshots the site's city at upload (never re-synced — matches `attendance`). `uploadedBy`/`hiddenBy` are `users` text FKs (attribution only). `tags` is `text[]` from a LOCKED vocabulary (`PHOTO_TAGS` in `lib/site-photos.ts` = `site, material, team, process, brochure`) — GIN-indexed for `&&`/`@>`. The **`site` tag is special**: choosing it requires attaching a site (enforced server-side). Upload logic is **identical for admin + supervisor**: no `site` tag ⇒ a site-less general photo; both may create them. **Visibility of site-less photos:** admins see all in the global gallery; a supervisor sees only the site-less photos **they** uploaded (in `/supervisor/gallery`, via `supervisorScope` = assigned-site photos OR own site-less). `takenAt` (timestamptz, nullable) parsed from EXIF server-side; sort everywhere is `COALESCE(taken_at, uploaded_at) DESC`. `isHidden` soft-hide (`hiddenAt`/`hiddenBy`); hidden rows excluded from default views, global gallery, dashboards — admin reveals via Include-hidden, supervisors never see hidden (even own). No approval flow; uploads blocked when site status ≠ `active`

**⚠️ Two divergent OT wage formulas exist — reconcile before relying on either:**
- `lib/attendance.ts` `computeWageForRow()` — treats `otRateSnapshot` as a per-hour rate: 2hr → `otRate × 2`, 4hr → `otRate × 4`
- `lib/payroll.ts` `computeRowWage()` (Module 1.4, per spec) — treats it as a flat session rate: 2hr → `otRate`, 4hr → `otRate × 2`

Since `otRateSnapshot` snapshots `worker.otRate2hr` (a flat 2hr-session rate), the payroll formula is the intended reading, but payroll figures will NOT match `computeWageForRow`. Likely fix: align `computeWageForRow` to the payroll formula.

**Worker business rules:**
- Aadhaar is required (not optional) and validated with Verhoeff checksum
- Date of birth is optional; age is computed for display only (no 18–45 constraint since 1.2.5 — the old `age` field + range check were removed)
- Phone must be unique across all workers and employees
- Workers created by admin start as `active`; submitted by supervisor start as `pending`
- `worker_status` enum is `pending | active | rejected | archived`. **Archive** is a reversible soft delete (status→`archived`) that hides the worker from active lists, attendance marking and supervisor views (all filter `status='active'`) while preserving every record. **deleteWorker** is a permanent cascade (worker + all their attendance rows, which have no FK cascade): a worker WITH attendance must be archived first; one with no attendance can be deleted directly. Past payroll is unaffected by archiving (it reads attendance rows)
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

Cloudinary vars (`CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`) are **optional** in `env.ts` — the app boots without them. `lib/cloudinary.ts` throws a clear error only when an upload/delete is attempted while they are unset, so profile photos stay disabled until all three are configured.

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

### Dates & currency
Display **all** calendar dates as **DD/MM/YYYY** via `formatDate()` (timestamps: `formatDateTime()` → `DD/MM/YYYY, HH:mm`) from `@/lib/utils` — never call `toLocaleDateString()` ad-hoc, and never render a raw `yyyy-MM-dd` string in the UI. Internal date *keys/params* stay `yyyy-MM-dd` (date-fns `format`). Money via `formatINR()` from `@/lib/payroll`. Note: native `<input type="date">` pickers still render in the browser/OS locale (not controllable without a custom picker); only their stored value is `yyyy-MM-dd`.

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
| 1.2.5 Profile/Bank/DOB | ✅ Done | Dropped `workers.age`; added nullable `dateOfBirth` (computed age via `lib/age.ts`, `-` when null) + plaintext admin-only bank (`accountNumber`/`ifscCode`) + Cloudinary profile photo (`photoCloudinaryPublicId`/`Url`) on both `workers` + `employees`. Avatar + Age columns on worker/supervisor lists; bank block on worker/supervisor detail dialogs (admin-only — supervisor payload strips bank); `PhotoUpload`/`Avatar` components, signed server-side upload/delete via `lib/cloudinary.ts`, replace/remove deletes old asset |
| 1.3 Attendance | ✅ Done | attendance table, morning/evening marking, OT, yesterday edit, 2-7 day edit requests with admin approval, split-shift dimming, admin full table + edit requests tab, dashboard count card |
| 1.3-pre Profile/Windows/Fix | ✅ Done | Shared `/settings` (own profile + password change); admin reset supervisor password + permanent remove; site attendance time windows (morning/evening HH:MM) with late flags on marks + late badge + supervisor warning toast; workers table defaults to all statuses |
| 1.4 Payroll Dashboard | ✅ Done | Read-only live wage view: dashboard summary cards, consolidated payroll with cascading state/city/site/month filters, per-site overview, per-worker lifetime earnings, "In Progress/Not Finalized/Finalized" month badges; all computed in JS via `lib/payroll.ts`; "View Payroll"/"View Earnings" links on sites/workers tables |
| 1.4-post Admin mgmt & polish | ✅ Done | Admin management at `/admin/admins` (create/edit-name/reset-password/deactivate/reactivate/remove) with self-action + last-active-admin guards; sidebar "Users" group (Admins + Supervisors), Workers kept separate; 2-hour hard session cap in `auth.ts`; branded favicon (optimized `icon.png`/`apple-icon.png`/`favicon.ico` in `app/`) |
| 1.4-post Attendance Records redesign | ✅ Done | Admin Records reworked into a per-site-per-day ledger (one row per site/day: recorded-by supervisors tagged by session, worker/full-half/OT tallies, **Day Pay** via `lib/payroll` `computeRowWage`); shared `DayDetail` expand-in-place per-worker table reused by Records + Overview site-wise; single `AdminEditDialog` lifted to `AttendanceClient` (one `onEdit` for both tabs); Day Pay column added to Overview site-wise; site-wide date display standardized to DD/MM/YYYY via `formatDate`/`formatDateTime`. (Day Pay OT portion still inherits the `otRateSnapshot=2hr` quirk — see OT-formula note above) |
| 1.4-post UX: archive/delete + action bars | ✅ Done | Worker **archive/restore** (soft delete, `archived` status) + permanent cascade **deleteWorker** (worker + attendance, type-to-confirm; archive required first when attendance exists); archived hidden from active/supervisor/attendance views and from the "All" worker filter. Site **deleteSite** (permanent cascade) + `DeleteSiteDialog`. Action-bar redesign on supervisors + sites tables: compact icon row for quick views, management/destructive actions moved into the detail dialog (`SupervisorDetailDialog`, `SiteDetailDialog`); supervisor list drops Age/Email cols, clubs Age-DOB in detail |
| 1.6 Site Photo Gallery | ✅ Done | `site_photos` table (GIN-indexed `tags`; `siteId`/`cityId` nullable for site-less general photos). Per-site galleries (`/admin` + `/supervisor`), admin global gallery (`/admin/gallery`), and a supervisor gallery (`/supervisor/gallery`, sidebar item) aggregating all assigned sites + the supervisor's own site-less photos (`supervisorScope`). Square grid + hover-reveal cards (color-coded tag pills) + lightbox. Tag-first batch upload — **identical for admin + supervisor** (≤10 photos / 10 MB each, dashed dropzone + preview grid, locked vocab `site/material/team/process/brochure`; `site` tag reveals the site picker, no `site` tag ⇒ site-less general photo; one description+tag set, `Promise.allSettled` partial-failure + retry), server-side EXIF `takenAt` (Asia/Kolkata fallback). Filters: Tag/Site/City/Uploader + Include-hidden (no date filter). Visibility + `canModifySitePhoto` enforced server-side (supervisor = currently-assigned sites + own site-less); per-row edit/hide, admin unhide + Cloudinary-first hard delete; dashboard previews (admin dense grid last 8 / supervisor scroll strip last 6 + Upload tile). Uploads blocked on non-active sites. `exifr` added |

Full specs in `docs/modules/`.

## Modules planned (not started)

- 1.5 Payroll Finalization
- 1.7 Materials
- 1.8 Expenses
- 1.9 Reports

---

## Commands

```bash
pnpm dev                  # Start dev server (Turbopack)
pnpm build                # Production build
pnpm lint                 # ESLint
pnpm tsc --noEmit         # Type check
pnpm drizzle-kit push     # Push schema changes to Neon (interactive — needs TTY)
pnpm seed                 # Run src/db/seed.ts
pnpm exec tsx src/db/migrate-ot-rates.ts      # Already run — splits ot_rate into 3 tiers
pnpm exec tsx src/db/migrate-attendance.ts   # Already run — creates attendance table + enums
pnpm exec tsx src/db/migrate-attendance-windows.ts  # Already run — adds site time windows + late flags
pnpm exec tsx src/db/migrate-profile-bank-dob.ts   # Already run — drops workers.age, adds DOB+bank+photo cols
pnpm exec tsx src/db/migrate-worker-archived.ts    # Already run — adds 'archived' to worker_status enum
pnpm exec tsx src/db/migrate-site-photos.ts        # Already run — creates site_photos table + indexes (GIN on tags)
pnpm exec tsx src/db/migrate-site-photos-nullable.ts  # Already run — makes site_photos.site_id + city_id nullable
pnpm exec tsx src/db/create-admin.ts          # Already run — creates ANURANJAN admin (idempotent)
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
- Bank details (`accountNumber`/`ifscCode`) are **plaintext** (no encryption, no reveal log) but **admin-only**: strip them from any supervisor-facing payload (as `getWorkersForSupervisor` does) and never render them in supervisor forms/lists
- `lib/cloudinary.ts` is server-only (`import 'server-only'`) — client components use `lib/cloudinary-url.ts` (transform helper) and the `PhotoUpload`/`Avatar` components; uploads/deletes go through server actions only
- Site gallery (Module 1.6): visibility is enforced **server-side on every query/action** — a supervisor sees only currently-assigned sites (plus their own site-less photos) and cannot reach another site's photos by URL. `canModifySitePhoto` (admin OR uploader: own site-less always / own site photo while still assigned) gates all hide/edit; unhide + hard-delete are admin-only. Hard delete is **Cloudinary-first** (`deleteImageStrict` throws on failure) so a DB row is never orphaned against a missing asset. `lib/exif.ts` is server-only; tags are validated against the locked vocabulary server-side
