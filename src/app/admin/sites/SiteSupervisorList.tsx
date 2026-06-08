'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { revokeSupervisorFromSite } from '@/actions/sites'

type Assignment = {
  id: string
  siteId: string
  employeeId: string
  employee: { id: string; name: string; phone: string | null }
}

export function SiteSupervisorList({
  siteId,
  assignments,
}: {
  siteId: string
  assignments: Assignment[]
}) {
  const router = useRouter()

  if (assignments.length === 0) {
    return <span className="text-xs text-muted-foreground">No supervisors assigned</span>
  }

  return (
    <div className="flex flex-wrap gap-1">
      {assignments.map((a) => (
        <SupervisorChip key={a.id} siteId={siteId} assignment={a} onRevoked={() => router.refresh()} />
      ))}
    </div>
  )
}

function SupervisorChip({
  siteId,
  assignment,
  onRevoked,
}: {
  siteId: string
  assignment: Assignment
  onRevoked: () => void
}) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleRevoke() {
    startTransition(async () => {
      await revokeSupervisorFromSite(siteId, assignment.employeeId)
      setOpen(false)
      onRevoked()
    })
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        nativeButton={false}
        render={
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium cursor-pointer" />
        }
      >
        {assignment.employee.name}
        <X className="size-3 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent className="w-56">
        <p className="text-sm font-medium mb-1">Remove supervisor?</p>
        <p className="text-xs text-muted-foreground mb-3">
          Revoke {assignment.employee.name} from this site?
        </p>
        <div className="flex gap-2 justify-end">
          <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button variant="destructive" size="sm" disabled={isPending} onClick={handleRevoke}>
            {isPending ? 'Removing…' : 'Remove'}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
