export default function Loading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-7 w-48 bg-muted rounded" />
      <div className="h-10 w-full bg-muted rounded" />
      <div className="flex gap-2">
        <div className="h-9 w-28 bg-muted rounded" />
        <div className="h-9 w-28 bg-muted rounded" />
      </div>
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-14 bg-muted rounded" />
        ))}
      </div>
    </div>
  )
}
