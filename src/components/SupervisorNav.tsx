'use client'

import { Building2, CalendarDays, Gauge, HardHat } from 'lucide-react'
import { AppSidebar } from '@/components/AppSidebar'

const navItems = [
  { label: 'Dashboard', href: '/supervisor/dashboard', icon: Gauge },
  { label: 'Sites', href: '/supervisor/sites', icon: Building2 },
  { label: 'Workers', href: '/supervisor/workers', icon: HardHat },
  { label: 'Attendance', href: '/supervisor/attendance', icon: CalendarDays },
]

export function SupervisorNav({ userName, userEmail }: { userName: string; userEmail: string }) {
  return <AppSidebar brand="Anuranjan EMS" userName={userName} userEmail={userEmail} items={navItems} />
}
