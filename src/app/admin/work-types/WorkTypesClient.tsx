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
import { createWorkType } from '@/actions/work-types'
import { Plus } from 'lucide-react'

type WorkType = { id: string; name: string; createdAt: Date }

const schema = z.object({ name: z.string().min(1, 'Name is required').max(100) })
type FormValues = z.infer<typeof schema>

const col = createColumnHelper<WorkType>()
const columns = [
  col.accessor('name', { header: 'Name' }),
  col.accessor('createdAt', {
    header: 'Created At',
    cell: (info) => new Date(info.getValue()).toLocaleDateString(),
  }),
]

export function WorkTypesClient({ workTypes }: { workTypes: WorkType[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [serverError, setServerError] = useState('')
  const [isPending, startTransition] = useTransition()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const table = useReactTable({ data: workTypes, columns, getCoreRowModel: getCoreRowModel() })

  function onSubmit(values: FormValues) {
    setServerError('')
    startTransition(async () => {
      try {
        await createWorkType(values)
        reset()
        setOpen(false)
        router.refresh()
      } catch (e) {
        setServerError(e instanceof Error ? e.message : 'Something went wrong')
      }
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Work Types</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button><Plus className="size-4" />Add Work Type</Button>} />
          <DialogContent>
            <DialogTitle>Add Work Type</DialogTitle>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
              <div className="space-y-1.5">
                <Label htmlFor="wt-name">Name</Label>
                <Input id="wt-name" {...register('name')} placeholder="e.g. General Construction" />
                {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
              </div>
              {serverError && <p className="text-xs text-destructive">{serverError}</p>}
              <DialogFooter>
                <DialogClose render={<Button variant="outline" type="button" />}>Cancel</DialogClose>
                <Button type="submit" disabled={isPending}>
                  {isPending ? 'Saving…' : 'Save'}
                </Button>
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
    </div>
  )
}
