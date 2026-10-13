'use server'

import { getUserForAction } from '@/lib/auth'
import { normalizeWebLocale, type WebLocale } from '@/lib/i18n/config'
import { hasStudentStudyAccess } from '@/lib/student-study-access'
import { askTutor, openTutorLabel } from '@/lib/ai-tutor/ai-tutor-ai'
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
  if (!(await hasStudentStudyAccess({ userId: auth.user.id, createdAt: auth.user.created_at }))) {
    return { ok: false, code: 'payment_required' }
  }
  const sessionId = await ensureTutorSession(auth.user.id, localeOf(locale))
  if (!sessionId) return { ok: true, data: { sessionId: null, messages: [] } }
  return { ok: true, data: { sessionId, messages: await listTutorMessages(sessionId) } }
}

export async function startTutorThread(locale: string): Promise<TutorActionResult<{ sessionId: string | null }>> {
  const auth = await getUserForAction()
  if ('error' in auth) return { ok: false, code: 'unauthorized' }
  if (!(await hasStudentStudyAccess({ userId: auth.user.id, createdAt: auth.user.created_at }))) {
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
  if (!(await hasStudentStudyAccess({ userId: auth.user.id, createdAt: auth.user.created_at }))) {
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

export async function openTutorLabelAction(input: {
  locale: string
  labelKey: string
  title: string
}): Promise<TutorActionResult<TutorAnswer>> {
  const auth = await getUserForAction()
  if ('error' in auth) return { ok: false, code: 'unauthorized' }
  if (!(await hasStudentStudyAccess({ userId: auth.user.id, createdAt: auth.user.created_at }))) {
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
