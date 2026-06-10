'use client'

import {
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  Gauge,
  HardHat,
  Layers,
  MapPinned,
  UserRoundCog,
} from 'lucide-react'
import { AppSidebar, type NavEntry } from '@/components/AppSidebar'

const navItems: NavEntry[] = [
  { label: 'Dashboard', href: '/admin/dashboard', icon: Gauge },
  {
    label: 'Site Management',
    icon: Layers,
    children: [
      { label: 'Cities', href: '/admin/cities', icon: MapPinned },
      { label: 'Sites', href: '/admin/sites', icon: Building2 },
      { label: 'Work Types', href: '/admin/work-types', icon: BriefcaseBusiness },
    ],
  },
  { label: 'Supervisors', href: '/admin/supervisors', icon: UserRoundCog },
  { label: 'Workers', href: '/admin/workers', icon: HardHat },
  { label: 'Attendance', href: '/admin/attendance', icon: CalendarDays },
]

export function AdminNav({ userName, userEmail }: { userName: string; userEmail: string }) {
  return <AppSidebar brand="Anuranjan EMS" userName={userName} userEmail={userEmail} items={navItems} />
}
