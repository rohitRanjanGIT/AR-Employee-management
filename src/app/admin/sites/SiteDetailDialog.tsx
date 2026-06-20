'use client'

import Link from 'next/link'
import { UserPlus, Clock, Ban, Trash2, Camera, Images } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogClose,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { SiteSupervisorList } from './SiteSupervisorList'

type WorkType = { id: string; name: string }
type Employee = { id: string; name: string; phone: string | null }
type Assignment = { id: string; siteId: string; employeeId: string; assignedAt: Date; employee: Employee }
type City = { id: string; name: string; shortCode: string; status: string }
type Site = {
  id: string
  name: string
  code: string
  status: string
  tenderPrice: string | null
  totalProjectCost: string | null
  morningAttendanceStart: string | null
  morningAttendanceEnd: string | null
  eveningAttendanceStart: string | null
  eveningAttendanceEnd: string | null
  city: City
  siteWorkTypes: { id: string; siteId: string; workTypeId: string; workType: WorkType }[]
  siteSupervisorAssignments: Assignment[]
}

function money(v: string | null): string {
  if (!v) return '—'
  return `₹${Number(v).toLocaleString('en-IN')}`
}

function windowLabel(start: string | null, end: string | null): string {
  if (!start || !end) return 'Not set'
  return `${start} – ${end}`
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="text-sm">{children}</div>
    </div>
  )
}

export function SiteDetailDialog({
  site,
  open,
  onOpenChange,
  onAssign,
  onEditWindows,
  onDeactivate,
  onDelete,
}: {
  site: Site | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onAssign: () => void
  onEditWindows: () => void
  onDeactivate: () => void
  onDelete: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogTitle className="flex items-center gap-2">
          {site?.name}
          {site && (
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">{site.code}</code>
          )}
        </DialogTitle>

        {site && (
          <div className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-4">
              <Field label="City">{site.city.name}</Field>
              <Field label="Status">
                <Badge variant={site.status === 'active' ? 'default' : 'outline'}>
                  {site.status}
                </Badge>
              </Field>
              <Field label="Tender Price">{money(site.tenderPrice)}</Field>
              <Field label="Project Cost">{money(site.totalProjectCost)}</Field>
              <Field label="Morning Window">
                {windowLabel(site.morningAttendanceStart, site.morningAttendanceEnd)}
              </Field>
              <Field label="Evening Window">
                {windowLabel(site.eveningAttendanceStart, site.eveningAttendanceEnd)}
              </Field>
            </div>

            <Field label="Work Types">
              {site.siteWorkTypes.length === 0 ? (
                <span className="text-muted-foreground">—</span>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {site.siteWorkTypes.map((swt) => (
                    <Badge key={swt.id} variant="outline" className="text-xs">
                      {swt.workType.name}
                    </Badge>
                  ))}
                </div>
              )}
            </Field>

            <Field label="Supervisors">
              <SiteSupervisorList
                siteId={site.id}
                assignments={site.siteSupervisorAssignments}
              />
            </Field>
          </div>
        )}

        <DialogFooter className="flex-wrap gap-2 mt-2">
          {site && (
            <div className="flex flex-1 flex-wrap gap-2">
              <Link href={`/admin/sites/${site.id}/gallery`}>
                <Button variant="outline" size="sm">
                  <Images /> Gallery
                </Button>
              </Link>
              {site.status === 'active' ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { onAssign(); onOpenChange(false) }}
                  >
                    <UserPlus /> Assign
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { onEditWindows(); onOpenChange(false) }}
                  >
                    <Clock /> Edit Time Windows
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => { onDeactivate(); onOpenChange(false) }}
                  >
                    <Ban /> Deactivate
                  </Button>
                </>
              ) : (
                <Link href={`/admin/sites/${site.id}/snapshot`}>
                  <Button variant="outline" size="sm">
                    <Camera /> View Snapshot
                  </Button>
                </Link>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => { onDelete(); onOpenChange(false) }}
              >
                <Trash2 /> Delete
              </Button>
            </div>
          )}
          <DialogClose render={<Button variant="outline" size="sm" type="button" />}>Close</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
