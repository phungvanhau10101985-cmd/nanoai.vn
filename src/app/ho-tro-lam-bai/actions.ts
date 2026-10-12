'use server'

import { getUserForAction } from '@/lib/auth'
import { normalizeWebLocale, type WebLocale } from '@/lib/i18n/config'
import {
  explainHomeworkImages,
  reviewHomeworkAttempt,
  type HomeworkHelpErrorCode,
} from '@/lib/homework-help/homework-help-ai'
import type { HomeworkGuide, HomeworkReview } from '@/lib/homework-help/homework-help-guide'

const MAX_IMAGES = 3
const MAX_BYTES = 6 * 1024 * 1024
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp'])

export type HomeworkHelpActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: HomeworkHelpErrorCode }

function localeFrom(value: FormDataEntryValue | null): WebLocale {
  return normalizeWebLocale(String(value ?? '')) ?? 'vi'
}

export async function explainHomeworkPhoto(
  formData: FormData
): Promise<HomeworkHelpActionResult<HomeworkGuide>> {
  const auth = await getUserForAction()
  if ('error' in auth) return { ok: false, code: 'unauthorized' }

  const files = formData
    .getAll('images')
    .filter((item): item is File => item instanceof File && item.size > 0)
  if (!files.length) return { ok: false, code: 'missing_image' }
  if (files.length > MAX_IMAGES) return { ok: false, code: 'too_many' }

  const images: { mimeType: string; base64: string }[] = []
  for (const file of files) {
    if (file.size > MAX_BYTES) return { ok: false, code: 'too_large' }
    const mimeType = file.type || 'image/jpeg'
    if (!ALLOWED.has(mimeType)) return { ok: false, code: 'bad_type' }
    const base64 = Buffer.from(await file.arrayBuffer()).toString('base64')
    images.push({ mimeType, base64 })
  }

  const guide = await explainHomeworkImages({
    userId: auth.user.id,
    locale: localeFrom(formData.get('locale')),
    images,
  })
  if (!guide) return { ok: false, code: 'unreadable' }
  return { ok: true, data: guide }
}

export async function reviewHomeworkWork(input: {
  locale: string
  statement: string
  attempt: string
}): Promise<HomeworkHelpActionResult<HomeworkReview>> {
  const auth = await getUserForAction()
  if ('error' in auth) return { ok: false, code: 'unauthorized' }
  const statement = input.statement.trim()
  const attempt = input.attempt.trim()
  if (!statement || !attempt) return { ok: false, code: 'missing_attempt' }
  const locale = normalizeWebLocale(input.locale) ?? 'vi'
  const review = await reviewHomeworkAttempt({
    userId: auth.user.id,
    locale,
    statement: statement.slice(0, 1200),
    attempt: attempt.slice(0, 2000),
  })
  if (!review) return { ok: false, code: 'ai_unavailable' }
  return { ok: true, data: review }
}
