'use server'

import { getUserForAction } from '@/lib/auth'
import { normalizeWebLocale, type WebLocale } from '@/lib/i18n/config'
import { beginFeatureTrial } from '@/lib/feature-trial-start'
import { hasStudentStudyAccess } from '@/lib/student-study-access'
import { askTutor, askTutorAboutPhoto, openTutorLabel } from '@/lib/ai-tutor/ai-tutor-ai'
import {
  ensureTutorSession,
  listTutorMessages,
  listTutorSessions,
  openTutorSession,
  startTutorSession,
} from '@/lib/ai-tutor/ai-tutor-store'
import type { TutorAnswer, TutorErrorCode, TutorSessionSummary, TutorThreadMessage } from '@/lib/ai-tutor/ai-tutor-types'

export type TutorActionResult<T> = { ok: true; data: T } | { ok: false; code: TutorErrorCode }

function localeOf(value: string): WebLocale {
  return normalizeWebLocale(value) ?? 'vi'
}

export async function loadTutorThread(
  locale: string
): Promise<TutorActionResult<{ sessionId: string | null; messages: TutorThreadMessage[] }>> {
  const auth = await getUserForAction()
  if ('error' in auth) return { ok: false, code: 'unauthorized' }
  if (!(await hasStudentStudyAccess({ userId: auth.user.id }))) {
    return { ok: false, code: 'payment_required' }
  }
  const sessionId = await ensureTutorSession(auth.user.id, localeOf(locale))
  if (!sessionId) return { ok: true, data: { sessionId: null, messages: [] } }
  return { ok: true, data: { sessionId, messages: await listTutorMessages(sessionId) } }
}

export async function startTutorThread(locale: string): Promise<TutorActionResult<{ sessionId: string | null }>> {
  const auth = await getUserForAction()
  if ('error' in auth) return { ok: false, code: 'unauthorized' }
  if (!(await hasStudentStudyAccess({ userId: auth.user.id }))) {
    return { ok: false, code: 'payment_required' }
  }
  const sessionId = await startTutorSession(auth.user.id, localeOf(locale))
  if (!sessionId) return { ok: false, code: 'new_thread_failed' }
  return { ok: true, data: { sessionId } }
}

export async function listTutorHistory(): Promise<TutorActionResult<TutorSessionSummary[]>> {
  const auth = await getUserForAction()
  if ('error' in auth) return { ok: false, code: 'unauthorized' }
  return { ok: true, data: await listTutorSessions(auth.user.id) }
}

export async function openTutorHistoryThread(
  sessionId: string
): Promise<TutorActionResult<{ sessionId: string; messages: TutorThreadMessage[] }>> {
  const auth = await getUserForAction()
  if ('error' in auth) return { ok: false, code: 'unauthorized' }
  const messages = await openTutorSession(auth.user.id, sessionId)
  if (!messages) return { ok: false, code: 'ai_unavailable' }
  return { ok: true, data: { sessionId, messages } }
}

export async function sendTutorQuestion(input: {
  locale: string
  text: string
}): Promise<TutorActionResult<TutorAnswer>> {
  const auth = await getUserForAction()
  if ('error' in auth) return { ok: false, code: 'unauthorized' }
  const text = input.text.trim()
  if (!text) return { ok: false, code: 'missing_text' }
  await beginFeatureTrial(auth.user.id, 'student')
  if (!(await hasStudentStudyAccess({ userId: auth.user.id }))) {
    return { ok: false, code: 'payment_required' }
  }
  const answer = await askTutor({
    userId: auth.user.id,
    locale: localeOf(input.locale),
    text,
  })
  if (!answer) return { ok: false, code: 'ai_unavailable' }
  return { ok: true, data: answer }
}

const TUTOR_MAX_IMAGES = 3
const TUTOR_MAX_BYTES = 6 * 1024 * 1024
const TUTOR_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

export async function sendTutorPhoto(formData: FormData): Promise<TutorActionResult<TutorAnswer>> {
  const auth = await getUserForAction()
  if ('error' in auth) return { ok: false, code: 'unauthorized' }
  await beginFeatureTrial(auth.user.id, 'student')
  if (!(await hasStudentStudyAccess({ userId: auth.user.id }))) {
    return { ok: false, code: 'payment_required' }
  }
  const text = String(formData.get('text') ?? '').trim().slice(0, 2000)
  const files = formData.getAll('images').filter((item): item is File => item instanceof File && item.size > 0)
  if (!files.length) return text ? sendTutorQuestion({ locale: String(formData.get('locale') ?? ''), text }) : { ok: false, code: 'missing_text' }
  if (files.length > TUTOR_MAX_IMAGES) return { ok: false, code: 'too_many' }
  const images: { mimeType: string; base64: string }[] = []
  for (const file of files) {
    if (file.size > TUTOR_MAX_BYTES) return { ok: false, code: 'too_large' }
    const mimeType = file.type || 'image/jpeg'
    if (!TUTOR_IMAGE_TYPES.has(mimeType)) return { ok: false, code: 'bad_type' }
    images.push({ mimeType, base64: Buffer.from(await file.arrayBuffer()).toString('base64') })
  }
  const answer = await askTutorAboutPhoto({
    userId: auth.user.id,
    locale: localeOf(String(formData.get('locale') ?? '')),
    text,
    images,
  })
  if (answer === 'unreadable') return { ok: false, code: 'unreadable' }
  if (!answer) return { ok: false, code: 'ai_unavailable' }
  return { ok: true, data: answer }
}

export async function openTutorLabelAction(input: {
  locale: string
  labelKey: string
  title: string
}): Promise<TutorActionResult<TutorAnswer>> {
  const auth = await getUserForAction()
  if ('error' in auth) return { ok: false, code: 'unauthorized' }
  await beginFeatureTrial(auth.user.id, 'student')
  if (!(await hasStudentStudyAccess({ userId: auth.user.id }))) {
    return { ok: false, code: 'payment_required' }
  }
  const answer = await openTutorLabel({
    userId: auth.user.id,
    locale: localeOf(input.locale),
    labelKey: input.labelKey,
    title: input.title,
  })
  if (!answer) return { ok: false, code: 'ai_unavailable' }
  return { ok: true, data: answer }
}
