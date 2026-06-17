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
import { AadhaarRevealButton } from './AadhaarRevealButton'
import { Avatar } from '@/components/Avatar'
import { computeAge } from '@/lib/age'
import { formatDate } from '@/lib/utils'

type Worker = {
  id: string
  name: string
  category: 'skilled' | 'semi_skilled' | 'helper'
  wageDaily: string
  otRate2hr: string | null
  otRate4hr: string | null
  otRate6hr: string | null
  aadhaarLastFour: string | null
  aadhaarDisplay: string | null
  status: 'pending' | 'active' | 'rejected' | 'archived'
  rejectionReason: string | null
  resubmitted: boolean
  cityId: string
  dateOfBirth: string | null
  phone: string | null
  address: string | null
  joinDate: Date | null
  emergencyContact: string | null
  accountNumber: string | null
  ifscCode: string | null
  photoCloudinaryUrl: string | null
  photoCloudinaryPublicId: string | null
  city: { id: string; name: string }
  submittedBy: string | null
  submittedByEmployee: { id: string; name: string } | null
  createdAt: Date
}

const CATEGORY_LABELS: Record<string, string> = {
  skilled: 'Skilled',
  semi_skilled: 'Semi-Skilled',
  helper: 'Helper',
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm">{value ?? <span className="text-muted-foreground">—</span>}</span>
    </div>
  )
}

function fmt(v: string | null) {
  if (!v) return null
  return `₹${Number(v).toLocaleString('en-IN')}`
}

function StatusBadge({ status }: { status: Worker['status'] }) {
  if (status === 'active') return <Badge variant="default">Active</Badge>
  if (status === 'pending') return <Badge variant="outline">Pending</Badge>
  if (status === 'archived') return <Badge variant="secondary">Archived</Badge>
  return <Badge variant="destructive">Rejected</Badge>
}

export function WorkerDetailDialog({
  worker,
  open,
  onOpenChange,
  onApprove,
  onReject,
  onEdit,
  onDelete,
  onArchive,
  onRestore,
}: {
  worker: Worker | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onApprove: (w: Worker) => void
  onReject: (w: Worker) => void
  onEdit: (w: Worker) => void
  onDelete: (w: Worker) => void
  onArchive: (w: Worker) => void
  onRestore: (w: Worker) => void
}) {
  if (!worker) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-2 pr-6">
          <div className="flex items-center gap-3">
            <Avatar src={worker.photoCloudinaryUrl} name={worker.name} size={48} />
            <DialogTitle className="text-lg">{worker.name}</DialogTitle>
          </div>
          <StatusBadge status={worker.status} />
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-3 mt-2">
          <Row label="Category" value={CATEGORY_LABELS[worker.category]} />
          <Row label="City" value={worker.city.name} />
          <Row label="Date of Birth" value={worker.dateOfBirth ? formatDate(worker.dateOfBirth) : null} />
          <Row label="Age" value={computeAge(worker.dateOfBirth)} />
          <Row label="Phone" value={worker.phone} />
          <Row label="Emergency Contact" value={worker.emergencyContact} />
          <Row
            label="Submitted By"
            value={worker.submittedByEmployee?.name ?? 'Admin'}
          />
          {worker.resubmitted && (
            <div className="col-span-2">
              <span className="text-xs bg-muted px-2 py-0.5 rounded text-muted-foreground">
                Resubmitted
              </span>
            </div>
          )}
        </div>

        <div className="border-t pt-3 mt-1 grid grid-cols-2 gap-x-6 gap-y-3">
          <Row label="Daily Wage" value={fmt(worker.wageDaily)} />
          <div />
          <Row label="OT Rate (2 hrs)" value={fmt(worker.otRate2hr)} />
          <Row label="OT Rate (4 hrs)" value={fmt(worker.otRate4hr)} />
          <Row label="OT Rate (6 hrs)" value={fmt(worker.otRate6hr)} />
        </div>

        <div className="border-t pt-3 mt-1 grid grid-cols-2 gap-x-6 gap-y-3">
          <Row label="Account Number" value={worker.accountNumber} />
          <Row label="IFSC Code" value={worker.ifscCode} />
        </div>

        <div className="border-t pt-3 mt-1">
          <span className="text-xs text-muted-foreground">Aadhaar</span>
          <div className="mt-1">
            <AadhaarRevealButton workerId={worker.id} maskedDisplay={worker.aadhaarDisplay} />
          </div>
        </div>

        {worker.status === 'rejected' && worker.rejectionReason && (
          <div className="border-t pt-3 mt-1">
            <span className="text-xs text-muted-foreground">Rejection Reason</span>
            <p className="text-sm text-destructive mt-1">{worker.rejectionReason}</p>
          </div>
        )}

        <DialogFooter className="flex-wrap gap-2 mt-2">
          <div className="flex gap-2 flex-1 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => { onEdit(worker); onOpenChange(false) }}
            >
              Edit
            </Button>
            {worker.status === 'active' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => { onArchive(worker); onOpenChange(false) }}
              >
                Archive
              </Button>
            )}
            {worker.status === 'archived' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => { onRestore(worker); onOpenChange(false) }}
              >
                Restore
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => { onDelete(worker); onOpenChange(false) }}
            >
              Delete
            </Button>
          </div>
          {worker.status === 'pending' && (
            <div className="flex gap-2">
              <Button
                variant="destructive"
                size="sm"
                onClick={() => { onReject(worker); onOpenChange(false) }}
              >
                Reject
              </Button>
              <Button
                size="sm"
                onClick={() => { onApprove(worker); onOpenChange(false) }}
              >
                Approve
              </Button>
            </div>
          )}
          <DialogClose render={<Button variant="outline" size="sm" type="button" />}>
            Close
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
