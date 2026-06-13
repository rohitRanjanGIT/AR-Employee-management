export default function Loading() {
  return (
    <div className="space-y-4">
      <div className="h-7 w-40 bg-muted rounded animate-pulse" />
      <div className="flex gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-9 w-32 bg-muted rounded-lg animate-pulse" />
        ))}
      </div>
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />
        ))}
      </div>
    </div>
  )
}
