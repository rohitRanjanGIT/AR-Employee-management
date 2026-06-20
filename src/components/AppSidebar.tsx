'use client'

import { useEffect, useState, type ComponentType } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  ChevronDown,
  LogOut,
  Menu,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Sun,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { useTheme } from '@/components/ThemeProvider'
import { authClient } from '@/lib/auth-client'

type Icon = ComponentType<{ className?: string }>

export type NavLeaf = { label: string; href: string; icon: Icon }
export type NavGroup = { label: string; icon: Icon; children: NavLeaf[] }
export type NavEntry = NavLeaf | NavGroup

function isGroup(entry: NavEntry): entry is NavGroup {
  return 'children' in entry
}

const STORAGE_KEY = 'ems-sidebar-collapsed'

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase() || '?'
  )
}

export function AppSidebar({
  brand,
  userName,
  userEmail,
  roleLabel,
  items,
}: {
  brand: string
  userName: string
  userEmail: string
  roleLabel?: string
  items: NavEntry[]
}) {
  const pathname = usePathname()
  const router = useRouter()
  const { theme, toggleTheme } = useTheme()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})

  // Restore persisted collapse state after mount (avoids hydration mismatch)
  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY) === '1') setCollapsed(true)
  }, [])

  // Close the mobile drawer whenever the route changes
  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  // Lock body scroll while the mobile drawer is open
  useEffect(() => {
    if (!mobileOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [mobileOpen])

  function toggleCollapsed() {
    setCollapsed((c) => {
      const next = !c
      localStorage.setItem(STORAGE_KEY, next ? '1' : '0')
      return next
    })
  }

  // Active match is exact per design system §5.8
  const isActive = (href: string) => pathname === href
  const groupActive = (g: NavGroup) => g.children.some((c) => isActive(c.href))
  // A group is open when explicitly toggled, otherwise auto-open if it holds the active route
  const isGroupOpen = (g: NavGroup) => openGroups[g.label] ?? groupActive(g)

  function toggleGroup(label: string) {
    setOpenGroups((s) => ({ ...s, [label]: !(s[label] ?? false) }))
  }

  function expandAndOpen(label: string) {
    setCollapsed(false)
    localStorage.setItem(STORAGE_KEY, '0')
    setOpenGroups((s) => ({ ...s, [label]: true }))
  }

  async function handleLogout() {
    await authClient.signOut()
    router.push('/login')
  }

  const isDark = theme === 'dark'
  const themeButton = (
    <button
      type="button"
      onClick={toggleTheme}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  )
  const logoutButton = (
    <button
      type="button"
      onClick={handleLogout}
      title="Logout"
      aria-label="Logout"
      className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      <LogOut className="size-4" />
    </button>
  )

  // Renders the vertical nav tree, shared by the desktop rail and the mobile drawer.
  // `isCollapsed` only applies to the desktop rail; `onNavigate` lets the drawer close on click.
  function renderItems(isCollapsed: boolean, onNavigate?: () => void) {
    return items.map((entry) => {
      const Icon = entry.icon

      if (!isGroup(entry)) {
        return (
          <Link
            key={entry.href}
            href={entry.href}
            onClick={onNavigate}
            title={isCollapsed ? entry.label : undefined}
            className={cn(
              'flex items-center gap-3 rounded-md px-2 py-1.5 text-sm transition-colors',
              isCollapsed && 'justify-center px-0',
              isActive(entry.href)
                ? 'font-semibold text-primary'
                : 'font-medium text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            <Icon className="size-4 shrink-0" />
            {!isCollapsed && <span className="truncate">{entry.label}</span>}
          </Link>
        )
      }

      // Collapsed (desktop rail only): group is a single icon that expands the rail and opens itself
      if (isCollapsed) {
        return (
          <button
            key={entry.label}
            type="button"
            onClick={() => expandAndOpen(entry.label)}
            title={entry.label}
            className={cn(
              'flex items-center justify-center rounded-md py-1.5 transition-colors',
              groupActive(entry)
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            <Icon className="size-4 shrink-0" />
          </button>
        )
      }

      const open = isGroupOpen(entry)
      return (
        <div key={entry.label}>
          <button
            type="button"
            onClick={() => toggleGroup(entry.label)}
            className={cn(
              'flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-sm font-medium transition-colors',
              groupActive(entry)
                ? 'text-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            <Icon className="size-4 shrink-0" />
            <span className="flex-1 truncate text-left">{entry.label}</span>
            <ChevronDown
              className={cn('size-4 shrink-0 transition-transform', !open && '-rotate-90')}
            />
          </button>
          {open && (
            <div className="mt-0.5 ml-3 flex flex-col gap-0.5 border-l pl-3">
              {entry.children.map((child) => {
                const ChildIcon = child.icon
                return (
                  <Link
                    key={child.href}
                    href={child.href}
                    onClick={onNavigate}
                    className={cn(
                      'flex items-center gap-3 rounded-md px-2 py-1.5 text-sm transition-colors',
                      isActive(child.href)
                        ? 'font-semibold text-primary'
                        : 'font-medium text-muted-foreground hover:bg-muted hover:text-foreground'
                    )}
                  >
                    <ChildIcon className="size-4 shrink-0" />
                    <span className="truncate">{child.label}</span>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      )
    })
  }

  const userFooter = (compact: boolean) =>
    compact ? (
      <div className="flex flex-col items-center gap-2">
        {themeButton}
        <div className="flex size-8 items-center justify-center rounded bg-primary text-xs font-bold text-primary-foreground">
          {initials(userName)}
        </div>
        {logoutButton}
      </div>
    ) : (
      <div className="flex items-center gap-2">
        <div className="flex size-9 shrink-0 items-center justify-center rounded bg-primary text-xs font-bold text-primary-foreground">
          {initials(userName)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold leading-tight">{userName}</p>
          <p className="truncate text-xs leading-tight text-muted-foreground">{userEmail}</p>
        </div>
        {themeButton}
        {logoutButton}
      </div>
    )

  return (
    <aside
      className={cn(
        'bg-card/95 transition-[width] duration-200 lg:h-full lg:shrink-0 lg:border-r',
        collapsed ? 'lg:w-[60px]' : 'lg:w-56'
      )}
    >
      <div className="flex h-full flex-col">
        {/* Mobile: top bar with hamburger that opens the off-canvas drawer */}
        <header className="flex items-center justify-between gap-3 border-b px-4 py-3 lg:hidden">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation menu"
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Menu className="size-5" />
            </button>
            <span className="truncate text-sm font-semibold tracking-tight">{brand}</span>
          </div>
          <div className="flex items-center gap-2">
            {roleLabel && <Badge variant="outline">{roleLabel}</Badge>}
            {themeButton}
            {logoutButton}
          </div>
        </header>

        {/* Desktop brand row + collapse toggle */}
        <div
          className={cn(
            'hidden h-14 shrink-0 items-center gap-2 border-b px-3 lg:flex',
            collapsed ? 'justify-center' : 'justify-between'
          )}
        >
          {!collapsed && (
            <span className="truncate text-sm font-semibold tracking-tight">{brand}</span>
          )}
          <button
            type="button"
            onClick={toggleCollapsed}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
          </button>
        </div>

        {/* Desktop: vertical tree nav */}
        <nav className="hidden flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-3 lg:flex">
          {renderItems(collapsed)}
        </nav>

        {/* Desktop: user footer with theme toggle + logout */}
        <div className="hidden shrink-0 border-t p-3 lg:block">{userFooter(collapsed)}</div>
      </div>

      {/* Mobile: off-canvas drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Scrim */}
          <button
            type="button"
            aria-label="Close navigation menu"
            onClick={() => setMobileOpen(false)}
            className="absolute inset-0 bg-black/50"
          />
          {/* Panel */}
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85%] flex-col bg-card shadow-xl">
            <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-b px-3">
              <span className="truncate text-sm font-semibold tracking-tight">{brand}</span>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Close navigation menu"
                className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>
            <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-3">
              {renderItems(false, () => setMobileOpen(false))}
            </nav>
            <div className="shrink-0 border-t p-3">{userFooter(false)}</div>
          </div>
        </div>
      )}
    </aside>
  )
}
