'use client'

import { useEffect, useState } from 'react'
import { transliterateText } from '../services/english-coach-api'
import { usableSentenceReading } from '@/lib/coach-reading'
import { PronunciationReveal } from './pronunciation-reveal'

const memory = new Map<string, string>()
const pending = new Map<string, Promise<string>>()

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
}: {
  text: string
  known?: string
  targetLanguageCode: string
  nativeLanguageCode: string
  localText: (vi: string, en: string) => string
  coachUsageContext?: 'live' | 'preset'
}) {
  const source = String(text || '').trim()
  const target = normalizeLang(targetLanguageCode)
  const native = normalizeLang(nativeLanguageCode)
  const preset = usableSentenceReading(target, known)
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
  if (!enabled || (!busy && !shown)) return null
  return (
    <PronunciationReveal
      localText={localText}
      reading={shown}
      busy={busy && !shown}
      lineKey={source}
    />
  )
}
