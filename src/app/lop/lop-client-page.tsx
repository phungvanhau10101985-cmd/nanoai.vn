'use client'

import Link from 'next/link'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import { cn } from '@/lib/utils'

export type ClassItem = {
  id: string
  name: string
  join_code: string
  grade_level_id?: string | null
  subject_label?: string | null
  teacher_display_name?: string | null
    schools?: { name?: string | null } | Array<{ name?: string | null }> | null
    classKind?: 'school' | 'tutoring'
}

function readSchoolName(item: ClassItem): string {
  const raw = Array.isArray(item.schools) ? item.schools[0]?.name : item.schools?.name
  return String(raw ?? '').trim()
}

function studentClassContextLine(c: ClassItem): string {
  const parts = [c.name.trim()].filter(Boolean)
  const sub = String(c.subject_label ?? '').trim()
  const te = String(c.teacher_display_name ?? '').trim()
  if (sub) parts.push(sub)
  if (te) parts.push(te)
  return parts.join(' — ')
}

export default function LopClientPage({
  myClasses,
  memberClasses,
  t,
  lockedClassIds = [],
  unpaidByClassId = {},
}: {
  myClasses: ClassItem[]
  memberClasses: ClassItem[]
  t: Dictionary['classes']
  lockedClassIds?: string[]
  unpaidByClassId?: Record<string, number>
}) {

  const allClasses = [
    ...myClasses.map((c) => ({ ...c, isTeacher: true })),
    ...memberClasses
      .filter((c) => !myClasses.some((m) => m.id === c.id))
      .map((c) => ({ ...c, isTeacher: false })),
  ]

  if (allClasses.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-muted-foreground/25 p-12 text-center text-muted-foreground">
        <p className="text-base">{t.noClasses}</p>
        <p className="text-sm mt-2">
          {t.createClassForTeacher} · {t.joinClassForStudent}
        </p>
      </div>
    )
  }

  const locked = new Set(lockedClassIds)
  return (
    <ul className="space-y-3">
      {allClasses.map((c) => {
        const viewOnly = c.isTeacher && locked.has(c.id)
        const cardClass = 'block rounded-xl border border-input bg-card p-4'
        const body = (
          <>
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-foreground leading-snug min-w-0">
                {!c.isTeacher && (c.subject_label?.trim() || c.teacher_display_name?.trim())
                  ? studentClassContextLine(c)
                  : c.name}
              </span>
              <span
                className={cn(
                  'shrink-0 rounded-md border px-2 py-0.5 text-xs font-medium',
                  c.isTeacher
                    ? 'border-sky-500/35 bg-sky-500/10 text-sky-900 dark:border-sky-400/30 dark:bg-sky-950/40 dark:text-sky-100'
                    : 'border-emerald-500/35 bg-emerald-500/10 text-emerald-900 dark:border-emerald-400/30 dark:bg-emerald-950/40 dark:text-emerald-100'
                )}
              >
                {c.isTeacher ? t.memberRoleTeacher : t.memberRoleStudent}
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {t.joinCode}: {c.join_code}
            </p>
            {(c.classKind === 'tutoring' || readSchoolName(c) || c.grade_level_id) && (
              <p className="text-xs text-muted-foreground mt-1">
                {c.classKind === 'tutoring'
                  ? t.classKindTutoringBadge
                  : readSchoolName(c)
                    ? `${t.schoolLabel}: ${readSchoolName(c)}`
                    : `${t.schoolLabel}: —`}
                {c.classKind !== 'tutoring' && c.grade_level_id ? ` • ${t.gradeLevelLabel}: ${c.grade_level_id}` : ''}
              </p>
            )}
            {c.isTeacher && c.classKind === 'tutoring' && (unpaidByClassId[c.id] ?? 0) > 0 ? (
              <p className="text-xs text-foreground mt-1">
                {t.tutoringUnpaidStudents.replaceAll('{count}', String(unpaidByClassId[c.id]))}
              </p>
            ) : null}
          </>
        )
        return (
          <li key={c.id}>
            {viewOnly ? (
              <div className={cardClass}>{body}</div>
            ) : (
              <Link href={`/lop/${c.id}`} className={`${cardClass} transition-colors hover:bg-accent/50`}>
                {body}
              </Link>
            )}
          </li>
        )
      })}
    </ul>
  )
}
