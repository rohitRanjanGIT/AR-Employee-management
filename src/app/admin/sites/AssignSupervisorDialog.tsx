'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogClose,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select'
import { assignSupervisorToSite } from '@/actions/sites'

type Site = { id: string; name: string; siteSupervisorAssignments: { employeeId: string }[] }
type SupervisorEmployee = {
  employee: { id: string; name: string }
  userName: string
  userEmail: string
}

export function AssignSupervisorDialog({
  site,
  supervisors,
  open,
  onOpenChange,
}: {
  site: Site | null
  supervisors: SupervisorEmployee[]
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const [selectedId, setSelectedId] = useState('')
  const [selectedName, setSelectedName] = useState('')
  const [serverError, setServerError] = useState('')
  const [isPending, startTransition] = useTransition()

  const alreadyAssigned = site?.siteSupervisorAssignments.map((a) => a.employeeId) ?? []
  const available = supervisors.filter((s) => !alreadyAssigned.includes(s.employee.id))

  function handleAssign() {
    if (!site || !selectedId) return
    setServerError('')
    startTransition(async () => {
      try {
        await assignSupervisorToSite(site.id, selectedId)
        setSelectedId('')
        setSelectedName('')
        onOpenChange(false)
        router.refresh()
      } catch (e) {
        setServerError(e instanceof Error ? e.message : 'Something went wrong')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setSelectedId(''); setServerError('') } onOpenChange(o) }}>
      <DialogContent>
        <DialogTitle>Assign Supervisor</DialogTitle>
        {site && <p className="text-xs text-muted-foreground mt-1">Site: {site.name}</p>}
        <div className="mt-2 space-y-3">
          {available.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              All available supervisors are already assigned to this site.
            </p>
          ) : (
            <Select value={selectedId} onValueChange={(v) => { const id = v ?? ''; setSelectedId(id); setSelectedName(available.find(s => s.employee.id === id)?.employee.name ?? '') }}>
              <SelectTrigger className="w-full">
                <span className={selectedName ? 'text-foreground' : 'text-muted-foreground'}>
                  {selectedName || 'Select a supervisor'}
                </span>
              </SelectTrigger>
              <SelectContent>
                {available.map((s) => (
                  <SelectItem key={s.employee.id} value={s.employee.id}>
                    {s.employee.name || s.userName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {serverError && <p className="text-xs text-destructive">{serverError}</p>}
        </div>
        <DialogFooter className="mt-2">
          <DialogClose render={<Button variant="outline" disabled={isPending} />}>Cancel</DialogClose>
          <Button disabled={isPending || !selectedId || available.length === 0} onClick={handleAssign}>
            {isPending ? 'Assigning…' : 'Assign'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
