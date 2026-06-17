import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format } from 'date-fns'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formats a date as DD/MM/YYYY (day/month/year) — the site-wide calendar format.
 * Accepts a Date or a string; bare 'YYYY-MM-DD' strings are treated as local dates.
 */
export function formatDate(value: string | Date): string {
  const d =
    typeof value === 'string'
      ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value)
      : value
  return format(d, 'dd/MM/yyyy')
}

/**
 * Formats a timestamp as DD/MM/YYYY, HH:mm (day/month/year + 24h time).
 */
export function formatDateTime(value: string | Date): string {
  const d = typeof value === 'string' ? new Date(value) : value
  return format(d, 'dd/MM/yyyy, HH:mm')
}
