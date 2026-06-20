export default function Loading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-7 w-28 bg-muted rounded" />
      <div className="flex flex-wrap gap-2">
        <div className="h-8 w-36 bg-muted rounded-lg" />
        <div className="h-8 w-40 bg-muted rounded-lg" />
        <div className="h-8 w-36 bg-muted rounded-lg" />
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="aspect-square bg-muted rounded-lg" />
        ))}
      </div>
    </div>
  )
}
