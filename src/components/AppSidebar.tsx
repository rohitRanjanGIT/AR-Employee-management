'use client'

import { useEffect, useState, type ComponentType } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronDown, ChevronLeft } from 'lucide-react'
import { cn } from '@/lib/utils'

type Icon = ComponentType<{ className?: string }>

export type NavLeaf = { label: string; href: string; icon: Icon }
export type NavGroup = { label: string; icon: Icon; children: NavLeaf[] }
export type NavEntry = NavLeaf | NavGroup

function isGroup(entry: NavEntry): entry is NavGroup {
  return 'children' in entry
}

const STORAGE_KEY = 'ems-sidebar-collapsed'

export function AppSidebar({
  title,
  subtitle,
  items,
}: {
  title: string
  subtitle: string
  items: NavEntry[]
}) {
  const pathname = usePathname()
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

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`)
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

  // Mobile renders a flat horizontal bar — groups are flattened to their leaves
  const flatLeaves = items.flatMap((e) => (isGroup(e) ? e.children : [e]))

  return (
    <aside
      className={cn(
        'border-b bg-card/95 transition-[width] duration-200 lg:sticky lg:top-0 lg:h-screen lg:shrink-0 lg:border-r lg:border-b-0',
        collapsed ? 'lg:w-16' : 'lg:w-64'
      )}
    >
      <div className="flex h-full flex-col">
        {/* Desktop header + collapse toggle */}
        <div className="hidden items-center justify-between gap-2 border-b px-3 py-4 lg:flex">
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold leading-none">{title}</p>
              <p className="mt-1 truncate text-xs text-muted-foreground">{subtitle}</p>
            </div>
          )}
          <button
            type="button"
            onClick={toggleCollapsed}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ChevronLeft className={cn('size-4 transition-transform', collapsed && 'rotate-180')} />
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
                  'flex min-w-max items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive(item.href)
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <Icon className="size-4" />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>

        {/* Desktop: vertical tree nav */}
        <nav className="hidden flex-col gap-1 px-3 py-4 lg:flex">
          {items.map((entry) => {
            const Icon = entry.icon

            if (!isGroup(entry)) {
              return (
                <Link
                  key={entry.href}
                  href={entry.href}
                  title={collapsed ? entry.label : undefined}
                  className={cn(
                    'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    collapsed && 'justify-center px-0',
                    isActive(entry.href)
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
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
                    'flex items-center justify-center rounded-lg py-2 transition-colors',
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
                    'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
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
                  <div className="mt-1 ml-3 flex flex-col gap-1 border-l pl-3">
                    {entry.children.map((child) => {
                      const ChildIcon = child.icon
                      return (
                        <Link
                          key={child.href}
                          href={child.href}
                          className={cn(
                            'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                            isActive(child.href)
                              ? 'bg-primary text-primary-foreground shadow-sm'
                              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
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
      </div>
    </aside>
  )
}
