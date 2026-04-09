import { NextRequest, NextResponse } from 'next/server'
import { getUserForAction } from '@/lib/auth'
import { isPgConfigured } from '@/lib/db/pool'
import {
  fetchDailyWordsForSessionListeningPg,
  fetchDailyWordsRecentUserListeningPg,
} from '@/lib/db/language-coach-misc-pg'

function normalizeLookup(input: string): string {
  return String(input || '').trim().toLowerCase()
}

function extractWords(text: string): string[] {
  return String(text || '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .map((x) => x.trim())
    .filter((x) => x.length >= 1)
}

const DEFAULT_BY_LANG: Record<string, string[]> = {
  en: ['today', 'tomorrow', 'now', 'thanks', 'learn', 'friend', 'home', 'work'],
  vi: ['hôm', 'nay', 'mai', 'học', 'đi', 'nhà', 'ăn', 'uống'],
  zh: ['今天', '明天', '现在', '谢谢', '喜欢', '学习', '朋友', '家'],
  ja: ['きょう', 'あした', 'いま', 'ありがとう', 'すき', 'べんきょう', 'ともだち', 'いえ'],
  ko: ['오늘', '내일', '지금', '고마워요', '좋아해요', '공부', '친구', '집'],
  th: ['วันนี้', 'พรุ่งนี้', 'ตอนนี้', 'ขอบคุณ', 'ชอบ', 'เรียน', 'เพื่อน', 'บ้าน'],
  hi: ['आज', 'कल', 'अभी', 'धन्यवाद', 'पसंद', 'पढ़ाई', 'दोस्त', 'घर'],
}

export async function GET(request: NextRequest) {
  try {
    const auth = await getUserForAction()
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })
    const { user } = auth

    if (!isPgConfigured()) {
      return NextResponse.json({ error: 'Server database is not configured.' }, { status: 503 })
    }

    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')?.trim()
    const turnIndexRaw = searchParams.get('turnIndex')
    const turnIndex = turnIndexRaw != null && turnIndexRaw !== '' ? Math.max(-1, Math.floor(Number(turnIndexRaw))) : undefined
    const excludeRaw = searchParams.get('exclude')?.trim()
    const limit = Math.min(12, Math.max(1, Number(searchParams.get('limit')) || 4))
    const languageCode = searchParams.get('languageCode')?.trim() || 'en'

    const excludeSet = new Set(
      (excludeRaw ? excludeRaw.split(/[,;]/).map((x) => normalizeLookup(x)).filter(Boolean) : []) as string[]
    )
    const minLen = ['zh', 'ja', 'ko', 'th', 'hi'].includes(languageCode.toLowerCase()) ? 1 : 2

    const out: string[] = []

    const collect = (rows: Array<{ word?: string }> | null | undefined) => {
      for (const row of rows || []) {
        for (const token of extractWords(String(row.word || ''))) {
          const t = normalizeLookup(token)
          if (!t || t.length < minLen) continue
          if (excludeSet.has(t) || out.includes(t)) continue
          out.push(t)
          if (out.length >= limit) return
        }
      }
    }

    if (sessionId) {
      const sessionWords = await fetchDailyWordsForSessionListeningPg({
        userId: user.id,
        sessionId,
        turnIndex: turnIndex !== undefined && turnIndex >= 0 ? turnIndex : undefined,
        limit: 120,
      })
      if (sessionWords === null) {
        return NextResponse.json({ error: 'Could not load vocabulary.' }, { status: 500 })
      }
      collect(sessionWords.map((word) => ({ word })))
    }

    if (out.length < limit) {
      const userWords = await fetchDailyWordsRecentUserListeningPg(user.id, 200)
      if (userWords === null) {
        return NextResponse.json({ error: 'Could not load vocabulary.' }, { status: 500 })
      }
      collect(userWords.map((word) => ({ word })))
    }

    if (out.length < limit) {
      const langKey = languageCode.split(/[-_]/)[0]?.toLowerCase() || 'en'
      const defaults = DEFAULT_BY_LANG[langKey] || DEFAULT_BY_LANG.en || []
      for (const t of defaults) {
        const n = normalizeLookup(t)
        if (!n || excludeSet.has(n) || out.includes(n)) continue
        out.push(n)
        if (out.length >= limit) break
      }
    }

    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]]
    }

    return NextResponse.json({ words: out.slice(0, limit) })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
