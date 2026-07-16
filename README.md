# Anuranjan EMS (AR-Employee-management)

Anuranjan EMS is a role-based employee and workforce operations system for managing workers, supervisors, attendance, payroll workflows, and site operations.

It is built as a Next.js App Router application with a TypeScript-first stack and PostgreSQL-backed data model.

## What this project is about

This repository implements an internal operations platform focused on:

- **Role-based operations** for **Admin** and **Supervisor** users
- **City/Site management** with supervisor assignments
- **Worker lifecycle** (creation, review/approval, status transitions)
- **Attendance tracking** (morning/evening marking, edit-request workflows)
- **Payroll flow integration** and advance-recovery logic
- **Site photo gallery** for operational visibility
- **Secure handling of sensitive worker identity data** (Aadhaar encryption at rest)

The docs in `docs/modules` define the system in modular phases (1.0 onward), including scope boundaries, data model expectations, and implementation notes.

## Core user roles

### Admin
- Full visibility across cities/sites/workers/attendance
- Can approve or reject supervisor-submitted records
- Can manage supervisors and platform-wide configuration
- Can review and control attendance edit requests

### Supervisor
- Operates within currently assigned sites/cities
- Can submit worker records, mark attendance, and perform scoped operational tasks
- Access is intentionally restricted by assignment and role guards

## Tech stack

- **Framework:** Next.js (App Router)
- **Language:** TypeScript
- **UI:** Tailwind CSS v4 + shadcn/ui (`base-nova` style on `@base-ui/react`)
- **State/Data:** TanStack Query, TanStack Table
- **Forms/Validation:** react-hook-form + Zod
- **Auth:** better-auth (role-aware sessions)
- **Database:** PostgreSQL (Neon) with Drizzle ORM
- **Media:** Cloudinary (for profile/site gallery images)

## Security & data handling highlights

- Aadhaar values are encrypted at rest (AES-256-GCM utility flow described in module docs)
- Masked display patterns for sensitive fields
- Server-side authorization checks on role-scoped actions
- Audit-oriented behavior for sensitive access paths (as defined by module specs)

## Project documentation

Primary documentation lives in:

- `docs/modules/` – functional module specs and rollout units
- `docs/design/` – UI/design system extraction and feature design docs

Useful starting docs:

- `docs/modules/module-1.0-foundation.md`
- `docs/modules/module-1.1-cities-and-sites.md`
- `docs/modules/module-1.2-workers.md`
- `docs/modules/module-1.3-attendance.md`
- `docs/modules/module-1.6-site-photo-gallery.md`
- `docs/modules/module-1.7-worker-advances.md`
- `docs/design/DESIGN-SYSTEM.md`

## Development

Install dependencies and run locally:

```bash
pnpm install
pnpm dev
```

Then open:

- http://localhost:3000

## Environment

Set required environment variables (as documented in module foundation docs), including:

- `DATABASE_URL`
- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL`
- `NEXT_PUBLIC_APP_URL`
- `AADHAAR_ENCRYPTION_KEY`

Refer to `docs/modules/module-1.0-foundation.md` for expected setup details and validation guidance.
