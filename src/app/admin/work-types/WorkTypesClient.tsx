'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
} from '@tanstack/react-table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
  DialogClose,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { createWorkType, updateWorkType, deleteWorkType } from '@/actions/work-types'
import { Plus, Pencil, Trash2 } from 'lucide-react'

type WorkType = { id: string; name: string; createdAt: Date; siteCount: number }

const schema = z.object({ name: z.string().min(1, 'Name is required').max(100) })
type FormValues = z.infer<typeof schema>

const col = createColumnHelper<WorkType>()

export function WorkTypesClient({ workTypes }: { workTypes: WorkType[] }) {
  const router = useRouter()

  // Create
  const [createOpen, setCreateOpen] = useState(false)
  const [createError, setCreateError] = useState('')
  const [isCreating, startCreate] = useTransition()
  const createForm = useForm<FormValues>({ resolver: zodResolver(schema) })

  // Edit
  const [editTarget, setEditTarget] = useState<WorkType | null>(null)
  const [editError, setEditError] = useState('')
  const [isEditing, startEdit] = useTransition()
  const editForm = useForm<FormValues>({ resolver: zodResolver(schema) })

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<WorkType | null>(null)
  const [deleteError, setDeleteError] = useState('')
  const [isDeleting, startDelete] = useTransition()

  function onCreateSubmit(values: FormValues) {
    setCreateError('')
    startCreate(async () => {
      try {
        await createWorkType(values)
        createForm.reset()
        setCreateOpen(false)
        router.refresh()
      } catch (e) {
        setCreateError(e instanceof Error ? e.message : 'Something went wrong')
      }
    })
  }

  function openEdit(wt: WorkType) {
    setEditTarget(wt)
    editForm.setValue('name', wt.name)
    setEditError('')
  }

  function onEditSubmit(values: FormValues) {
    if (!editTarget) return
    setEditError('')
    startEdit(async () => {
      try {
        await updateWorkType(editTarget.id, values)
        setEditTarget(null)
        router.refresh()
      } catch (e) {
        setEditError(e instanceof Error ? e.message : 'Something went wrong')
      }
    })
  }

  function onDeleteConfirm() {
    if (!deleteTarget) return
    setDeleteError('')
    startDelete(async () => {
      try {
        await deleteWorkType(deleteTarget.id)
        setDeleteTarget(null)
        router.refresh()
      } catch (e) {
        setDeleteError(e instanceof Error ? e.message : 'Something went wrong')
      }
    })
  }

  const columns = [
    col.accessor('name', { header: 'Name' }),
    col.accessor('siteCount', {
      header: 'Associated Sites',
      cell: (info) => {
        const n = info.getValue()
        return n > 0 ? (
          <span className="text-sm">{n} site{n !== 1 ? 's' : ''}</span>
        ) : (
          <span className="text-muted-foreground text-sm">Not in use</span>
        )
      },
    }),
    col.display({
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex items-center gap-1 justify-end">
          <Button variant="ghost" size="sm" onClick={() => openEdit(row.original)}>
            <Pencil className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => { setDeleteTarget(row.original); setDeleteError('') }}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      ),
    }),
  ]

  const table = useReactTable({ data: workTypes, columns, getCoreRowModel: getCoreRowModel() })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Work Types</h1>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger render={<Button><Plus className="size-4" />Add Work Type</Button>} />
          <DialogContent>
            <DialogTitle>Add Work Type</DialogTitle>
            <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-4 mt-2">
              <div className="space-y-1.5">
                <Label htmlFor="wt-name">Name</Label>
                <Input id="wt-name" {...createForm.register('name')} placeholder="e.g. General Construction" />
                {createForm.formState.errors.name && (
                  <p className="text-xs text-destructive">{createForm.formState.errors.name.message}</p>
                )}
              </div>
              {createError && <p className="text-xs text-destructive">{createError}</p>}
              <DialogFooter>
                <DialogClose render={<Button variant="outline" type="button" />}>Cancel</DialogClose>
                <Button type="submit" disabled={isCreating}>{isCreating ? 'Saving…' : 'Save'}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {workTypes.length === 0 ? (
        <p className="text-muted-foreground text-sm">No work types yet. Add one to get started.</p>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((hg) => (
                <TableRow key={hg.id}>
                  {hg.headers.map((h) => (
                    <TableHead key={h.id}>{flexRender(h.column.columnDef.header, h.getContext())}</TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editTarget} onOpenChange={(o) => { if (!o) setEditTarget(null) }}>
        <DialogContent>
          <DialogTitle>Edit Work Type</DialogTitle>
          <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label htmlFor="wt-edit-name">Name</Label>
              <Input id="wt-edit-name" {...editForm.register('name')} />
              {editForm.formState.errors.name && (
                <p className="text-xs text-destructive">{editForm.formState.errors.name.message}</p>
              )}
            </div>
            {editError && <p className="text-xs text-destructive">{editError}</p>}
            <DialogFooter>
              <DialogClose render={<Button variant="outline" type="button" disabled={isEditing} />}>Cancel</DialogClose>
              <Button type="submit" disabled={isEditing}>{isEditing ? 'Saving…' : 'Save Changes'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null) }}>
        <DialogContent>
          <DialogTitle>Delete Work Type</DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Delete <span className="font-medium text-foreground">{deleteTarget?.name}</span>? This cannot be undone.
          </p>
          {deleteError && <p className="text-xs text-destructive mt-2">{deleteError}</p>}
          <DialogFooter className="mt-4">
            <DialogClose render={<Button variant="outline" type="button" disabled={isDeleting} />}>Cancel</DialogClose>
            <Button variant="destructive" onClick={onDeleteConfirm} disabled={isDeleting}>
              {isDeleting ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
