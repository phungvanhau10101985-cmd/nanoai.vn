import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { getUserForAction } from '@/lib/auth'

function adminClient() {
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

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
    const { userId } = await getUserForAction()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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
    const adminSupabase = adminClient()

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

    // Ưu tiên từ mới lưu trong DB của session (và turn nếu có)
    if (sessionId) {
      let query = adminSupabase
        .from('language_coach_daily_words')
        .select('word')
        .eq('user_id', userId)
        .eq('session_id', sessionId)
        .order('updated_at', { ascending: false })
        .limit(120)
      if (turnIndex !== undefined && turnIndex >= 0) {
        query = query.or(`turn_index.eq.${-1},turn_index.eq.${turnIndex}`)
      }
      const { data: sessionRows } = await query
      collect((sessionRows || []) as Array<{ word?: string }>)
    }

    if (out.length < limit) {
      const { data: userRows } = await adminSupabase
        .from('language_coach_daily_words')
        .select('word')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(200)
      collect((userRows || []) as Array<{ word?: string }>)
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

    // Shuffle
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
