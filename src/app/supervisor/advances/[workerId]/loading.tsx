export default function Loading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-4 w-32 bg-muted rounded" />
      <div className="flex items-center justify-between">
        <div className="h-7 w-40 bg-muted rounded" />
        <div className="h-9 w-32 bg-muted rounded" />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="h-24 bg-muted rounded-xl" />
        <div className="h-24 bg-muted rounded-xl" />
        <div className="h-24 bg-muted rounded-xl" />
      </div>
      <div className="h-64 bg-muted rounded-lg" />
    </div>
  )
}
