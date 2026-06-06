'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const navItems = [
  { label: 'Dashboard', href: '/admin/dashboard' },
  { label: 'Cities', href: '/admin/cities' },
  { label: 'Sites', href: '/admin/sites' },
  { label: 'Supervisors', href: '/admin/supervisors' },
  { label: 'Work Types', href: '/admin/work-types' },
]

export function AdminNav() {
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
