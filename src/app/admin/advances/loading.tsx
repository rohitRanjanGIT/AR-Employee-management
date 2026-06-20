export default function Loading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-7 w-32 bg-muted rounded" />
        <div className="h-9 w-36 bg-muted rounded" />
      </div>
      <div className="flex gap-1 border-b pb-0">
        <div className="h-9 w-24 bg-muted rounded-t" />
        <div className="h-9 w-24 bg-muted rounded-t" />
        <div className="h-9 w-24 bg-muted rounded-t" />
      </div>
      <div className="h-64 bg-muted rounded-lg" />
    </div>
  )
}
