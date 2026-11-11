'use client'

import type { ReactNode } from 'react'
import { Loader2 } from 'lucide-react'

export function ProcessingIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return <Loader2 className={`${className} shrink-0 animate-spin`} aria-hidden="true" />
}

export function processingLabel(text: string) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <ProcessingIcon />
      {text}
    </span>
  )
}

export function ProcessingRow({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <p className={`flex min-w-0 items-center gap-2 ${className}`}>
      <span className="min-w-0 flex-1">{children}</span>
      <ProcessingIcon />
    </p>
  )
}
