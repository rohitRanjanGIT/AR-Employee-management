import { cn } from '@/lib/utils'
import { avatarUrl } from '@/lib/cloudinary-url'

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/**
 * Circular avatar. Renders a Cloudinary photo (with avatar transform) when a url
 * is present, otherwise a neutral initials placeholder. Pass a raw stored
 * `secure_url` or an already-built preview URL via `src`.
 */
export function Avatar({
  src,
  name,
  size = 40,
  transform = true,
  className,
}: {
  src?: string | null
  name: string
  size?: number
  /** Apply the Cloudinary avatar transform to `src`. Set false for blob previews. */
  transform?: boolean
  className?: string
}) {
  const resolved = transform ? avatarUrl(src, Math.max(size * 2, 200)) : src
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-muted-foreground font-medium select-none',
        className
      )}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}
    >
      {resolved ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={resolved} alt={name} width={size} height={size} className="size-full object-cover" />
      ) : (
        <span>{initials(name)}</span>
      )}
    </span>
  )
}
