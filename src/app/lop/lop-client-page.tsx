'use client'

import Link from 'next/link'
import type { Dictionary } from '@/lib/i18n/dictionaries'

export type ClassItem = {
  id: string
  name: string
  join_code: string
  grade_level_id?: string | null
  subject_label?: string | null
  teacher_display_name?: string | null
  schools?: { name?: string | null } | Array<{ name?: string | null }> | null
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
}: {
  myClasses: ClassItem[]
  memberClasses: ClassItem[]
  t: Dictionary['classes']
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
          {t.createClass} hoặc {t.joinClass}
        </p>
      </div>
    )
  }

  return (
    <ul className="space-y-3">
      {allClasses.map((c) => (
        <li key={c.id}>
          <Link
            href={`/lop/${c.id}`}
            className="block rounded-xl border border-input bg-card p-4 hover:bg-accent/50 transition-colors"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-foreground leading-snug">
                {!c.isTeacher && (c.subject_label?.trim() || c.teacher_display_name?.trim())
                  ? studentClassContextLine(c)
                  : c.name}
              </span>
              {c.isTeacher && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary shrink-0">
                  GV
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {t.joinCode}: {c.join_code}
            </p>
            {(readSchoolName(c) || c.grade_level_id) && (
              <p className="text-xs text-muted-foreground mt-1">
                {readSchoolName(c) ? `${t.schoolLabel}: ${readSchoolName(c)}` : `${t.schoolLabel}: —`}
                {c.grade_level_id ? ` • ${t.gradeLevelLabel}: ${c.grade_level_id}` : ''}
              </p>
            )}
          </Link>
        </li>
      ))}
    </ul>
  )
}
