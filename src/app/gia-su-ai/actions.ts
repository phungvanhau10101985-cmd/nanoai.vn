'use server'

import { getUserForAction } from '@/lib/auth'
import { normalizeWebLocale, type WebLocale } from '@/lib/i18n/config'
import { askTutor, openTutorLabel } from '@/lib/ai-tutor/ai-tutor-ai'
import { ensureTutorSession, listTutorMessages } from '@/lib/ai-tutor/ai-tutor-store'
import type { TutorAnswer, TutorErrorCode, TutorThreadMessage } from '@/lib/ai-tutor/ai-tutor-types'

export type TutorActionResult<T> = { ok: true; data: T } | { ok: false; code: TutorErrorCode }

function localeOf(value: string): WebLocale {
  return normalizeWebLocale(value) ?? 'vi'
}

export async function loadTutorThread(locale: string): Promise<TutorActionResult<TutorThreadMessage[]>> {
  const auth = await getUserForAction()
  if ('error' in auth) return { ok: false, code: 'unauthorized' }
  const sessionId = await ensureTutorSession(auth.user.id, localeOf(locale))
  if (!sessionId) return { ok: true, data: [] }
  return { ok: true, data: await listTutorMessages(sessionId) }
}

export async function sendTutorQuestion(input: {
  locale: string
  text: string
}): Promise<TutorActionResult<TutorAnswer>> {
  const auth = await getUserForAction()
  if ('error' in auth) return { ok: false, code: 'unauthorized' }
  const text = input.text.trim()
  if (!text) return { ok: false, code: 'missing_text' }
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
  const answer = await openTutorLabel({
    userId: auth.user.id,
    locale: localeOf(input.locale),
    labelKey: input.labelKey,
    title: input.title,
  })
  if (!answer) return { ok: false, code: 'ai_unavailable' }
  return { ok: true, data: answer }
}
