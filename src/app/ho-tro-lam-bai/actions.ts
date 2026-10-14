'use server'

import { getUserForAction } from '@/lib/auth'
import { normalizeWebLocale, type WebLocale } from '@/lib/i18n/config'
import { beginFeatureTrial } from '@/lib/feature-trial-start'
import { hasStudentStudyAccess } from '@/lib/student-study-access'
import { resolveSharedTutorTopic } from '@/lib/ai-tutor/ai-tutor-ai'
import type { TutorAnswer } from '@/lib/ai-tutor/ai-tutor-types'
import { getCreditBalanceByUserId, spendCreditsIdempotent } from '@/lib/db/credits-balance'
import { pgQueryOne } from '@/lib/db/pg-query'
import { homeworkStatementFingerprint } from '@/lib/homework-help/homework-help-fingerprint'
import {
  HOMEWORK_SOLUTION_CHARGE_TYPE,
  HOMEWORK_SOLUTION_CREDIT_COST,
  homeworkSolutionEventKey,
} from '@/lib/homework-help/homework-help-solution-cost'
import {
  explainHomeworkImages,
  explainHomeworkText,
  writeHomeworkSolution,
  type HomeworkHelpErrorCode,
} from '@/lib/homework-help/homework-help-ai'
import type { HomeworkGuide } from '@/lib/homework-help/homework-help-guide'
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
  const explained = await explainHomeworkImages({
    userId: auth.user.id,
    locale,
    images,
  })
  if (explained === 'unreadable' || explained === 'ai_unavailable') return { ok: false, code: explained }
  const caption = String(formData.get('text') ?? '').trim().slice(0, 8000)
  await rememberTurn({
    userId: auth.user.id,
    locale,
    text: caption,
    imageCount: images.length,
    guide: explained,
  })
  return { ok: true, data: explained }
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
  const explained = await explainHomeworkText({
    userId: auth.user.id,
    locale,
    text: text.slice(0, 8000),
  })
  if (explained === 'ai_unavailable') return { ok: false, code: 'ai_unavailable' }
  if (!explained.problems.length) return { ok: false, code: 'missing_text' }
  await rememberTurn({
    userId: auth.user.id,
    locale,
    text: text.slice(0, 8000),
    imageCount: 0,
    guide: explained,
  })
  return { ok: true, data: explained }
}

async function homeworkSolutionWasCharged(eventKey: string): Promise<boolean> {
  try {
    const paid = await pgQueryOne<{ event_key: string }>(
      `select event_key from public.language_coach_credit_events where event_key = $1 limit 1`,
      [eventKey]
    )
    if (paid) return true
    const guest = await pgQueryOne<{ event_key: string }>(
      `select event_key from public.guest_credit_trial_events where event_key = $1 limit 1`,
      [eventKey]
    )
    return Boolean(guest)
  } catch {
    return false
  }
}

export async function openHomeworkSolution(input: {
  locale: string
  statement: string
  answer: string
}): Promise<HomeworkHelpActionResult<{ solution: string; cached: boolean }>> {
  const auth = await getUserForAction()
  if ('error' in auth) return { ok: false, code: 'unauthorized' }
  const statement = input.statement.trim().slice(0, 4000)
  const answer = input.answer.trim().slice(0, 2000)
  if (!statement) return { ok: false, code: 'missing_text' }
  await beginFeatureTrial(auth.user.id, 'student')
  if (!(await hasStudentStudyAccess({ userId: auth.user.id }))) {
    return { ok: false, code: 'payment_required' }
  }
  const locale = localeOf(input.locale)
  const fingerprint = homeworkStatementFingerprint(statement)
  const eventKey = homeworkSolutionEventKey(auth.user.id, locale, fingerprint)
  const alreadyCharged = await homeworkSolutionWasCharged(eventKey)
  if (!alreadyCharged) {
    const balance = await getCreditBalanceByUserId(auth.user.id)
    if (balance < HOMEWORK_SOLUTION_CREDIT_COST) return { ok: false, code: 'insufficient_credits' }
  }
  const written = await writeHomeworkSolution({
    userId: auth.user.id,
    locale,
    statement,
    answer,
  })
  if (!written) return { ok: false, code: 'ai_unavailable' }
  if (!alreadyCharged) {
    const charged = await spendCreditsIdempotent({
      userId: auth.user.id,
      amount: HOMEWORK_SOLUTION_CREDIT_COST,
      eventKey,
      chargeType: HOMEWORK_SOLUTION_CHARGE_TYPE,
      sessionId: null,
      metadataJson: JSON.stringify({
        kind: HOMEWORK_SOLUTION_CHARGE_TYPE,
        fingerprint,
        locale,
        cached: written.cached,
      }),
    })
    if (!charged.ok) return { ok: false, code: 'insufficient_credits' }
  }
  return { ok: true, data: written }
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
