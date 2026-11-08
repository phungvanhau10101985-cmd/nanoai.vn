import type { WebLocale } from '@/lib/i18n/config'

export type TeacherGender = 'male' | 'female'

const TITLE: Record<WebLocale, Record<TeacherGender, { before: string; after: string }>> = {
  vi: { male: { before: 'Thầy ', after: '' }, female: { before: 'Cô ', after: '' } },
  en: { male: { before: 'Mr. ', after: '' }, female: { before: 'Ms. ', after: '' } },
  zh: { male: { before: '', after: '老师' }, female: { before: '', after: '老师' } },
  ja: { male: { before: '', after: '先生' }, female: { before: '', after: '先生' } },
  ko: { male: { before: '', after: ' 선생님' }, female: { before: '', after: ' 선생님' } },
}

/** Bỏ Thầy/Cô (và danh xưng tương đương) để tên tài khoản chỉ còn họ tên. */
export function stripTeacherHonorific(raw: string): string {
  let name = raw.replace(/\s+/g, ' ').trim()
  for (let i = 0; i < 2; i++) {
    const next = name
      .replace(/^(thầy|thay|cô|co|mr\.?|ms\.?|mrs\.?|老师|先生|선생님)\s+/i, '')
      .replace(/\s*(老师|先生|선생님)\s*$/i, '')
      .trim()
    if (next === name) break
    name = next
  }
  return name
}

export function parseTeacherGender(raw: string | null | undefined): TeacherGender | null {
  const g = String(raw ?? '').trim().toLowerCase()
  if (g === 'male' || g === 'female') return g
  return null
}

/** Null khi thiếu họ tên hoặc giới tính. */
export function formatTeacherPublicName(
  fullName: string | null | undefined,
  gender: string | null | undefined,
  locale: WebLocale = 'vi'
): string | null {
  const given = stripTeacherHonorific(String(fullName ?? ''))
  const parsed = parseTeacherGender(gender)
  if (!given || !parsed) return null
  const title = TITLE[locale]?.[parsed] ?? TITLE.vi[parsed]
  return `${title.before}${given}${title.after}`.replace(/\s+/g, ' ').trim()
}
