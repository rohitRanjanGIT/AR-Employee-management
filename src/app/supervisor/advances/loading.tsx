export default function Loading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-7 w-32 bg-muted rounded" />
        <div className="h-9 w-40 bg-muted rounded" />
      </div>
      <div className="h-4 w-2/3 bg-muted rounded" />
      <div className="h-64 bg-muted rounded-lg" />
    </div>
  )
}
