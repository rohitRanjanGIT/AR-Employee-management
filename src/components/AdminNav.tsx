'use client'

import {
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  Gauge,
  HardHat,
  Images,
  IndianRupee,
  Layers,
  MapPinned,
  Settings,
  ShieldCheck,
  Users,
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
  {
    label: 'Users',
    icon: Users,
    children: [
      { label: 'Admins', href: '/admin/admins', icon: ShieldCheck },
      { label: 'Supervisors', href: '/admin/supervisors', icon: UserRoundCog },
    ],
  },
  { label: 'Workers', href: '/admin/workers', icon: HardHat },
  { label: 'Attendance', href: '/admin/attendance', icon: CalendarDays },
  { label: 'Payroll', href: '/admin/payroll', icon: IndianRupee },
  { label: 'Gallery', href: '/admin/gallery', icon: Images },
  { label: 'Settings', href: '/settings', icon: Settings },
]

export function AdminNav({ userName, userEmail }: { userName: string; userEmail: string }) {
  return <AppSidebar brand="Anuranjan EMS" userName={userName} userEmail={userEmail} items={navItems} />
}
