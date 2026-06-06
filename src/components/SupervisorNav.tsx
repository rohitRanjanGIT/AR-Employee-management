'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const navItems = [
  { label: 'Dashboard', href: '/supervisor/dashboard' },
  { label: 'Sites', href: '/supervisor/sites' },
  { label: 'Workers', href: '/supervisor/workers' },
]

export function SupervisorNav() {
  const pathname = usePathname()
  return (
    <nav className="flex gap-1 px-6 border-b bg-muted/30">
      {navItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            'px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
            pathname.startsWith(item.href)
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  )
}
