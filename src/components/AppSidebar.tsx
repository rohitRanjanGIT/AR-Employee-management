'use client'

import { useEffect, useState, type ComponentType } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { ChevronDown, LogOut, Moon, PanelLeftClose, PanelLeftOpen, Sun } from 'lucide-react'
import { cn } from '@/lib/utils'
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
  items,
}: {
  brand: string
  userName: string
  userEmail: string
  items: NavEntry[]
}) {
  const pathname = usePathname()
  const router = useRouter()
  const { theme, toggleTheme } = useTheme()
  const [collapsed, setCollapsed] = useState(false)
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})

  // Restore persisted collapse state after mount (avoids hydration mismatch)
  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY) === '1') setCollapsed(true)
  }, [])

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

  // Mobile renders a flat horizontal bar — groups are flattened to their leaves
  const flatLeaves = items.flatMap((e) => (isGroup(e) ? e.children : [e]))

  return (
    <aside
      className={cn(
        'border-b bg-card/95 transition-[width] duration-200 lg:h-full lg:shrink-0 lg:border-r lg:border-b-0',
        collapsed ? 'lg:w-[60px]' : 'lg:w-56'
      )}
    >
      <div className="flex h-full flex-col">
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

        {/* Mobile: flat horizontal nav */}
        <nav className="flex gap-1 overflow-x-auto px-3 py-2 lg:hidden">
          {flatLeaves.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex min-w-max items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
                  isActive(item.href)
                    ? 'font-semibold text-primary'
                    : 'font-medium text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <Icon className="size-4" />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>

        {/* Desktop: vertical tree nav */}
        <nav className="hidden flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-3 lg:flex">
          {items.map((entry) => {
            const Icon = entry.icon

            if (!isGroup(entry)) {
              return (
                <Link
                  key={entry.href}
                  href={entry.href}
                  title={collapsed ? entry.label : undefined}
                  className={cn(
                    'flex items-center gap-3 rounded-md px-2 py-1.5 text-sm transition-colors',
                    collapsed && 'justify-center px-0',
                    isActive(entry.href)
                      ? 'font-semibold text-primary'
                      : 'font-medium text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  {!collapsed && <span className="truncate">{entry.label}</span>}
                </Link>
              )
            }

            // Collapsed: group is a single icon that expands the rail and opens itself
            if (collapsed) {
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
          })}
        </nav>

        {/* Desktop: user footer with theme toggle + logout (mobile uses the top header) */}
        <div className="hidden shrink-0 border-t p-3 lg:block">
          {collapsed ? (
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
          )}
        </div>
      </div>
    </aside>
  )
}
