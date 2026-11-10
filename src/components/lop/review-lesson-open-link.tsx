'use client'

import Link from 'next/link'
import { SubjectNewTag, subjectUnreadRowClass } from '@/components/lop/subject-item-unread'
import { markSubjectItemOpened, type SubjectItemOpenBody } from '@/lib/lop/subject-item-open'

export function ReviewLessonRow({
  href,
  title,
  openLabel,
  newLabel,
  unopened,
  mark,
}: {
  href: string
  title: string
  openLabel: string
  newLabel: string
  unopened: boolean
  mark: SubjectItemOpenBody | null
}) {
  return (
    <li className={`flex items-center gap-3 px-4 py-3 ${subjectUnreadRowClass(unopened) ?? ''}`}>
      <div className="min-w-0 flex-1">
        <p className={`flex items-center gap-2 text-sm text-foreground ${unopened ? 'font-semibold' : 'font-medium'}`}>
          <span className="truncate">{title}</span>
          {unopened ? <SubjectNewTag label={newLabel} /> : null}
        </p>
      </div>
      <Link
        href={href}
        className="shrink-0 rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted/40"
        onClick={() => {
          if (mark) markSubjectItemOpened(mark)
        }}
      >
        {openLabel}
      </Link>
    </li>
  )
}
