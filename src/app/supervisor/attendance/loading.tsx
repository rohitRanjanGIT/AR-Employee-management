export default function Loading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-7 w-32 bg-muted rounded" />
      <div className="h-5 w-56 bg-muted rounded" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-28 bg-muted rounded-lg" />
        ))}
      </div>
    </div>
  )
}
