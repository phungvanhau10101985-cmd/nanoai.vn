'use client'

import { useState } from 'react'
import { SubjectNewTag, subjectUnreadRowClass } from '@/components/lop/subject-item-unread'
import { cn } from '@/lib/utils'
import {
  isScoreRowUnopened,
  markSubjectItemOpened,
  subjectItemKey,
} from '@/lib/lop/subject-item-open'

export type StudentScoreListRow = {
  id: string
  title: string
  kindLabel: string
  status: string
  createdAt: string | null
  submittedAt: string | null
}

export function StudentSubjectScoreList({
  classId,
  subjectId,
  teacherId,
  newLabel,
  openedAtByKey,
  rows,
}: {
  classId: string
  subjectId: string
  teacherId: string
  newLabel: string
  openedAtByKey: Record<string, string>
  rows: StudentScoreListRow[]
}) {
  const [opened, setOpened] = useState(openedAtByKey)

  function openRow(row: StudentScoreListRow) {
    const key = subjectItemKey('score', row.id)
    setOpened((prev) => ({ ...prev, [key]: new Date().toISOString() }))
    markSubjectItemOpened({
      classId,
      subjectId,
      teacherId,
      kind: 'score',
      itemId: row.id,
    })
  }

  return (
    <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
      {rows.map((row) => {
        const unseen = isScoreRowUnopened(
          opened[subjectItemKey('score', row.id)],
          row.createdAt,
          row.submittedAt
        )
        const body = (
          <>
            <div className="min-w-0 text-left">
              <p className={cn('flex items-center gap-2 text-sm text-foreground', unseen ? 'font-semibold' : 'font-medium')}>
                <span className="truncate">{row.title}</span>
                {unseen ? <SubjectNewTag label={newLabel} /> : null}
              </p>
              <p className="text-xs text-muted-foreground">{row.kindLabel}</p>
            </div>
            <span className="shrink-0 text-sm font-medium tabular-nums text-foreground">{row.status}</span>
          </>
        )
        return (
          <li key={row.id} className={subjectUnreadRowClass(unseen)}>
            {unseen ? (
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-red-500/[0.04]"
                onClick={() => openRow(row)}
              >
                {body}
              </button>
            ) : (
              <div className="flex items-center justify-between gap-3 px-4 py-3">{body}</div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
