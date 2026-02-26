import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { GoogleGenerativeAI } from '@google/generative-ai'

function adminClient() {
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

function hasCjk(s: string): boolean {
  return /[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/.test(s)
}

function exampleItemsNeedFix(
  items: Array<{ targetText?: string }>,
  targetLang: string | null
): boolean {
  const norm = String(targetLang || '').toLowerCase()
  if (
    !norm.includes('chinese') &&
    !norm.includes('zh') &&
    !norm.includes('mandarin') &&
    !norm.includes('japanese') &&
    !norm.includes('ja') &&
    !norm.includes('korean') &&
    !norm.includes('ko')
  ) {
    return false
  }
  for (const item of items) {
    const t = String(item.targetText || '').trim()
    if (t && !hasCjk(t)) return true
  }
  return false
}

function sanitizeExampleItems(input: unknown): Array<{ targetText: string; targetPinyin: string; nativeText: string }> {
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

async function fetchWordExamplesFromAI(
  word: string,
  targetLanguage: string,
  nativeLanguage: string
): Promise<Array<{ targetText: string; targetPinyin: string; nativeText: string }> | null> {
  const apiKey = process.env.GOOGLE_API_KEY
  if (!apiKey) return null
  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
  const prompt = `Bạn là giáo viên ngôn ngữ.
Hãy giải thích từ "${word}" (chỉ trả ví dụ câu, không cần giải nghĩa chi tiết).
Ngôn ngữ mục tiêu: ${targetLanguage}.
Ngôn ngữ mẹ đẻ: ${nativeLanguage}.

Yêu cầu exampleItems (2-3 ví dụ):
- targetText: PHẢI là chữ gốc (tiếng Trung = 汉字, tiếng Nhật = かな/漢字, tiếng Hàn = 한글). KHÔNG dùng pinyin/romaji cho targetText.
- targetPinyin: phiên âm Latin.
- nativeText: bản dịch.

Trả về JSON:
{"exampleItems":[{"targetText":"...","targetPinyin":"...","nativeText":"..."}]}`

  const result = await model.generateContent(prompt)
  const text = (result.response.text() || '').trim()
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return null
  try {
    const parsed = JSON.parse(jsonMatch[0]) as { exampleItems?: unknown }
    const items = sanitizeExampleItems(parsed.exampleItems)
    return items.length > 0 ? items : null
  } catch {
    return null
  }
}

export async function POST() {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Vui lòng đăng nhập.' }, { status: 401 })

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Chỉ quản trị viên mới được thực hiện thao tác này.' }, { status: 403 })
    }

    const adminSupabase = adminClient()

    const { data: dailyRows } = await adminSupabase
      .from('language_coach_daily_words')
      .select('id, user_id, word, target_language, native_language, example_items_json')
      .not('example_items_json', 'is', null)

    const { data: reviewRows } = await adminSupabase
      .from('language_coach_review_queue')
      .select('id, user_id, word, target_language, native_language, example_items_json')
      .not('example_items_json', 'is', null)

    const toFix: Array<{ table: string; id: string; word: string; target_language: string | null; native_language: string | null }> = []
    for (const row of dailyRows || []) {
      try {
        const items = JSON.parse(row.example_items_json || '[]') as Array<{ targetText?: string }>
        if (exampleItemsNeedFix(items, row.target_language)) {
          toFix.push({ table: 'daily_words', id: row.id, word: row.word, target_language: row.target_language, native_language: row.native_language })
        }
      } catch {}
    }
    for (const row of reviewRows || []) {
      try {
        const items = JSON.parse(row.example_items_json || '[]') as Array<{ targetText?: string }>
        if (exampleItemsNeedFix(items, row.target_language)) {
          toFix.push({ table: 'review_queue', id: row.id, word: row.word, target_language: row.target_language, native_language: row.native_language })
        }
      } catch {}
    }

    const byWord = new Map<string, { word: string; target: string | null; native: string | null; rows: typeof toFix; newItems?: Array<{ targetText: string; targetPinyin: string; nativeText: string }> }>()
    for (const r of toFix) {
      const k = `${r.word}::${r.target_language || ''}::${r.native_language || ''}`
      if (!byWord.has(k)) byWord.set(k, { word: r.word, target: r.target_language, native: r.native_language, rows: [] })
      byWord.get(k)!.rows.push(r)
    }

    let updatedDaily = 0
    let updatedReview = 0
    for (const [, entry] of byWord) {
      const { word, target, native, rows } = entry
      const newItems = await fetchWordExamplesFromAI(word, target || 'Chinese', native || 'Vietnamese')
      if (!newItems || newItems.length === 0) continue
      entry.newItems = newItems
      const newJson = JSON.stringify(newItems)
      for (const r of rows) {
        if (r.table === 'daily_words') {
          const { error } = await adminSupabase
            .from('language_coach_daily_words')
            .update({
              example_items_json: newJson,
              example_target: newItems[0]?.targetText || null,
              example_native: newItems[0]?.nativeText || null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', r.id)
          if (!error) updatedDaily++
        } else {
          const { error } = await adminSupabase
            .from('language_coach_review_queue')
            .update({
              example_items_json: newJson,
              updated_at: new Date().toISOString(),
            })
            .eq('id', r.id)
          if (!error) updatedReview++
        }
      }
    }

    const { data: cacheRows } = await adminSupabase
      .from('language_coach_vocab_cache')
      .select('id, word, target_language, native_language, example_items_json')
      .not('example_items_json', 'is', null)

    let updatedCache = 0
    for (const row of cacheRows || []) {
      try {
        const items = JSON.parse(row.example_items_json || '[]') as Array<{ targetText?: string }>
        if (!exampleItemsNeedFix(items, row.target_language)) continue
        const k = `${row.word}::${row.target_language || ''}::${row.native_language || ''}`
        let newItems = byWord.get(k)?.newItems
        if (!newItems) {
          newItems = await fetchWordExamplesFromAI(
            row.word,
            row.target_language || 'Chinese',
            row.native_language || 'Vietnamese'
          )
        }
        if (newItems?.length) {
          const { error } = await adminSupabase
            .from('language_coach_vocab_cache')
            .update({
              example_items_json: JSON.stringify(newItems),
              example_target: newItems[0]?.targetText || null,
              example_native: newItems[0]?.nativeText || null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', row.id)
          if (!error) updatedCache++
        }
      } catch {}
    }

    return NextResponse.json({
      ok: true,
      message: `Đã chuẩn hóa: ${updatedDaily} từ mới, ${updatedReview} ôn tập, ${updatedCache} cache.`,
      updatedDaily,
      updatedReview,
      updatedCache,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Lỗi không xác định.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
