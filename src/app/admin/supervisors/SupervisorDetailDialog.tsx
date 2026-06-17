'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogClose,
  DialogFooter,
} from '@/components/ui/dialog'
import { Avatar } from '@/components/Avatar'
import { computeAge } from '@/lib/age'
import { formatDate } from '@/lib/utils'

type City = { id: string; name: string }
type AssignedSite = { siteId: string; siteName: string; siteCode: string; cityName: string }
type Supervisor = {
  id: string
  name: string
  email: string
  phone: string | null
  joinDate: Date | null
  salaryMonthly: string | null
  dateOfBirth: string | null
  accountNumber: string | null
  ifscCode: string | null
  photoUrl: string | null
  homeCity: City | null
  status: string
  assignedSites: AssignedSite[]
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm">{value ?? <span className="text-muted-foreground">—</span>}</span>
    </div>
  )
}

function fmtMoney(v: string | null) {
  if (!v) return null
  return `₹${Number(v).toLocaleString('en-IN')}`
}

export function SupervisorDetailDialog({
  supervisor,
  open,
  onOpenChange,
}: {
  supervisor: Supervisor | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  if (!supervisor) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-2 pr-6">
          <div className="flex items-center gap-3">
            <Avatar src={supervisor.photoUrl} name={supervisor.name} size={48} />
            <DialogTitle className="text-lg">{supervisor.name}</DialogTitle>
          </div>
          {supervisor.status === 'active' ? (
            <Badge variant="default">Active</Badge>
          ) : (
            <Badge variant="secondary">Inactive</Badge>
          )}
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-3 mt-2">
          <Row label="Email" value={supervisor.email} />
          <Row label="Phone" value={supervisor.phone} />
          <Row
            label="Date of Birth"
            value={supervisor.dateOfBirth ? formatDate(supervisor.dateOfBirth) : null}
          />
          <Row label="Age" value={computeAge(supervisor.dateOfBirth)} />
          <Row label="Home City" value={supervisor.homeCity?.name} />
          <Row label="Monthly Salary" value={fmtMoney(supervisor.salaryMonthly)} />
          <Row
            label="Join Date"
            value={supervisor.joinDate ? formatDate(supervisor.joinDate) : null}
          />
        </div>

        {/* Bank details — admin-only block (this page is admin-only) */}
        <div className="border-t pt-3 mt-1 grid grid-cols-2 gap-x-6 gap-y-3">
          <Row label="Account Number" value={supervisor.accountNumber} />
          <Row label="IFSC Code" value={supervisor.ifscCode} />
        </div>

        <div className="border-t pt-3 mt-1">
          <span className="text-xs text-muted-foreground">Assigned Sites</span>
          {supervisor.assignedSites.length === 0 ? (
            <p className="text-sm text-muted-foreground mt-1">None</p>
          ) : (
            <ul className="mt-1 space-y-0.5">
              {supervisor.assignedSites.map((s) => (
                <li key={s.siteId} className="text-sm">
                  {s.siteName} <span className="text-muted-foreground">({s.cityName})</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <DialogFooter className="mt-2">
          <DialogClose render={<Button variant="outline" size="sm" type="button" />}>
            Close
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
