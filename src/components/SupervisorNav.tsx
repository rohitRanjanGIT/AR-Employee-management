'use client'

import {
  Building2,
  CalendarDays,
  Gauge,
  HandCoins,
  HardHat,
  Images,
  Settings,
  Wallet,
} from 'lucide-react'
import { AppSidebar } from '@/components/AppSidebar'

const navItems = [
  { label: 'Dashboard', href: '/supervisor/dashboard', icon: Gauge },
  { label: 'Sites', href: '/supervisor/sites', icon: Building2 },
  { label: 'Workers', href: '/supervisor/workers', icon: HardHat },
  { label: 'Attendance', href: '/supervisor/attendance', icon: CalendarDays },
  { label: 'Advances', href: '/supervisor/advances', icon: HandCoins },
  { label: 'Balances', href: '/supervisor/balance', icon: Wallet },
  { label: 'Gallery', href: '/supervisor/gallery', icon: Images },
  { label: 'Settings', href: '/settings', icon: Settings },
]

export function SupervisorNav({ userName, userEmail }: { userName: string; userEmail: string }) {
  return (
    <AppSidebar
      brand="Anuranjan EMS"
      userName={userName}
      userEmail={userEmail}
      roleLabel="Supervisor"
      items={navItems}
    />
  )
}
