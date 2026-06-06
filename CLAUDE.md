## EMS — Project Conventions

- Stack: Next.js 15 App Router, Drizzle ORM, Neon Postgres, better-auth, shadcn/ui, TanStack Query + Table, react-hook-form + zod, Vercel, pnpm
- Schema lives entirely in `src/db/schema.ts`
- DB client exported from `src/db/index.ts`
- Auth instance exported from `src/lib/auth.ts`
- Auth client exported from `src/lib/auth-client.ts`
- Server actions live in `src/actions/<module>.ts`
- All routes under `src/app/admin/*` are admin-only
- All routes under `src/app/supervisor/*` are supervisor-only
- Role check must be the FIRST thing in every server component and server action
- Aadhaar encryption uses AES-256-GCM via `AADHAAR_ENCRYPTION_KEY` env var
- Never log or expose decrypted Aadhaar outside of the explicit reveal action
- Run `pnpm drizzle-kit push` after every schema change
- Run typecheck (`pnpm tsc --noEmit`) and lint (`pnpm lint`) before every commit
