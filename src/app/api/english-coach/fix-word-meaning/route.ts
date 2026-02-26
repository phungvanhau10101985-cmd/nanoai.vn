import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { getUserForAction } from '@/lib/auth'

function adminClient() {
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

function hasCjk(s: string): boolean {
  return /[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/.test(s)
}

function isTargetCjk(targetLang: string | null): boolean {
  const n = String(targetLang || '').toLowerCase()
  return /chinese|zh|mandarin|japanese|ja|korean|ko/.test(n)
}

function isNativeCjk(nativeLang: string | null): boolean {
  const n = String(nativeLang || '').toLowerCase()
  return /chinese|zh|mandarin|japanese|ja|korean|ko/.test(n)
}

function getMeaningText(row: { meaning?: string | null; meaning_items_json?: string | null }): string {
  const m = String(row.meaning ?? '').trim()
  if (m) return m
  try {
    const items = JSON.parse(row.meaning_items_json || '[]') as Array<{ text?: string }>
    return String(items[0]?.text ?? '').trim()
  } catch {
    return ''
  }
}

/** Nghĩa đang ở ngôn ngữ đích (CJK) thay vì mẹ đẻ */
function meaningInWrongLanguage(
  row: { meaning?: string | null; meaning_items_json?: string | null; target_language?: string | null; native_language?: string | null }
): boolean {
  if (!isTargetCjk(row.target_language)) return false
  if (isNativeCjk(row.native_language)) return false
  const text = getMeaningText(row)
  if (!text) return false
  return hasCjk(text)
}

function sanitizeMeaningItems(input: unknown): Array<{ text: string; pinyin?: string }> {
  if (!Array.isArray(input)) return []
  return input
    .map((row) => ({
      text: String((row as { text?: unknown })?.text || '').trim(),
      pinyin: String((row as { pinyin?: unknown })?.pinyin || '').trim(),
    }))
    .filter((row) => row.text)
    .slice(0, 8)
}

function sanitizeExampleItems(input: unknown): Array<{ targetText: string; targetPinyin?: string; nativeText: string }> {
  if (!Array.isArray(input)) return []
  return input
    .map((row) => ({
      targetText: String((row as { targetText?: unknown })?.targetText || '').trim(),
      targetPinyin: String((row as { targetPinyin?: unknown })?.targetPinyin || '').trim(),
      nativeText: String((row as { nativeText?: unknown })?.nativeText || '').trim(),
    }))
    .filter((row) => row.targetText && row.nativeText)
    .slice(0, 6)
}

export async function GET() {
  try {
    const supabase = createClient()
    const auth = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập.')
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', auth.user!.id).single()
    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Chỉ quản trị viên.' }, { status: 403 })
    }

    const adminSupabase = adminClient()
    const { data: failed } = await adminSupabase
      .from('language_coach_meaning_fix_failed')
      .select('id, word, target_language, native_language, source_table, error_message, created_at')
      .order('created_at', { ascending: false })
      .limit(100)

    return NextResponse.json({ items: failed ?? [] })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Lỗi không xác định.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST() {
  try {
    const supabase = createClient()
    const auth = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập.')
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', auth.user!.id).single()
    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Chỉ quản trị viên.' }, { status: 403 })
    }

    const adminSupabase = adminClient()
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

    const toFix: Array<{ table: 'daily' | 'review'; id: string; word: string; target: string; native: string; userId?: string }> = []

    const { data: dailyRows } = await adminSupabase
      .from('language_coach_daily_words')
      .select('id, user_id, word, target_language, native_language, meaning, meaning_items_json')
      .eq('meaning_fix_attempted', false)

    for (const r of dailyRows ?? []) {
      if (meaningInWrongLanguage(r)) {
        toFix.push({
          table: 'daily',
          id: r.id,
          word: r.word,
          target: r.target_language || 'Chinese',
          native: r.native_language || 'Vietnamese',
          userId: r.user_id,
        })
      }
    }

    const { data: reviewRows } = await adminSupabase
      .from('language_coach_review_queue')
      .select('id, user_id, word, target_language, native_language, meaning, meaning_items_json')
      .eq('meaning_fix_attempted', false)

    for (const r of reviewRows ?? []) {
      if (meaningInWrongLanguage(r)) {
        toFix.push({
          table: 'review',
          id: r.id,
          word: r.word,
          target: r.target_language || 'Chinese',
          native: r.native_language || 'Vietnamese',
          userId: r.user_id,
        })
      }
    }

    const byKey = new Map<string, (typeof toFix)[0]>()
    for (const r of toFix) {
      const k = `${r.word}::${r.target}::${r.native}`
      if (!byKey.has(k)) byKey.set(k, r)
    }

    let updatedDaily = 0
    let updatedReview = 0
    let updatedCache = 0
    let failedCount = 0

    for (const [, r] of byKey) {
      const rowsToMark = toFix.filter((x) => x.word === r.word && x.target === r.target && x.native === r.native)
      try {
        for (const row of rowsToMark) {
          const tbl = row.table === 'daily' ? 'language_coach_daily_words' : 'language_coach_review_queue'
          await adminSupabase.from(tbl).update({ meaning_fix_attempted: true }).eq('id', row.id)
        }

        const res = await fetch(`${baseUrl}/api/english-coach/word`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            word: r.word,
            contextSentence: '',
            targetLanguage: r.target,
            nativeLanguage: r.native,
          }),
        })
        const data = (await res.json().catch(() => ({}))) as {
          meaning?: string
          pronunciation?: string
          meaningItems?: Array<{ text: string; pinyin?: string }>
          exampleItems?: Array<{ targetText: string; targetPinyin?: string; nativeText: string }>
        }

        if (!res.ok || !data.meaning) {
          const errMsg = (data as { error?: string }).error || `Status ${res.status}`
          for (const row of rowsToMark) {
            await adminSupabase.from('language_coach_meaning_fix_failed').insert({
              word: r.word,
              target_language: r.target,
              native_language: r.native,
              user_id: row.userId || null,
              source_table: row.table === 'daily' ? 'language_coach_daily_words' : 'language_coach_review_queue',
              source_id: row.id,
              error_message: errMsg,
            })
          }
          failedCount++
          continue
        }

        const meaningItems = sanitizeMeaningItems(data.meaningItems)
        const exampleItems = sanitizeExampleItems(data.exampleItems)
        const primaryEx = exampleItems[0]

        for (const row of rowsToMark) {
          if (row.table === 'daily') {
            const { error } = await adminSupabase
              .from('language_coach_daily_words')
              .update({
                meaning: data.meaning || null,
                pronunciation: data.pronunciation || null,
                meaning_items_json: meaningItems.length > 0 ? JSON.stringify(meaningItems) : null,
                example_items_json: exampleItems.length > 0 ? JSON.stringify(exampleItems) : null,
                example_target: primaryEx?.targetText || null,
                example_native: primaryEx?.nativeText || null,
                updated_at: new Date().toISOString(),
              })
              .eq('id', row.id)
            if (!error) updatedDaily++
          } else {
            const { error } = await adminSupabase
              .from('language_coach_review_queue')
              .update({
                meaning: data.meaning || null,
                pronunciation: data.pronunciation || null,
                meaning_items_json: meaningItems.length > 0 ? JSON.stringify(meaningItems) : null,
                example_items_json: exampleItems.length > 0 ? JSON.stringify(exampleItems) : null,
                updated_at: new Date().toISOString(),
              })
              .eq('id', row.id)
            if (!error) updatedReview++
          }
        }

        const { data: cacheRows } = await adminSupabase
          .from('language_coach_vocab_cache')
          .select('id')
          .eq('word', r.word)
          .eq('target_language', r.target)
          .eq('native_language', r.native)
          .limit(1)

        if (cacheRows?.[0]) {
          const { error } = await adminSupabase
            .from('language_coach_vocab_cache')
            .update({
              meaning: data.meaning || null,
              pronunciation: data.pronunciation || null,
              meaning_items_json: meaningItems.length > 0 ? JSON.stringify(meaningItems) : null,
              example_items_json: exampleItems.length > 0 ? JSON.stringify(exampleItems) : null,
              example_target: primaryEx?.targetText || null,
              example_native: primaryEx?.nativeText || null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', cacheRows[0].id)
          if (!error) updatedCache++
        }
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : 'Lỗi không xác định'
        for (const row of rowsToMark) {
          await adminSupabase.from('language_coach_meaning_fix_failed').insert({
            word: r.word,
            target_language: r.target,
            native_language: r.native,
            user_id: row.userId || null,
            source_table: row.table === 'daily' ? 'language_coach_daily_words' : 'language_coach_review_queue',
            source_id: row.id,
            error_message: errMsg,
          })
        }
        failedCount++
      }
    }

    return NextResponse.json({
      ok: true,
      message: `Đã chuẩn hóa nghĩa: ${updatedDaily} daily, ${updatedReview} review, ${updatedCache} cache. Thất bại: ${failedCount}.`,
      updatedDaily,
      updatedReview,
      updatedCache,
      failedCount,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Lỗi không xác định.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
