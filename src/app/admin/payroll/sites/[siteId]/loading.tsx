export default function Loading() {
  return (
    <div className="space-y-4">
      <div className="h-4 w-28 bg-muted rounded animate-pulse" />
      <div className="flex items-start justify-between">
        <div className="h-7 w-48 bg-muted rounded animate-pulse" />
        <div className="h-8 w-32 bg-muted rounded animate-pulse" />
      </div>
      <div className="h-64 bg-muted rounded-lg animate-pulse" />
    </div>
  )
}
