'use server'

import { getUserForAction } from '@/lib/auth'
import { normalizeWebLocale, type WebLocale } from '@/lib/i18n/config'
import { beginFeatureTrial } from '@/lib/feature-trial-start'
import { hasStudentStudyAccess } from '@/lib/student-study-access'
import { resolveSharedTutorTopic } from '@/lib/ai-tutor/ai-tutor-ai'
import type { TutorAnswer } from '@/lib/ai-tutor/ai-tutor-types'
import {
  explainHomeworkImages,
  explainHomeworkText,
  reviewHomeworkAttempt,
  type HomeworkHelpErrorCode,
} from '@/lib/homework-help/homework-help-ai'
import type { HomeworkGuide, HomeworkReview } from '@/lib/homework-help/homework-help-guide'
import {
  appendHomeworkExchange,
  ensureHomeworkSession,
  listHomeworkMessages,
  listHomeworkSessions,
  openHomeworkSession,
  startHomeworkSession,
} from '@/lib/homework-help/homework-help-store'
import type { HomeworkSessionSummary, HomeworkThreadMessage } from '@/lib/homework-help/homework-help-thread'

const MAX_IMAGES = 3
const MAX_BYTES = 6 * 1024 * 1024
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp'])

export type HomeworkHelpActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: HomeworkHelpErrorCode }

function localeFrom(value: FormDataEntryValue | null): WebLocale {
  return normalizeWebLocale(String(value ?? '')) ?? 'vi'
}

function localeOf(value: string): WebLocale {
  return normalizeWebLocale(value) ?? 'vi'
}

async function rememberTurn(input: {
  userId: string
  locale: WebLocale
  text: string
  imageCount: number
  guide: HomeworkGuide
}): Promise<void> {
  const sessionId = await ensureHomeworkSession(input.userId, input.locale)
  if (!sessionId) return
  await appendHomeworkExchange({
    sessionId,
    userId: input.userId,
    text: input.text,
    imageCount: input.imageCount,
    guide: input.guide,
  })
}

export async function loadHomeworkThread(
  locale: string
): Promise<HomeworkHelpActionResult<{ sessionId: string | null; messages: HomeworkThreadMessage[] }>> {
  const auth = await getUserForAction()
  if ('error' in auth) return { ok: false, code: 'unauthorized' }
  if (!(await hasStudentStudyAccess({ userId: auth.user.id }))) {
    return { ok: false, code: 'payment_required' }
  }
  const sessionId = await ensureHomeworkSession(auth.user.id, localeOf(locale))
  if (!sessionId) return { ok: true, data: { sessionId: null, messages: [] } }
  return { ok: true, data: { sessionId, messages: await listHomeworkMessages(sessionId) } }
}

export async function startHomeworkThread(locale: string): Promise<HomeworkHelpActionResult<{ sessionId: string | null }>> {
  const auth = await getUserForAction()
  if ('error' in auth) return { ok: false, code: 'unauthorized' }
  if (!(await hasStudentStudyAccess({ userId: auth.user.id }))) {
    return { ok: false, code: 'payment_required' }
  }
  const sessionId = await startHomeworkSession(auth.user.id, localeOf(locale))
  if (!sessionId) return { ok: false, code: 'new_thread_failed' }
  return { ok: true, data: { sessionId } }
}

export async function listHomeworkHistory(): Promise<HomeworkHelpActionResult<HomeworkSessionSummary[]>> {
  const auth = await getUserForAction()
  if ('error' in auth) return { ok: false, code: 'unauthorized' }
  return { ok: true, data: await listHomeworkSessions(auth.user.id) }
}

export async function openHomeworkHistoryThread(
  sessionId: string
): Promise<HomeworkHelpActionResult<{ sessionId: string; messages: HomeworkThreadMessage[] }>> {
  const auth = await getUserForAction()
  if ('error' in auth) return { ok: false, code: 'unauthorized' }
  const messages = await openHomeworkSession(auth.user.id, sessionId)
  if (!messages) return { ok: false, code: 'ai_unavailable' }
  return { ok: true, data: { sessionId, messages } }
}

export async function explainHomeworkPhoto(
  formData: FormData
): Promise<HomeworkHelpActionResult<HomeworkGuide>> {
  const auth = await getUserForAction()
  if ('error' in auth) return { ok: false, code: 'unauthorized' }
  await beginFeatureTrial(auth.user.id, 'student')
  if (!(await hasStudentStudyAccess({ userId: auth.user.id }))) {
    return { ok: false, code: 'payment_required' }
  }

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

  const locale = localeFrom(formData.get('locale'))
  const guide = await explainHomeworkImages({
    userId: auth.user.id,
    locale,
    images,
  })
  if (!guide) return { ok: false, code: 'unreadable' }
  const caption = String(formData.get('text') ?? '').trim().slice(0, 8000)
  await rememberTurn({
    userId: auth.user.id,
    locale,
    text: caption,
    imageCount: images.length,
    guide,
  })
  return { ok: true, data: guide }
}

export async function explainTypedHomework(input: {
  locale: string
  text: string
}): Promise<HomeworkHelpActionResult<HomeworkGuide>> {
  const auth = await getUserForAction()
  if ('error' in auth) return { ok: false, code: 'unauthorized' }
  const text = input.text.trim()
  if (!text) return { ok: false, code: 'missing_text' }
  await beginFeatureTrial(auth.user.id, 'student')
  if (!(await hasStudentStudyAccess({ userId: auth.user.id }))) {
    return { ok: false, code: 'payment_required' }
  }
  const locale = normalizeWebLocale(input.locale) ?? 'vi'
  const guide = await explainHomeworkText({
    userId: auth.user.id,
    locale,
    text: text.slice(0, 8000),
  })
  if (!guide) return { ok: false, code: 'ai_unavailable' }
  if (!guide.problems.length) return { ok: false, code: 'missing_text' }
  await rememberTurn({
    userId: auth.user.id,
    locale,
    text: text.slice(0, 8000),
    imageCount: 0,
    guide,
  })
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
  await beginFeatureTrial(auth.user.id, 'student')
  if (!(await hasStudentStudyAccess({ userId: auth.user.id }))) {
    return { ok: false, code: 'payment_required' }
  }
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

export async function openHomeworkKnowledgeTag(input: {
  locale: string
  labelKey: string
  title: string
}): Promise<HomeworkHelpActionResult<TutorAnswer>> {
  const auth = await getUserForAction()
  if ('error' in auth) return { ok: false, code: 'unauthorized' }
  const title = input.title.trim()
  const labelKey = input.labelKey.trim()
  if (!title || !labelKey) return { ok: false, code: 'missing_text' }
  await beginFeatureTrial(auth.user.id, 'student')
  if (!(await hasStudentStudyAccess({ userId: auth.user.id }))) {
    return { ok: false, code: 'payment_required' }
  }
  const answer = await resolveSharedTutorTopic({
    userId: auth.user.id,
    locale: localeOf(input.locale),
    labelKey,
    title,
  })
  if (!answer) return { ok: false, code: 'ai_unavailable' }
  return { ok: true, data: answer }
}
