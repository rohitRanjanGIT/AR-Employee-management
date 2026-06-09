'use client'

import type { ComponentType } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

type SidebarItem = {
  label: string
  href: string
  icon: ComponentType<{ className?: string }>
}

export function AppSidebar({
  title,
  subtitle,
  items,
}: {
  title: string
  subtitle: string
  items: SidebarItem[]
}) {
  const pathname = usePathname()

  return (
    <aside className="border-b bg-card/95 lg:sticky lg:top-0 lg:h-screen lg:w-64 lg:shrink-0 lg:border-r lg:border-b-0">
      <div className="flex h-full flex-col">
        <div className="hidden border-b px-5 py-4 lg:block">
          <p className="text-sm font-semibold leading-none">{title}</p>
          <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 py-2 lg:flex-col lg:gap-1.5 lg:overflow-x-visible lg:px-3 lg:py-4">
          {items.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex min-w-max items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors lg:min-w-0',
                  isActive
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
      </div>
    </aside>
  )
}
