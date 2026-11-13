'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { transliterateText } from '../services/english-coach-api'
import { usableSentenceReading } from '@/lib/coach-reading'
import { PronunciationReveal } from './pronunciation-reveal'

const memory = new Map<string, string>()
const pending = new Map<string, Promise<string>>()

const TARGET_SCRIPT: Record<string, RegExp> = {
  zh: /[\u4E00-\u9FFF]/u,
  ja: /[\u3040-\u30FF\u4E00-\u9FFF]/u,
  ko: /[\uAC00-\uD7AF]/u,
  th: /[\u0E00-\u0E7F]/u,
  hi: /[\u0900-\u097F]/u,
}

/** Giữ phần chữ đang học. Bỏ chú thích tiếng mẹ đẻ trong ngoặc để còn dòng phiên âm và công tắc. */
function readingSource(text: string, languageCode: string): string {
  const raw = String(text || '').trim()
  const script = TARGET_SCRIPT[languageCode]
  if (!raw || !script || !script.test(raw)) return raw
  const stripped = raw.replace(/\([^)]*\)/g, ' ').replace(/（[^）]*）/g, ' ')
  const kept: string[] = []
  for (const ch of Array.from(stripped)) {
    if (script.test(ch) || /[\s，。！？、；：「」『』（）【】《》〈〉,.!?;:]/u.test(ch)) kept.push(ch)
  }
  return kept.join('').replace(/\s+/g, ' ').trim()
}

function normalizeLang(input: string): string {
  const code = String(input || '').trim().toLowerCase()
  if (code.startsWith('zh')) return 'zh'
  if (code.startsWith('ja')) return 'ja'
  if (code.startsWith('ko')) return 'ko'
  if (code.startsWith('th')) return 'th'
  if (code.startsWith('hi')) return 'hi'
  if (code.startsWith('vi')) return 'vi'
  if (code.startsWith('en')) return 'en'
  return ''
}

async function loadReading(
  text: string,
  languageCode: string,
  coachUsageContext?: 'live' | 'preset'
): Promise<string> {
  const cacheKey = `${languageCode}|${text}`
  const hit = memory.get(cacheKey)
  if (hit !== undefined) return usableSentenceReading(languageCode, hit)
  const existing = pending.get(cacheKey)
  if (existing) return existing
  const job = transliterateText({
    text,
    languageCode,
    coachUsageContext,
  }).then((result) => {
    const reading = result.ok ? usableSentenceReading(languageCode, String(result.data?.transliteration || '')) : ''
    memory.set(cacheKey, reading)
    pending.delete(cacheKey)
    return reading
  }).catch(() => {
    memory.set(cacheKey, '')
    pending.delete(cacheKey)
    return ''
  })
  pending.set(cacheKey, job)
  return job
}

export function NativePhoneticLine({
  text,
  known,
  targetLanguageCode,
  nativeLanguageCode,
  localText,
  coachUsageContext,
  actions = null,
}: {
  text: string
  known?: string
  targetLanguageCode: string
  nativeLanguageCode: string
  localText: (vi: string, en: string) => string
  coachUsageContext?: 'live' | 'preset'
  actions?: ReactNode
}) {
  const target = normalizeLang(targetLanguageCode)
  const source = readingSource(String(text || '').trim(), target)
  const native = normalizeLang(nativeLanguageCode)
  const preset = usableSentenceReading(target, known ?? '')
  const needsReading = target === 'zh' || target === 'ja' || target === 'ko' || target === 'th' || target === 'hi' || (target === 'en' && native !== 'en')
  const enabled = Boolean(source) && needsReading
  const cacheKey = `${target}|${source}`
  const hasMemory = enabled && memory.has(cacheKey)
  const cached = hasMemory ? usableSentenceReading(target, memory.get(cacheKey) || '') : ''
  const [reading, setReading] = useState(() => preset || cached)
  const [busy, setBusy] = useState(() => enabled && !preset && !hasMemory)

  useEffect(() => {
    if (!enabled) return
    if (preset) {
      memory.set(cacheKey, preset)
      setReading(preset)
      setBusy(false)
      return
    }
    let cancelled = false
    if (memory.has(cacheKey)) {
      const stored = usableSentenceReading(target, memory.get(cacheKey) || '')
      if (stored) memory.set(cacheKey, stored)
      setReading(stored)
      setBusy(false)
      return
    }
    setBusy(true)
    void loadReading(source, target, coachUsageContext).then((value) => {
      if (cancelled) return
      setReading(value)
      setBusy(false)
    })
    return () => {
      cancelled = true
    }
  }, [cacheKey, coachUsageContext, enabled, preset, source, target])

  const shown = usableSentenceReading(target, reading)
  if (!enabled || (!busy && !shown)) {
    return actions ? <span className="inline-flex flex-wrap items-center gap-1">{actions}</span> : null
  }
  return (
    <PronunciationReveal
      localText={localText}
      source={source}
      reading={shown}
      busy={busy && !shown}
      lineKey={source}
      actions={actions}
    />
  )
}
