'use client'

import { ChevronRight } from 'lucide-react'
import Link from 'next/link'

export function SubjectUnreadCount({ count, label }: { count: number; label: string }) {
  if (count <= 0) return null
  return (
    <span
      className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-semibold leading-none text-white tabular-nums"
      aria-label={label}
    >
      {count > 99 ? '99+' : count}
    </span>
  )
}

export function SubjectNewTag({ label }: { label: string }) {
  return (
    <span className="inline-flex shrink-0 items-center rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
      {label}
    </span>
  )
}

export function subjectUnreadRowClass(unopened: boolean): string | undefined {
  return unopened ? 'bg-red-500/[0.07]' : undefined
}

export function SubjectSectionLink({
  href,
  label,
  count,
  unreadLabel,
}: {
  href: string
  label: string
  count: number
  unreadLabel: string
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-2 rounded-lg border border-border/70 bg-background px-3 py-3 text-sm hover:bg-muted/40"
    >
      <span className="flex min-w-0 items-center gap-2 font-medium text-foreground">
        <span className="truncate">{label}</span>
        <SubjectUnreadCount count={count} label={unreadLabel} />
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
    </Link>
  )
}
