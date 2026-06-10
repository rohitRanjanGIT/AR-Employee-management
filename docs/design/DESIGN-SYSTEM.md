# Anuranjan EMS — Design System Extraction

> Verbatim extraction of the complete visual + structural design language of this repository.
> Goal: another developer can recreate this UI **pixel-for-pixel** in a different codebase without ever seeing this repo.
> Stack: **Next.js 16.2.6 (App Router, RSC)** · **React 19.2.4** · **Tailwind CSS v4** (CSS-config, no `tailwind.config.*`) · **shadcn `base-nova` style built on `@base-ui/react` (NOT Radix)** · **lucide-react** icons · **class-variance-authority** · **TanStack Table/Query** · **react-hook-form + Zod** · **sonner** · **next-themes**.

---

## 0. File inventory

### Config / root
| File path | Renders | Notes |
|---|---|---|
| `src/app/globals.css` | Global stylesheet + theme tokens | Tailwind v4 `@theme inline`, `:root`, `.dark` |
| `src/app/layout.tsx` | Root HTML shell | Inter font, ThemeProvider |
| `components.json` | shadcn config | `style: base-nova`, `baseColor: neutral` |
| `postcss.config.mjs` | PostCSS | only `@tailwindcss/postcss` |
| `next.config.ts` | Next config | cloudinary remote images, 10mb server actions |
| `src/lib/utils.ts` | `cn()` helper | clsx + tailwind-merge |
| `src/lib/utils/format.ts` | INR / date / IST formatters | — |

### Layout / providers
| File path | Renders | Notes |
|---|---|---|
| `src/app/(admin)/layout.tsx` | Admin shell wrapper | `requireAdmin()` → `<QueryProvider><AppShell role="admin">` |
| `src/app/(supervisor)/layout.tsx` | Supervisor shell wrapper | `requireSupervisor()` → `<QueryProvider><AppShell role="supervisor">` |
| `src/components/layout/app-shell.tsx` | Sidebar + mobile header + main | The persistent shell (both roles) |
| `src/components/layout/page-header.tsx` | Page title/description + reload | `<PageHeader title description>` |
| `src/components/layout/reload-button.tsx` | Refresh icon button | spins 800ms on click |
| `src/components/providers/query-provider.tsx` | TanStack Query client | staleTime 20s, retry 1 |
| `src/components/providers/theme-provider.tsx` | next-themes wrapper | — |

### UI primitives (`src/components/ui/`)
| File | Primitive base |
|---|---|
| `avatar.tsx` | `@base-ui/react/avatar` |
| `badge.tsx` | `useRender` (cva) |
| `button.tsx` | `@base-ui/react/button` (cva) |
| `calendar.tsx` | react-day-picker |
| `card.tsx` | plain `div`s |
| `checkbox.tsx` | `@base-ui/react/checkbox` |
| `command.tsx` | cmdk |
| `dialog.tsx` | `@base-ui/react/dialog` |
| `dropdown-menu.tsx` | `@base-ui/react/menu` |
| `form.tsx` | react-hook-form + `@radix-ui/react-slot` |
| `input-group.tsx` | composite (cva) |
| `input.tsx` | `@base-ui/react/input` |
| `label.tsx` | plain `label` |
| `pagination-bar.tsx` | custom (Link + buttonVariants) |
| `popover.tsx` | `@base-ui/react/popover` |
| `progress.tsx` | `@base-ui/react/progress` |
| `scroll-area.tsx` | `@base-ui/react/scroll-area` |
| `select.tsx` | `@base-ui/react/select` |
| `separator.tsx` | `@base-ui/react/separator` |
| `sheet.tsx` | `@base-ui/react/dialog` (side variants) |
| `skeleton.tsx` | plain `div` `animate-pulse` |
| `sonner.tsx` | sonner Toaster (⚠ not mounted anywhere) |
| `spinner.tsx` | custom CSS border spinner |
| `table.tsx` | plain `table` |
| `tabs.tsx` | `@base-ui/react/tabs` (cva) |
| `textarea.tsx` | plain `textarea` |
| `tooltip.tsx` | `@base-ui/react/tooltip` |

### Admin pages & components (`src/app/(admin)/admin/`)
| File path | Renders |
|---|---|
| `dashboard/page.tsx` | Admin dashboard (command center) |
| `dashboard/_components/{dashboard-header, kpi-row, approvals-preview, financial-snapshot, todays-operations, payroll-preview, inventory-alerts, recurring-expenses-status, recent-gallery, recent-activity}.tsx` | Dashboard widgets |
| `approvals/page.tsx` + `_components/approvals-table.tsx` | Unified approvals queue |
| `workers/page.tsx`, `_components/{workers-table, worker-form-dialog, worker-aadhar-reveal-dialog}.tsx`, `[id]/page.tsx`, `[id]/_components/worker-detail-client.tsx` | Workers CRUD + profile |
| `supervisors/page.tsx`, `_components/{supervisors-table, supervisor-form-dialog, aadhar-reveal-dialog}.tsx` | Supervisors CRUD |
| `sites/page.tsx`, `_components/{sites-table, site-form-dialog}.tsx`, `[id]/page.tsx`, `[id]/_components/{site-detail-client, inventory-tab, supervisors-tab, assign-supervisor-dialog, log-movement-dialog, transfer-dialog}.tsx` | Sites CRUD + detail tabs |
| `cities/page.tsx`, `_components/{cities-table, city-form-dialog}.tsx` | Cities CRUD |
| `materials/page.tsx`, `[id]/page.tsx`, `[id]/_components/material-request-actions.tsx` | Material requests |
| `inventory/page.tsx`, `_components/{materials-table, material-form-dialog}.tsx` | Material catalog |
| `attendance/page.tsx`, `view/page.tsx`, `_components/{admin-day-view, attendance-filters, attendance-list, change-requests-review}.tsx` | Attendance review |
| `disbursements/page.tsx`, `_components/{batches-table, create-batch-dialog}.tsx`, `[id]/page.tsx`, `[id]/_components/batch-detail-client.tsx` | Wage disbursements |
| `expenses/page.tsx`, `_components/expense-actions.tsx` | Expense approvals |
| `recurring-expenses/page.tsx`, `_components/recurring-expenses-client.tsx` | Recurring expenses |
| `payroll/page.tsx` | Payroll |
| `reports/page.tsx` | Reports |
| `gallery/page.tsx`, `_components/{admin-gallery-client, upload-image-dialog, edit-tag-dialog}.tsx` | Site photo gallery |
| `settings/page.tsx` | Settings |
| `loading.tsx` | Route loading (centered Spinner) |

### Supervisor pages & components (`src/app/(supervisor)/supervisor/`)
| File path | Renders |
|---|---|
| `dashboard/page.tsx` | Mobile-first supervisor dashboard |
| `dashboard/_components/{greeting-strip, attendance-action-card, quick-actions, my-sites-overview, city-workers-summary, my-pending-requests, material-alerts, gallery-preview, mobile-bottom-nav}.tsx` | Dashboard widgets |
| `attendance/page.tsx`, `mark/page.tsx`, `view/page.tsx`, `_components/{attendance-grid, attendance-day-edit, attendance-log-table, attendance-metrics, attendance-picker, attendance-site-selector, call-card, change-request-modal}.tsx` | Attendance marking |
| `workers/page.tsx`, `_components/{supervisor-workers-table, request-worker-dialog}.tsx` | Workers |
| `materials/page.tsx`, `_components/{materials-client, request-materials-dialog}.tsx` | Material requests |
| `inventory/page.tsx`, `_components/supervisor-inventory-client.tsx` | Inventory ledger |
| `disbursement-requests/page.tsx`, `_components/{disbursement-requests-client, request-batch-dialog}.tsx` | Disbursement requests |
| `expense-requests/page.tsx`, `_components/{expense-requests-client, add-expense-dialog}.tsx` | Expense requests |
| `gallery/page.tsx`, `_components/supervisor-gallery-client.tsx` | Gallery |
| `my-sites/page.tsx` | Assigned sites |
| `pending-requests/page.tsx` | Pending requests |
| `settings/page.tsx` | Settings |
| `loading.tsx` | Route loading (centered Spinner) |

### Auth & shared
| File path | Renders |
|---|---|
| `src/app/(auth)/login/page.tsx` | Login card form |
| `src/app/(auth)/signup/page.tsx` | Signup |
| `src/components/forms/image-upload-form.tsx` | Reusable image upload |
| `src/components/settings/settings-client.tsx` | Settings UI |

---

## 1. Raw config files (verbatim)

### `components.json`
```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "base-nova",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/app/globals.css",
    "baseColor": "neutral",
    "cssVariables": true,
    "prefix": ""
  },
  "iconLibrary": "lucide",
  "rtl": false,
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  },
  "menuColor": "default",
  "menuAccent": "subtle",
  "registries": {}
}
```

### `tailwind.config.*`
**Not present.** This project uses **Tailwind CSS v4** with CSS-based configuration. All theme config lives in `src/app/globals.css` via `@theme inline { … }` and `@custom-variant`. There is no JS/TS Tailwind config file.

### `postcss.config.mjs` (entire file)
```js
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
```

### `src/app/globals.css` (entire file, verbatim)
```css
@import "tailwindcss";
@import "tw-animate-css";
@import "shadcn/tailwind.css";

@custom-variant dark (&:is(.dark *));

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-inter);
  --font-heading: var(--font-sans);
  --color-sidebar-ring: var(--sidebar-ring);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar: var(--sidebar);
  --color-chart-5: var(--chart-5);
  --color-chart-4: var(--chart-4);
  --color-chart-3: var(--chart-3);
  --color-chart-2: var(--chart-2);
  --color-chart-1: var(--chart-1);
  --color-ring: var(--ring);
  --color-input: var(--input);
  --color-border: var(--border);
  --color-destructive: var(--destructive);
  --color-accent-foreground: var(--accent-foreground);
  --color-accent: var(--accent);
  --color-muted-foreground: var(--muted-foreground);
  --color-muted: var(--muted);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-secondary: var(--secondary);
  --color-primary-foreground: var(--primary-foreground);
  --color-primary: var(--primary);
  --color-popover-foreground: var(--popover-foreground);
  --color-popover: var(--popover);
  --color-card-foreground: var(--card-foreground);
  --color-card: var(--card);
  --radius-sm: calc(var(--radius) * 0.6);
  --radius-md: calc(var(--radius) * 0.8);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) * 1.4);
  --radius-2xl: calc(var(--radius) * 1.8);
  --radius-3xl: calc(var(--radius) * 2.2);
  --radius-4xl: calc(var(--radius) * 2.6);
}

:root {
  /* Beige background */
  --background: oklch(0.97 0.013 80);
  --foreground: oklch(0.145 0 0);
  /* Cards slightly off-white so they lift off the beige */
  --card: oklch(0.995 0.005 80);
  --card-foreground: oklch(0.145 0 0);
  --popover: oklch(0.995 0.005 80);
  --popover-foreground: oklch(0.145 0 0);
  /* Company red as primary */
  --primary: oklch(0.52 0.22 27.3);
  --primary-foreground: oklch(0.985 0 0);
  /* Light blue-tint for secondary / button variant */
  --secondary: oklch(0.93 0.04 250);
  --secondary-foreground: oklch(0.25 0.12 250);
  /* Warm muted */
  --muted: oklch(0.94 0.01 80);
  --muted-foreground: oklch(0.50 0 0);
  /* Light blue hover accent */
  --accent: oklch(0.93 0.04 250);
  --accent-foreground: oklch(0.205 0 0);
  --destructive: oklch(0.577 0.245 27.325);
  --border: oklch(0.90 0.01 80);
  --input: oklch(0.90 0.01 80);
  /* Blue focus ring */
  --ring: oklch(0.54 0.19 250);
  /* Chart: red, blue, then neutrals */
  --chart-1: oklch(0.52 0.22 27.3);
  --chart-2: oklch(0.54 0.19 250);
  --chart-3: oklch(0.65 0.12 150);
  --chart-4: oklch(0.70 0.12 60);
  --chart-5: oklch(0.55 0.08 300);
  --radius: 0.625rem;
  /* Sidebar: white-beige background, red active nav, blue hover */
  --sidebar: oklch(0.995 0.005 80);
  --sidebar-foreground: oklch(0.145 0 0);
  --sidebar-primary: oklch(0.52 0.22 27.3);
  --sidebar-primary-foreground: oklch(0.985 0 0);
  --sidebar-accent: oklch(0.93 0.04 250);
  --sidebar-accent-foreground: oklch(0.205 0 0);
  --sidebar-border: oklch(0.90 0.01 80);
  --sidebar-ring: oklch(0.54 0.19 250);
}

.dark {
  --background: oklch(0.16 0.01 260);
  --foreground: oklch(0.95 0 0);
  --card: oklch(0.21 0.01 260);
  --card-foreground: oklch(0.95 0 0);
  --popover: oklch(0.21 0.01 260);
  --popover-foreground: oklch(0.95 0 0);
  /* Slightly lighter red so it reads well on dark bg */
  --primary: oklch(0.60 0.22 27.3);
  --primary-foreground: oklch(0.985 0 0);
  --secondary: oklch(0.25 0.05 250);
  --secondary-foreground: oklch(0.85 0.05 250);
  --muted: oklch(0.26 0.01 260);
  --muted-foreground: oklch(0.65 0 0);
  --accent: oklch(0.26 0.05 250);
  --accent-foreground: oklch(0.92 0 0);
  --destructive: oklch(0.65 0.22 27.3);
  --border: oklch(1 0 0 / 10%);
  --input: oklch(1 0 0 / 12%);
  --ring: oklch(0.60 0.19 250);
  --chart-1: oklch(0.60 0.22 27.3);
  --chart-2: oklch(0.60 0.19 250);
  --chart-3: oklch(0.65 0.12 150);
  --chart-4: oklch(0.70 0.12 60);
  --chart-5: oklch(0.55 0.08 300);
  --sidebar: oklch(0.19 0.01 260);
  --sidebar-foreground: oklch(0.95 0 0);
  --sidebar-primary: oklch(0.60 0.22 27.3);
  --sidebar-primary-foreground: oklch(0.985 0 0);
  --sidebar-accent: oklch(0.26 0.05 250);
  --sidebar-accent-foreground: oklch(0.92 0 0);
  --sidebar-border: oklch(1 0 0 / 10%);
  --sidebar-ring: oklch(0.60 0.19 250);
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground;
  }
  html {
    @apply font-sans;
  }
}
```

### `theme.ts` / design-token file
**Not present.** All design tokens are the CSS variables above.

### Font setup (verbatim from `src/app/layout.tsx`)
```tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "@/components/providers/theme-provider";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Anuranjan EMS",
  description: "Employee Management System for Anuranjan Infratech",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-IN" className={`${inter.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col">
        <ThemeProvider attribute="class" defaultTheme="light" disableTransitionOnChange>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
```
- Font: **Inter** via `next/font/google`, exposed as CSS var `--font-inter`, subset `["latin"]`, **no explicit weight array** (default = all weights available). Wired to Tailwind via `--font-sans: var(--font-inter)` and `--font-heading: var(--font-sans)` in `@theme inline`.
- `<html>` gets `antialiased` + `h-full`; `<body>` is `min-h-full flex flex-col`.
- Theme: `next-themes` with `attribute="class"`, `defaultTheme="light"`, `disableTransitionOnChange`. `lang="en-IN"`.

### `package.json` (dependencies — verbatim)
```json
"dependencies": {
  "@base-ui/react": "^1.4.1",
  "@hookform/resolvers": "^5.2.2",
  "@neondatabase/serverless": "^1.1.0",
  "@radix-ui/react-slot": "^1.2.4",
  "@tanstack/react-query": "^5.100.10",
  "@tanstack/react-table": "^8.21.3",
  "better-auth": "^1.6.11",
  "class-variance-authority": "^0.7.1",
  "cloudinary": "^2.10.0",
  "clsx": "^2.1.1",
  "cmdk": "^1.1.1",
  "date-fns": "^4.1.0",
  "date-fns-tz": "^3.2.0",
  "drizzle-orm": "^0.45.2",
  "lucide-react": "^1.14.0",
  "next": "16.2.6",
  "next-themes": "^0.4.6",
  "nextjs-toploader": "^3.9.17",
  "react": "19.2.4",
  "react-day-picker": "^10.0.0",
  "react-dom": "19.2.4",
  "react-hook-form": "^7.75.0",
  "recharts": "^3.8.1",
  "server-only": "^0.0.1",
  "shadcn": "^4.7.0",
  "sonner": "^2.0.7",
  "tailwind-merge": "^3.6.0",
  "tw-animate-css": "^1.4.0",
  "zod": "^3.25.76"
}
```
> ⚠ `sonner` (toast) and `nextjs-toploader` are installed but **not mounted anywhere** in `src/app`. `recharts` is available for charts.

---

## 2. Color system

All tokens are defined in **OKLCH**. The signature look: **warm beige background** with **slightly off-white cards**, a **company red primary**, and a **blue focus ring / blue secondary-accent**.

### Light mode (`:root`)
| Token | Value | Used for |
|---|---|---|
| `--background` | `oklch(0.97 0.013 80)` | App/page background (beige) |
| `--foreground` | `oklch(0.145 0 0)` | Primary text (near-black) |
| `--card` | `oklch(0.995 0.005 80)` | Card surfaces (off-white, lifts off beige) |
| `--card-foreground` | `oklch(0.145 0 0)` | Card text |
| `--popover` | `oklch(0.995 0.005 80)` | Dialog/popover/dropdown surface |
| `--popover-foreground` | `oklch(0.145 0 0)` | Popover text |
| `--primary` | `oklch(0.52 0.22 27.3)` | Company red — buttons, active nav, chart-1 |
| `--primary-foreground` | `oklch(0.985 0 0)` | Text on primary (white) |
| `--secondary` | `oklch(0.93 0.04 250)` | Light blue tint — secondary button/badge |
| `--secondary-foreground` | `oklch(0.25 0.12 250)` | Deep blue text on secondary |
| `--muted` | `oklch(0.94 0.01 80)` | Warm muted surfaces, hover rows |
| `--muted-foreground` | `oklch(0.50 0 0)` | Secondary/label text |
| `--accent` | `oklch(0.93 0.04 250)` | Light-blue hover accent (= secondary) |
| `--accent-foreground` | `oklch(0.205 0 0)` | Text on accent |
| `--destructive` | `oklch(0.577 0.245 27.325)` | Destructive/error red |
| `--border` | `oklch(0.90 0.01 80)` | All borders |
| `--input` | `oklch(0.90 0.01 80)` | Input borders |
| `--ring` | `oklch(0.54 0.19 250)` | Blue focus ring |
| `--chart-1` | `oklch(0.52 0.22 27.3)` | Chart red |
| `--chart-2` | `oklch(0.54 0.19 250)` | Chart blue |
| `--chart-3` | `oklch(0.65 0.12 150)` | Chart green |
| `--chart-4` | `oklch(0.70 0.12 60)` | Chart amber |
| `--chart-5` | `oklch(0.55 0.08 300)` | Chart purple |
| `--radius` | `0.625rem` | Base radius (10px) |
| `--sidebar` | `oklch(0.995 0.005 80)` | Sidebar bg (white-beige) |
| `--sidebar-foreground` | `oklch(0.145 0 0)` | Sidebar text |
| `--sidebar-primary` | `oklch(0.52 0.22 27.3)` | Sidebar active (red) |
| `--sidebar-primary-foreground` | `oklch(0.985 0 0)` | — |
| `--sidebar-accent` | `oklch(0.93 0.04 250)` | Sidebar hover (blue) |
| `--sidebar-accent-foreground` | `oklch(0.205 0 0)` | — |
| `--sidebar-border` | `oklch(0.90 0.01 80)` | Sidebar borders |
| `--sidebar-ring` | `oklch(0.54 0.19 250)` | — |

### Dark mode (`.dark`)
| Token | Value |
|---|---|
| `--background` | `oklch(0.16 0.01 260)` |
| `--foreground` | `oklch(0.95 0 0)` |
| `--card` | `oklch(0.21 0.01 260)` |
| `--card-foreground` | `oklch(0.95 0 0)` |
| `--popover` | `oklch(0.21 0.01 260)` |
| `--popover-foreground` | `oklch(0.95 0 0)` |
| `--primary` | `oklch(0.60 0.22 27.3)` (lighter red) |
| `--primary-foreground` | `oklch(0.985 0 0)` |
| `--secondary` | `oklch(0.25 0.05 250)` |
| `--secondary-foreground` | `oklch(0.85 0.05 250)` |
| `--muted` | `oklch(0.26 0.01 260)` |
| `--muted-foreground` | `oklch(0.65 0 0)` |
| `--accent` | `oklch(0.26 0.05 250)` |
| `--accent-foreground` | `oklch(0.92 0 0)` |
| `--destructive` | `oklch(0.65 0.22 27.3)` |
| `--border` | `oklch(1 0 0 / 10%)` |
| `--input` | `oklch(1 0 0 / 12%)` |
| `--ring` | `oklch(0.60 0.19 250)` |
| `--chart-1..5` | `0.60 0.22 27.3` / `0.60 0.19 250` / `0.65 0.12 150` / `0.70 0.12 60` / `0.55 0.08 300` |
| `--sidebar` | `oklch(0.19 0.01 260)` |
| `--sidebar-foreground` | `oklch(0.95 0 0)` |
| `--sidebar-primary` | `oklch(0.60 0.22 27.3)` |
| `--sidebar-accent` | `oklch(0.26 0.05 250)` |
| `--sidebar-accent-foreground` | `oklch(0.92 0 0)` |
| `--sidebar-border` | `oklch(1 0 0 / 10%)` |
| `--sidebar-ring` | `oklch(0.60 0.19 250)` |

### Hardcoded colours NOT in the token system (inconsistencies — reproduce verbatim)
These Tailwind palette colours appear inline (used for semantic status states beyond the token set). Capture them exactly:

**Notification/count dots & badges**
- Pending count pill: `bg-orange-500 text-white` (workers-table, supervisor-workers-table, attendance/page).
- "Inline" pending status text: `text-orange-500`.
- Live "active" dot: `bg-green-500 animate-pulse`; with `ring-2 ring-background` in mobile-bottom-nav (`size-2`).

**Trend / pos-neg indicators** (kpi-row `TrendLine`, dashboard tiles)
- Positive: `text-green-600 dark:text-green-400`
- Negative: `text-destructive`
- Neutral: `text-muted-foreground`
- "red"/"green" KPI highlight values: `text-destructive` / `text-green-700 dark:text-green-400`

**Approve / reject row-action icon buttons**
- Approve: `text-green-600 hover:text-green-700` (and `hover:bg-green-50 dark:hover:bg-green-950/30`)
- Reject/destructive: `text-destructive hover:text-destructive`

**Inventory movement-type pills** (`supervisor-inventory-client.tsx`, `sites/[id]/_components/inventory-tab.tsx`) — identical maps:
```
received:     "bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400"
consumed:     "bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400"
wasted:       "bg-orange-100 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400"
returned:     "bg-purple-100 text-purple-700 dark:bg-purple-950/30 dark:text-purple-400"
transfer_in:  "bg-teal-100 text-teal-700 dark:bg-teal-950/30 dark:text-teal-400"
transfer_out: "bg-slate-100 text-slate-700 dark:bg-slate-950/30 dark:text-slate-400"
```

**Gallery tag colours** (`admin-gallery-client.tsx`, `supervisor-gallery-client.tsx`) — identical maps:
```
site:     "bg-blue-500/80"
material: "bg-orange-500/80"
team:     "bg-green-500/80"
process:  "bg-purple-500/80"
fallback: "bg-gray-500/80"
```
Gallery tag chip: `inline-block truncate rounded px-1.5 py-0.5 text-[10px] font-semibold text-white`. Delete button: `bg-black/60 text-white hover:bg-red-600`.

**Attendance change-request type pills** (attendance-list, attendance-log-table, change-requests-review, pending-requests):
```
type A:  "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"  (or dark:text-amber-400)
type B:  "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300" (or dark:text-indigo-400)
```

**Greeting strip top-border status** (`greeting-strip.tsx`):
```
green:   "border-t-4 border-t-green-500"   + text "text-green-600 dark:text-green-400"
amber:   "border-t-4 border-t-amber-500"   + text "text-amber-600 dark:text-amber-400"
neutral: "border-t-4 border-t-border"      + text "text-muted-foreground"
```

**Dashboard alert circle icons:** `bg-orange-100 dark:bg-orange-950/30 text-orange-600`, `bg-blue-100 dark:bg-blue-950/30 text-blue-600`.
**Attendance progress bar:** `bg-green-500` when 100% else `bg-primary`.
**Attendance done-row tint:** `bg-green-50/30 dark:bg-green-900/10`.

---

## 3. Typography

### Font family
- Single family: **Inter** (`--font-inter`). Both `--font-sans` and `--font-heading` map to it (so `font-heading` === `font-sans` here). No explicit fallback stack is declared beyond Tailwind v4's default (`font-sans` → Inter, then system fallbacks). `<html>` carries `antialiased`.

### Size scale actually used
| Class | Where |
|---|---|
| `text-[10px]` | gallery tag chips, mobile bottom-nav labels |
| `text-xs` | helper/caption text, badges, table sub-text, tooltips, pagination page count |
| `text-[0.8rem]` | button `sm` size |
| `text-sm` | **the dominant body size** — tables, inputs, nav items, descriptions, most labels |
| `text-base` | inputs/textarea (mobile, `md:text-sm`), card/dialog/sheet titles |
| `text-xl` | supervisor greeting headline (`text-xl font-bold`) |
| `text-2xl` | **page H1** (`PageHeader`, dashboard headers): `text-2xl font-semibold` |
| `text-3xl` | KPI tile big numbers: `text-3xl font-bold leading-none` |

> No `text-4xl`+ in use. Tables/UI default to `text-sm`; large numbers cap at `text-3xl`.

### Weight usage
- `font-medium` — default for buttons, badges, nav labels, table headers (`TableHead`), card titles, labels, tabs.
- `font-semibold` — page H1 (`text-2xl font-semibold`), sidebar brand, user name, quick-action labels, KPI sub-labels.
- `font-bold` — KPI big numbers, avatar initials, greeting headline.
- `font-normal`/(unset) — body cells, descriptions.
- Card title is **`font-medium`** not bold (`font-heading text-base leading-snug font-medium`).

### Line-height & letter-spacing
- `leading-none` (KPI numbers, dialog title), `leading-tight` (user name/email, labels, greeting), `leading-snug` (CardTitle), `leading-none` on small count pills.
- `tracking-tight` — sidebar brand.
- `tracking-wide` + `uppercase` — small section eyebrow labels (e.g. "Wages" in worker form: `text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide`).
- `tracking-widest` — dropdown shortcut text.
- `tabular-nums` — numeric stats (days, pay, pagination, progress value).
- `font-mono` — employee IDs in tables.

---

## 4. Spacing & layout

### Spacing rhythm
**4px grid**, dominated by Tailwind's default scale. Observed values:
- Page sections: `space-y-6` (admin pages/dashboard), `space-y-4` (supervisor dashboard, table toolbars, forms).
- Card internal gap: `gap-4` (default), `gap-3` (`size=sm`).
- Form field gap: `space-y-4` between rows; `grid gap-2` inside a `FormItem`; `grid grid-cols-2 gap-4` for two-col field grids.
- Dialog/sheet content gap: `gap-4`. Sheet header/footer padding `p-4`.
- Toolbar/filter gaps: `gap-2` / `gap-3`, `flex-wrap`.
- Nav item gap: `gap-0.5` vertical list, `gap-3` icon↔label.
- Main content padding: **`p-6`** (`<main>` in AppShell).
- Table cell padding: `p-2` (`TableCell`), header `h-10 px-2`.
- Empty-state cell: `py-12 text-center`.

### Container / centring
- No max-width container utility. Content is constrained by the flexible main column: `<main className="flex-1 overflow-y-auto p-6">`. Pages wrap content in `space-y-6` / `space-y-4` divs that flex to full width.
- Auth/login centres a fixed card: `flex min-h-screen items-center justify-center` + `Card className="w-full max-w-sm"`.
- Dashboard grids use 12-col spans: `grid gap-6 lg:grid-cols-12` with `lg:col-span-8` / `lg:col-span-4`; KPI row `grid gap-4 sm:grid-cols-2 lg:grid-cols-4`.

### Breakpoints
Tailwind v4 **defaults**, not customised. `lg` (1024px) is the desktop/mobile pivot (sidebar shows at `lg:flex`, mobile header/bottom-nav `lg:hidden`). `sm` used for dialog widths and stacked→row layouts.

### Border radius scale
Base `--radius: 0.625rem` (10px). Derived scale from `@theme inline`:
| Token | Formula | ≈ value |
|---|---|---|
| `--radius-sm` | `calc(var(--radius) * 0.6)` | 6px |
| `--radius-md` | `calc(var(--radius) * 0.8)` | 8px |
| `--radius-lg` | `var(--radius)` | 10px |
| `--radius-xl` | `calc(var(--radius) * 1.4)` | 14px |
| `--radius-2xl` | `calc(var(--radius) * 1.8)` | 18px |
| `--radius-3xl` | `calc(var(--radius) * 2.2)` | 22px |
| `--radius-4xl` | `calc(var(--radius) * 2.6)` | 26px |

Applied: Buttons `rounded-lg`; Cards/Dialog `rounded-xl`; Inputs/Select/Textarea/InputGroup `rounded-lg`; dropdown/popover/tooltip `rounded-md`/`rounded-lg`; Badge `rounded-4xl` (pill); Avatar `rounded-full`; Skeleton `rounded-md`; Checkbox `rounded-[4px]`; small count pills `rounded-full`.

### Shadow scale
Tailwind defaults only. Observed: `shadow-sm` (active tab, dashboard range pill active state), `shadow-md` (dropdown/popover/select content, card hover `hover:shadow-md`), `shadow-lg` (sheet, dropdown sub-content). **Cards use ring, not shadow, by default** — `ring-1 ring-foreground/10` (see §5 Cards).

### Borders
- Colour: `--border` everywhere via base `* { @apply border-border … }`.
- Width: `1px` default (`border`); `border-t-4` for greeting-strip status accent.
- Cards: no border — they use `ring-1 ring-foreground/10`. Table/section wrappers use `rounded-lg border`.
- Inputs: `border border-input`.

---

## 5. Component patterns

### 5.1 Page header (`src/components/layout/page-header.tsx`)
```tsx
export function PageHeader({ title, description }: Props) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      <ReloadButton />
    </div>
  );
}
```
- Title `text-2xl font-semibold`; description `text-sm text-muted-foreground`; right-aligned `ReloadButton` (icon-only refresh, see §10/§7).
- Page body wraps header + content in `<div className="space-y-6">`.
- **Dashboard variant** (`dashboard-header.tsx`) replaces ReloadButton with a segmented range toggle: `flex gap-1 rounded-lg border bg-muted/40 p-1`, each button `rounded-md px-3 py-1 text-sm font-medium`, active = `bg-background text-foreground shadow-sm`, inactive = `text-muted-foreground hover:text-foreground`.

### 5.2 Data tables (TanStack Table + `ui/table.tsx`)
Table primitive classes (verbatim):
- Container: `relative w-full overflow-x-auto`; `<table>`: `w-full caption-bottom text-sm`.
- `TableHeader`: `[&_tr]:border-b`.
- `TableRow`: `border-b transition-colors hover:bg-muted/50 has-aria-expanded:bg-muted/50 data-[state=selected]:bg-muted`.
- `TableHead`: `h-10 px-2 text-left align-middle font-medium whitespace-nowrap text-foreground [&:has([role=checkbox])]:pr-0`.
- `TableCell`: `p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0`.
- `TableFooter`: `border-t bg-muted/50 font-medium`.
- **No zebra striping**; hover is `bg-muted/50`. Column headers **left-aligned** by default; action columns right-align cells with `flex items-center justify-end gap-1`.

Standard setup (from `workers-table.tsx`): `useReactTable` with `getCoreRowModel` + `getFilteredRowModel`, `state: { columnFilters, globalFilter, columnVisibility }`, hidden filter-only columns via `columnVisibility`. Toolbar above table:
```tsx
<div className="space-y-4">
  <div className="flex flex-wrap items-center justify-between gap-3">
    <div className="flex flex-wrap items-center gap-2">
      <Input placeholder="Search…" value={globalFilter} onChange={…} className="max-w-xs" />
      <Select …><SelectTrigger className="w-36">…</SelectTrigger>…</Select>
    </div>
    <div className="flex items-center gap-2">
      <Button variant="outline">Requested Workers
        {pendingCount > 0 && <span className="ml-1.5 rounded-full bg-orange-500 text-white text-xs px-1.5 py-0.5 leading-none">{pendingCount}</span>}
      </Button>
      <Button onClick={openAdd}>Add Worker</Button>
    </div>
  </div>

  <div className="rounded-lg border">
    <Table>
      <TableHeader>{table.getHeaderGroups().map(hg => (
        <TableRow key={hg.id}>{hg.headers.map(h => (
          <TableHead key={h.id}>{h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}</TableHead>
        ))}</TableRow>
      ))}</TableHeader>
      <TableBody>
        {table.getRowModel().rows.length === 0 ? (
          <TableRow><TableCell colSpan={columns.length} className="py-12 text-center text-muted-foreground">No workers found.</TableCell></TableRow>
        ) : table.getRowModel().rows.map(row => (
          <TableRow key={row.id}>{row.getVisibleCells().map(cell => (
            <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
          ))}</TableRow>
        ))}
      </TableBody>
    </Table>
  </div>
</div>
```
- Name cell pattern (two-line): `<p className="font-medium">{name}</p>` + `<p className="text-xs text-muted-foreground">…</p>`.
- Money cells: `₹${Number(x).toLocaleString("en-IN")}` or `formatINR()`.
- Server-side pagination uses `PaginationBar` (§5.x). Empty cell value placeholder: `<span className="text-muted-foreground">—</span>`.

### 5.3 Forms (react-hook-form + Zod + `ui/form.tsx`)
Wiring pattern (from `worker-form-dialog.tsx` / `login/page.tsx`):
```tsx
const form = useForm<Values>({ resolver: zodResolver(Schema), defaultValues });
…
<Form {...form}>
  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
    {rootError && <p className="text-sm text-destructive">{rootError}</p>}
    <FormField control={form.control} name="name" render={({ field }) => (
      <FormItem className="col-span-2">
        <FormLabel>Full Name</FormLabel>
        <FormControl><Input placeholder="Ramesh Singh" {...field} /></FormControl>
        <FormMessage />
      </FormItem>
    )} />
    …
    <DialogFooter>
      <Button type="submit" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? "Adding…" : "Add Worker"}
      </Button>
    </DialogFooter>
  </form>
</Form>
```
- **Label placement:** above input. `FormItem` = `grid gap-2`; vertical field rhythm = `space-y-4`. Two-column grids: `grid grid-cols-2 gap-4`, full-width fields get `col-span-2`.
- **`FormLabel`** turns `text-destructive` when the field has an error (`data-[error=true]:text-destructive`).
- **`FormMessage`** = `text-destructive text-sm` (renders Zod error message; null if empty).
- **`FormDescription`** (helper text) = `text-muted-foreground text-sm`.
- **Root/form-level error**: plain `<p className="text-sm text-destructive">`.
- **File inputs / non-RHF fields** use a bare `<div className="grid gap-2"><Label/><Input type="file" accept="image/*"/></div>`.
- **Submit button placement:** inside `DialogFooter` (right-aligned on `sm+`). For Cancel/Submit pairs the order is **Cancel (outline) then Submit (default/destructive)** — see reject dialog. Submit label shows progressive verb on `isSubmitting` ("Saving…", "Adding…", "Signing in…"). Login submit is full-width `className="w-full"`.
- Currency fields label with trailing `₹`, e.g. `Daily Wage ₹`, input `placeholder="0"`.

### 5.4 Dialogs / modals (`ui/dialog.tsx`, `@base-ui/react/dialog`)
- Overlay: `fixed inset-0 isolate z-50 bg-black/10 … supports-backdrop-filter:backdrop-blur-xs` + fade animation.
- Content (`DialogContent`): centred via `fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2`, `z-50 grid w-full max-w-[calc(100%-2rem)] gap-4 rounded-xl bg-popover p-4 text-sm text-popover-foreground ring-1 ring-foreground/10 … sm:max-w-sm` + `data-open:animate-in fade-in-0 zoom-in-95` / `data-closed:…zoom-out-95`, `duration-100`.
- Close button (auto, top-right): ghost `size="icon-sm"` `absolute top-2 right-2` with `<XIcon/>` + `sr-only "Close"`. `showCloseButton` prop (default true).
- `DialogHeader`: `flex flex-col gap-2`. `DialogTitle`: `font-heading text-base leading-none font-medium`. `DialogDescription`: `text-sm text-muted-foreground`.
- `DialogFooter`: **full-bleed footer bar** — `-mx-4 -mb-4 flex flex-col-reverse gap-2 rounded-b-xl border-t bg-muted/50 p-4 sm:flex-row sm:justify-end` (stacks reversed on mobile, right-aligned row on `sm+`).
- Wide/scrolling dialogs override width+height: `className="sm:max-w-2xl max-h-[90vh] overflow-y-auto"`.

### 5.5 Status badges (`ui/badge.tsx` + per-page variant maps)
Badge base (cva): `inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-4xl border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap`. Variants:
- `default`: `bg-primary text-primary-foreground`
- `secondary`: `bg-secondary text-secondary-foreground`
- `destructive`: `bg-destructive/10 text-destructive`
- `outline`: `border-border text-foreground`
- `ghost`: `hover:bg-muted hover:text-muted-foreground`
- `link`: `text-primary underline-offset-4 hover:underline`

**Status → variant mappings** (each page defines a `Record<string, variant>`, fallback shown):

| Domain | pending | approved | active | rejected | other | fallback |
|---|---|---|---|---|---|---|
| Worker approval (`workers-table`) | `outline` | `default` | — | `destructive` | — | — |
| Site status (`sites-table`, `site-detail`) | — | — | `active`→`default` | `cancelled`→`destructive` | `planned`→`outline`, `paused`/`completed`→`secondary` | `outline` |
| Material requests (`materials/page`) | `secondary` | `outline` | — | `destructive` | `delivered`→`default` | `secondary` |
| Disbursement batches (`batches-table`) | — | — | — | — | (`requested`/`paid`/etc → `default`/`secondary`/`outline`) | `secondary` |
| Expenses (`expenses/page`) | `secondary` | `outline` | — | `destructive` | — | `secondary` |
| Attendance change-req (`change-requests-review`) | — | — | — | — | — | `secondary` |

Pattern: `<Badge variant={STATUS_VARIANTS[x.status] ?? "secondary"} className="capitalize">{x.status}</Badge>`. Tables often add `className="text-xs capitalize"`.

Note: small inline status counts are **not** Badges — they are `<span className="ml-1.5 rounded-full bg-orange-500 text-white text-xs px-1.5 py-0.5 leading-none">`.

### 5.6 Buttons (`ui/button.tsx`, `@base-ui/react/button` + cva)
Base: `group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 …`.

Variants (verbatim):
- `default`: `bg-primary text-primary-foreground [a]:hover:bg-primary/80`
- `outline`: `border-border bg-background hover:bg-muted hover:text-foreground … dark:border-input dark:bg-input/30 dark:hover:bg-input/50`
- `secondary`: `bg-secondary text-secondary-foreground hover:bg-secondary/80`
- `ghost`: `hover:bg-muted hover:text-foreground … dark:hover:bg-muted/50`
- `destructive`: `bg-destructive/10 text-destructive hover:bg-destructive/20 …` (subtle tint, **not** solid red)
- `link`: `text-primary underline-offset-4 hover:underline`

Sizes: `default h-8 px-2.5 gap-1.5` · `xs h-6` · `sm h-7 text-[0.8rem]` · `lg h-9` · `icon size-8` · `icon-xs size-6` · `icon-sm size-7` · `icon-lg size-9`. Default SVG icon size `size-4`. Icon+text auto-pads via `has-data-[icon=inline-*]`.

Common usage: `<Button onClick={openAdd}>Add Worker</Button>` (primary), filter toggles `variant="outline"`, row actions `variant="ghost" size="icon" className="size-8"` with a 16px lucide icon + `title="…"` tooltip.

### 5.7 Cards / stat tiles (`ui/card.tsx`)
- `Card`: `group/card flex flex-col gap-4 overflow-hidden rounded-xl bg-card py-4 text-sm text-card-foreground ring-1 ring-foreground/10 …` (+ `data-[size=sm]` → `gap-3 py-3`). **No border/shadow by default — uses a hairline ring.**
- `CardHeader`: `@container/card-header grid auto-rows-min items-start gap-1 rounded-t-xl px-4` (auto two-col when a `CardAction` is present).
- `CardTitle`: `font-heading text-base leading-snug font-medium`.
- `CardDescription`: `text-sm text-muted-foreground`.
- `CardContent`: `px-4`.
- `CardFooter`: `flex items-center rounded-b-xl border-t bg-muted/50 p-4`.

**KPI tile** (`kpi-row.tsx`) — the dashboard stat pattern:
```tsx
<Card className="group cursor-pointer transition-all hover:shadow-md hover:border-primary/30 h-full flex flex-col">
  <CardHeader className="pb-2">
    <div className="flex items-center justify-between">
      <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      <div className="flex items-center gap-1">
        <Icon className="size-4 text-muted-foreground" />
        <ChevronRight className="size-3 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
      </div>
    </div>
  </CardHeader>
  <CardContent className="flex flex-1 flex-col justify-between gap-1">
    <p className="text-3xl font-bold leading-none …highlight…">{value}</p>
    <div className="space-y-0.5">{sub1 && <div className="text-xs text-muted-foreground">{sub1}</div>}…</div>
  </CardContent>
</Card>
```
Wrapped in `TooltipProvider > Tooltip > TooltipTrigger render={<Link href className="block h-full"/>}`. Grid: `grid gap-4 sm:grid-cols-2 lg:grid-cols-4`. Highlight: red value `text-destructive`, green `text-green-700 dark:text-green-400`.

**Quick-action tile** (`quick-actions.tsx`): `Card className="group cursor-pointer transition-all hover:border-primary/30 hover:shadow-md active:scale-95"`, content `flex flex-col items-center justify-center gap-2 py-5 text-center`, icon in `flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary group-hover:bg-primary/20`.

### 5.8 Navigation (`app-shell.tsx`)
**Desktop sidebar** (`lg:flex`, hidden below): `<aside>` `hidden shrink-0 flex-col border-r transition-[width] duration-200 lg:flex`, width `w-56` expanded / `w-[60px]` collapsed (persisted in `localStorage["sidebar-collapsed"]`).
- Header row `h-14 shrink-0 items-center border-b px-3` with brand `text-sm font-semibold tracking-tight "Anuranjan EMS"` + collapse toggle (ghost icon, `PanelLeftClose`/`PanelLeftOpen`).
- Nav: `<nav className="flex flex-1 flex-col gap-0.5 px-3">`; each item is a `Link`:
  ```tsx
  className={cn("flex items-center gap-3 rounded-md px-2 py-1.5 text-sm transition-colors",
    collapsed && "justify-center px-0",
    isActive ? "text-primary font-semibold" : "font-medium text-muted-foreground hover:text-foreground")}
  ```
  Icon `size-4 shrink-0` (+ `text-primary` when active). **Active state = red text + semibold (no background pill).** `isActive` is exact `pathname === item.href`.
- User footer: `shrink-0 border-t p-3` — avatar square `size-9 rounded bg-primary text-xs font-bold text-primary-foreground` (initials), name `text-sm font-semibold`, email `text-xs text-muted-foreground`, plus ThemeToggle + Logout ghost icon buttons. Collapsed footer stacks them vertically `size-8`.

**Mobile header** (`lg:hidden`): `<header className="flex h-14 shrink-0 items-center gap-3 border-b px-4 lg:hidden">` — `Sheet` (side="left", `w-56 p-0`, `showCloseButton={false}`) triggered by a ghost `Menu` icon button, then brand text. The Sheet renders the same `SidebarInner`.

**Content area:** `<main className="flex-1 overflow-y-auto p-6">`. Whole shell: `<div className="flex h-screen overflow-hidden">`.

**Supervisor mobile bottom-nav** (`mobile-bottom-nav.tsx`): `fixed bottom-0 inset-x-0 z-50 border-t bg-background/95 backdrop-blur-sm lg:hidden`, 4-column grid, each link `flex min-h-[56px] flex-col items-center justify-center gap-1 py-2 text-xs font-medium`, active `text-primary`. Live dot on Attendance icon: `absolute -top-0.5 -right-0.5 size-2 rounded-full bg-green-500 ring-2 ring-background`. A `h-14` spacer follows.

**Icon library:** `lucide-react`. Admin nav icons (in order): Home, ClipboardCheck, Users, UserCheck, Building2, Map, Package, PackageSearch, CalendarCheck, Wallet, Receipt, RefreshCw, Banknote, BarChart2, Images, Settings. Supervisor: Home, MapPin, CalendarCheck, Users, Package, PackageSearch, Wallet, Receipt, Clock, Images, Settings.

### 5.9 Empty states
- In tables: a full-width row — `<TableCell colSpan={columns.length} className="py-12 text-center text-muted-foreground">No workers found.</TableCell>`.
- In cards/lists: muted centered text; conditionally rendered widgets simply return null when no data (e.g. `MaterialAlerts`, `GalleryPreview` "only renders if there's data"). There is **no illustration/icon empty-state component**; the convention is muted text + (optionally) a CTA button.

### 5.10 Loading states
Two mechanisms:
1. **Route-level** `loading.tsx` (admin & supervisor, identical):
   ```tsx
   <div className="flex h-full items-center justify-center"><Spinner /></div>
   ```
   `Spinner` = `size-7 animate-spin rounded-full border-[3px] border-muted border-t-primary` (CSS ring spinner, red top).
2. **Widget-level Skeletons** — every dashboard widget exports a `*Skeleton` used as a `<Suspense fallback>`. `Skeleton` = `animate-pulse rounded-md bg-muted`. Example (`KPIRowSkeleton`): same grid, Cards with `<Skeleton className="h-4 w-32"/>`, `h-9 w-20`, `h-3 w-40`, `h-3 w-28`. TanStack-Query widgets render their skeleton while `isLoading`.

Some inline pulses use raw `div … bg-muted animate-pulse` (e.g. `QuickActionsSkeleton` circle `size-11 rounded-full bg-muted animate-pulse`).

### 5.11 Toasts / notifications
- Library: **sonner** (`ui/sonner.tsx`), themed via next-themes, CSS vars `--normal-bg: var(--popover)`, `--normal-text: var(--popover-foreground)`, `--normal-border: var(--border)`, `--border-radius: var(--radius)`. Custom lucide icons: success `CircleCheckIcon`, info `InfoIcon`, warning `TriangleAlertIcon`, error `OctagonXIcon`, loading `Loader2Icon animate-spin` (all `size-4`).
- ⚠ **The `<Toaster/>` is not mounted in any layout, and no `toast()` calls exist** in `src/`. Mutations report errors via inline `<p className="text-sm text-destructive">` and use `window.confirm()` + `router.refresh()`. To reproduce faithfully: install sonner config but note it is currently inert.

### 5.12 Tabs / accordions / dropdowns / tooltips / popovers
- **Tabs** (`ui/tabs.tsx`): list `inline-flex w-fit items-center justify-center rounded-lg p-[3px]` — `default` variant `bg-muted`, `line` variant transparent w/ underline. Active tab (`default`): `data-active:bg-background data-active:text-foreground` + `shadow-sm`. Trigger text `text-foreground/60` → `hover:text-foreground`.
- **Dropdown menu** (`ui/dropdown-menu.tsx`, base-ui menu): content `rounded-lg bg-popover p-1 shadow-md ring-1 ring-foreground/10`, items `rounded-md px-1.5 py-1 text-sm focus:bg-accent focus:text-accent-foreground`, destructive variant `data-[variant=destructive]:text-destructive`.
- **Tooltip** (`ui/tooltip.tsx`): **dark inverted** — `bg-foreground px-3 py-1.5 text-xs text-background rounded-md`, with a rotated `Arrow` (`size-2.5 rotate-45 bg-foreground`). Provider `delay = 0`.
- **Popover** (`ui/popover.tsx`): `w-72 rounded-lg bg-popover p-2.5 shadow-md ring-1 ring-foreground/10`.
- **Select** (`ui/select.tsx`): trigger `rounded-lg border border-input … h-8` (`sm` → h-7), `ChevronDownIcon` muted; content `rounded-lg bg-popover shadow-md ring-1 ring-foreground/10`, items `rounded-md py-1 pr-8 pl-1.5 focus:bg-accent`, check indicator right-aligned. Usage frequently customises the trigger label: `<SelectTrigger className="w-36"><span className="text-sm"><span className="text-muted-foreground">City: </span>{value || "All"}</span></SelectTrigger>`.
- **Accordion**: Not present as a UI primitive.

---

## 6. Icon system
- Library: **lucide-react** (`^1.14.0`). Import named: `import { Pencil, Eye, … } from "lucide-react"`. Type import `import type { LucideIcon } from "lucide-react"`.
- Default size: **`size-4` (16px)** for inline/action icons; `size-3`/`size-3.5` for tiny contexts; `size-5` for mobile-nav/headers. Stroke width = lucide default (2) — **never overridden**.
- Icons are `pointer-events-none shrink-0` inside buttons (via button base `[&_svg]` rules).
- **Concept → icon mapping** (observed):

| Concept | Icon |
|---|---|
| Edit | `Pencil` |
| View / reveal (Aadhar, details) | `Eye` |
| View profile | `UserRound` |
| Approve / confirm | `CheckCircle`, `CheckIcon` |
| Reject / remove | `XCircle`, `X`, `XIcon` |
| Deactivate / activate | `ShieldOff` / `ShieldCheck` |
| Refresh / reload / recurring | `RefreshCw` |
| Open external / detail | `ExternalLink`, `ChevronRight` |
| Add worker / person | `UserPlus`, `Users`, `UserCheck` |
| Money / wages | `Wallet`, `Banknote`, `Receipt` |
| Materials / inventory | `Package`, `PackageSearch` |
| Sites / buildings | `Building2`, `MapPin`, `Map` |
| Attendance / dates | `CalendarCheck`, `Clock` |
| Dashboard home | `Home` |
| Approvals | `ClipboardCheck` |
| Reports | `BarChart2` |
| Gallery | `Images` |
| Settings | `Settings` |
| Theme toggle | `Sun` / `Moon` |
| Sidebar collapse | `PanelLeftClose` / `PanelLeftOpen` |
| Mobile menu | `Menu` |
| Logout | `LogOut` |
| Trends | `TrendingUp` / `TrendingDown` / `Minus` |
| Alerts | `AlertCircle` |
| Toast icons | `CircleCheckIcon` / `InfoIcon` / `TriangleAlertIcon` / `OctagonXIcon` / `Loader2Icon` |

---

## 7. Interaction & motion
- **Transitions:** Buttons/cards `transition-all`; nav items/inputs/selects `transition-colors`; sidebar width `transition-[width] duration-200`.
- **Animations:** Popovers/dialogs/dropdowns/select/tooltip use `tw-animate-css` data-state classes: `data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95` and `data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95`, `duration-100`. Slide-ins per side: `data-[side=bottom]:slide-in-from-top-2`, etc.
- **Overlays:** `bg-black/10` + `supports-backdrop-filter:backdrop-blur-xs`. Sheet slides `translate-x/y-[2.5rem]` with `duration-200 ease-in-out`.
- **Hover effects:** cards `hover:shadow-md hover:border-primary/30`; quick-action `active:scale-95`; rows `hover:bg-muted/50`; ghost buttons `hover:bg-muted`; KPI chevron fades in `opacity-0 group-hover:opacity-100`.
- **Active press:** buttons `active:not-aria-[haspopup]:translate-y-px` (1px nudge).
- **Spinners:** `animate-spin` (Spinner, reload button when `spinning`, loading toast). Live status dots `animate-pulse`.
- **Reload button** (`reload-button.tsx`): `rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground`, icon spins for 800ms then stops.
- **Focus ring:** the consistent signature — `focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50` (blue ring, 3px). Some primitives use `focus-visible:ring-[3px]`. Invalid state: `aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20`. Global base also sets `* { outline-ring/50 }`.

---

## 8. Layout shells

Both `(admin)` and `(supervisor)` layouts are **identical in structure** — they differ only in `role` (which swaps the nav array) and auth guard:
```tsx
// (admin)/layout.tsx  — supervisor is identical with requireSupervisor / role="supervisor"
const session = await requireAdmin();
return (
  <QueryProvider>
    <AppShell role="admin" userName={session.user.name} userEmail={session.user.email}>
      {children}
    </AppShell>
  </QueryProvider>
);
```

`AppShell` structure (see §5.8 for classes):
```
<div className="flex h-screen overflow-hidden">
  <aside class="hidden lg:flex … w-56 / w-[60px]">        ← desktop sidebar (collapsible)
     SidebarInner: [h-14 brand+collapse] [flex-1 nav] [border-t user footer]
  <div className="flex flex-1 flex-col overflow-hidden">
     <header class="h-14 lg:hidden">  Sheet(menu) + brand   ← mobile only
     <main className="flex-1 overflow-y-auto p-6">{children}</main>
```
- Nav lives in the left `<aside>` (desktop) and in a left `Sheet` (mobile). Header bar exists **only on mobile** (`lg:hidden`) and contains the hamburger + brand. Desktop has no top header bar — the page's own `PageHeader` serves as the title.
- Supervisor dashboard additionally renders a `MobileBottomNav` (fixed bottom, `lg:hidden`) — this is page-level, not in the shell.
- Responsive differences: sidebar `hidden`→`lg:flex`; mobile header/bottom-nav `lg:hidden`; sidebar collapse persisted to localStorage.

---

## 9. Reusable design utilities

### `cn()` — `src/lib/utils.ts` (verbatim)
```ts
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

### cva variant functions (exported)
- `buttonVariants` (`ui/button.tsx`) — also reused by `PaginationBar` via `buttonVariants({ variant:"outline", size:"sm" })`.
- `badgeVariants` (`ui/badge.tsx`).
- `tabsListVariants` (`ui/tabs.tsx`).
- `inputGroupAddonVariants`, `inputGroupButtonVariants` (`ui/input-group.tsx`).

### Shared formatter utilities — `src/lib/utils/format.ts` (verbatim, the design-relevant ones)
```ts
export function formatINR(amount): string {        // "₹1,23,456"  (en-IN, 0 decimals)
  const num = …; if (isNaN(num)) return "₹0";
  return `₹${num.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}
export function formatINRDecimals(amount): string { // "₹1,234.00"  (2 decimals)
  …`₹${num.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
export function formatDateIST(date): string {       // "9 Jun 2026" (en-IN, Asia/Kolkata)
export function todayIST(): string {                // "YYYY-MM-DD" en-CA in IST
```
- Currency convention everywhere: **`₹` prefix, `en-IN` grouping (lakh/crore), no decimals** for whole amounts. Empty/null values render `—`. Timezone is **Asia/Kolkata (IST)** throughout.

### Shared className idioms (not extracted to constants, but conventional)
- Page wrapper: `space-y-6` (admin) / `space-y-4` (supervisor).
- Table wrapper: `rounded-lg border`.
- Toolbar: `flex flex-wrap items-center justify-between gap-3`.
- Two-line cell: `font-medium` + `text-xs text-muted-foreground`.
- Em-dash placeholder: `<span className="text-muted-foreground">—</span>`.
- Section eyebrow: `text-xs font-medium text-muted-foreground uppercase tracking-wide`.

---

## 10. To reproduce this design exactly, do the following in order

1. **Scaffold Next.js 16 App Router + React 19 + TypeScript**, package manager pnpm. Set `tsconfig` path alias `@/* → src/*`.
2. **Install Tailwind CSS v4** (`tailwindcss@^4`, `@tailwindcss/postcss`). Create `postcss.config.mjs` with only `{ plugins: { "@tailwindcss/postcss": {} } }`. **Do not create a `tailwind.config.*`** — config is CSS-driven.
3. **Install runtime deps** matching §1: `@base-ui/react@^1.4.1`, `@radix-ui/react-slot`, `class-variance-authority`, `clsx`, `tailwind-merge`, `tw-animate-css`, `shadcn@^4`, `lucide-react@^1.14`, `next-themes`, `sonner`, `nextjs-toploader`, `@tanstack/react-query`, `@tanstack/react-table`, `react-hook-form`, `@hookform/resolvers`, `zod`, `react-day-picker`, `cmdk`, `recharts`, `date-fns`, `date-fns-tz`.
4. **Create `components.json`** verbatim from §1 — critically `"style": "base-nova"`, `"baseColor": "neutral"`, `"iconLibrary": "lucide"`, `"cssVariables": true`, `css → src/app/globals.css`.
5. **Create `src/app/globals.css`** verbatim from §1 — the three `@import`s (`tailwindcss`, `tw-animate-css`, `shadcn/tailwind.css`), the `@custom-variant dark`, the full `@theme inline` block (color + font + radius mappings), the entire `:root` and `.dark` token blocks, and the `@layer base` rules. This single file *is* the token system.
6. **Add the `cn()` helper** at `src/lib/utils.ts` verbatim (§9).
7. **Set up fonts in `src/app/layout.tsx`** verbatim (§1): Inter via `next/font/google` → `--font-inter`, `<html lang="en-IN" className="${inter.variable} h-full antialiased">`, `<body className="min-h-full flex flex-col">`, wrap in next-themes `ThemeProvider attribute="class" defaultTheme="light" disableTransitionOnChange`.
8. **Generate/copy the shadcn `base-nova` UI primitives** (all built on `@base-ui/react`, not Radix) into `src/components/ui/`: button, badge, card, table, input, textarea, label, select, dialog, sheet, dropdown-menu, popover, tooltip, tabs, checkbox, avatar, progress, separator, scroll-area, skeleton, spinner, sonner, calendar, command, input-group, form, pagination-bar. Use the exact className strings in §5 (radius: buttons/inputs `rounded-lg`, cards/dialogs `rounded-xl`, badges `rounded-4xl`; cards use **`ring-1 ring-foreground/10`** not borders; focus ring is **blue `ring-3 ring-ring/50`**).
9. **Add providers**: `query-provider.tsx` (QueryClient `staleTime: 20_000, retry: 1`) and `theme-provider.tsx` (next-themes passthrough).
10. **Build the layout shell** (`components/layout/app-shell.tsx`) per §5.8/§8: `flex h-screen overflow-hidden`, collapsible `w-56`/`w-[60px]` sidebar (`lg:flex`, localStorage-persisted), red-text+semibold active nav (no pill), `h-14` mobile header with left `Sheet`, `<main … p-6>`. Wire the two nav arrays (admin/supervisor icon lists from §5.8). Add `PageHeader` (`text-2xl font-semibold` title + muted description + `ReloadButton`).
11. **Create the two route groups** `(admin)` and `(supervisor)` with identical layouts (auth guard + `QueryProvider` + `AppShell role=…`). Add `loading.tsx` = centered `<Spinner/>`.
12. **Add format utilities** (`lib/utils/format.ts`): INR `en-IN` formatting (`₹`, 0 decimals), IST dates, `—` for nulls.
13. **Style pages in this order**, reusing the patterns verbatim:
    a. **Auth** (login) — centered `Card max-w-sm`, RHF+Zod, full-width submit.
    b. **Dashboards** — KPI tiles (`grid sm:grid-cols-2 lg:grid-cols-4`, `text-3xl font-bold` numbers, ring cards, hover `shadow-md`/`border-primary/30`), 12-col widget grids, `<Suspense>` + per-widget `*Skeleton`.
    c. **List pages** — `PageHeader` + toolbar (`Input max-w-xs` + label-style `Select`s + right-aligned action `Button`s) + `rounded-lg border` TanStack table (`hover:bg-muted/50`, no zebra, `py-12 text-center text-muted-foreground` empty row, `font-medium`/`text-xs muted` two-line cells, ghost `size-icon` row actions, `<Badge variant={MAP[status] ?? "secondary"} className="capitalize">`).
    d. **Forms/dialogs** — `Dialog` (`rounded-xl`, ring, full-bleed `bg-muted/50` footer), RHF `FormItem grid gap-2`, `space-y-4` rows, `grid grid-cols-2 gap-4`, errors `text-destructive text-sm`, submit shows progressive verb while `isSubmitting`.
14. **Reproduce the hardcoded semantic colours** from §2 exactly where they appear (orange count pills, green/red trend text, inventory movement pills, gallery tag colours, amber/indigo change-request pills, greeting-strip top-border states) — these live inline, not in the token system.
15. **Mount sonner `<Toaster/>` only if you intend to use toasts** — note the source project ships the component but never mounts it and never calls `toast()`; errors are surfaced inline and `window.confirm()` is used for confirmations. Match that behavior for pixel fidelity, or wire toasts up deliberately as an improvement.
```
