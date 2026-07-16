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
