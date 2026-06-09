'use client'

import {
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  Gauge,
  HardHat,
  MapPinned,
  UserRoundCog,
} from 'lucide-react'
import { AppSidebar } from '@/components/AppSidebar'

const navItems = [
  { label: 'Dashboard', href: '/admin/dashboard', icon: Gauge },
  { label: 'Cities', href: '/admin/cities', icon: MapPinned },
  { label: 'Sites', href: '/admin/sites', icon: Building2 },
  { label: 'Supervisors', href: '/admin/supervisors', icon: UserRoundCog },
  { label: 'Workers', href: '/admin/workers', icon: HardHat },
  { label: 'Attendance', href: '/admin/attendance', icon: CalendarDays },
  { label: 'Work Types', href: '/admin/work-types', icon: BriefcaseBusiness },
]

export function AdminNav() {
  return <AppSidebar title="Admin Modules" subtitle="Manage EMS operations" items={navItems} />
}
