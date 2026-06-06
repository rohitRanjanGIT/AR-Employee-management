'use client'

import { useState, useTransition, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { revealAadhaar } from '@/actions/workers'

function formatAadhaar(raw: string) {
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8)}`
}

export function AadhaarRevealButton({
  workerId,
  maskedDisplay,
}: {
  workerId: string
  maskedDisplay: string | null
}) {
  const [revealed, setRevealed] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  if (!maskedDisplay) {
    return <span className="text-muted-foreground text-xs">Not provided</span>
  }

  function handleReveal() {
    setError('')
    startTransition(async () => {
      try {
        const full = await revealAadhaar(workerId)
        setRevealed(formatAadhaar(full))
        if (timerRef.current) clearTimeout(timerRef.current)
        timerRef.current = setTimeout(() => setRevealed(null), 30_000)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to reveal')
      }
    })
  }

  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-sm">{revealed ?? maskedDisplay}</span>
      {!revealed && (
        <Button
          variant="outline"
          size="sm"
          disabled={isPending}
          onClick={handleReveal}
          title="This reveal is being logged"
          className="h-6 px-2 text-xs"
        >
          {isPending ? '…' : 'Reveal'}
        </Button>
      )}
      {revealed && (
        <span className="text-xs text-muted-foreground">auto-hides in 30s</span>
      )}
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  )
}
