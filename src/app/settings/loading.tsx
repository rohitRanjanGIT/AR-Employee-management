export default function Loading() {
  return (
    <div className="mx-auto max-w-4xl space-y-6 animate-pulse">
      <div className="h-7 w-40 bg-muted rounded" />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="h-72 bg-muted rounded-lg" />
        <div className="h-72 bg-muted rounded-lg" />
      </div>
    </div>
  )
}
