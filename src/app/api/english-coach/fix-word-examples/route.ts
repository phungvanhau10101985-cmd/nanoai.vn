import { NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { GEMINI_25_FLASH_NO_THINKING } from '@/lib/gemini-config'
import { EnglishCoachApiFeature, trackEnglishCoachGeminiResult } from '@/lib/english-coach-api-usage'
import { getProfileRoleWithFallback } from '@/lib/db/read-user-dashboard-pg'
import { getUserForAction } from '@/lib/auth'
import { isPgConfigured } from '@/lib/db/pool'
import {
  fetchDailyWordsWithExampleItemsPg,
  fetchReviewQueueWithExampleItemsPg,
  fetchVocabCacheWithExampleItemsPg,
  updateDailyWordExampleItemsPg,
  updateReviewQueueExampleItemsPg,
  updateVocabCacheExampleItemsPg,
} from '@/lib/db/language-coach-meaning-examples-fix-pg'

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
  nativeLanguage: string,
  adminUserId: string | null
): Promise<Array<{ targetText: string; targetPinyin: string; nativeText: string }> | null> {
  const apiKey = process.env.GOOGLE_API_KEY
  if (!apiKey) return null
  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel(GEMINI_25_FLASH_NO_THINKING)
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
  trackEnglishCoachGeminiResult(
    result,
    GEMINI_25_FLASH_NO_THINKING.model,
    EnglishCoachApiFeature.fixWordExamples,
    adminUserId,
    'unsessioned'
  )
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
    if (!isPgConfigured()) {
      return NextResponse.json({ error: 'Cơ sở dữ liệu chưa cấu hình.' }, { status: 503 })
    }
    const auth = await getUserForAction()
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })
    const user = auth.user
    const adminUserId = user.id

    const role = await getProfileRoleWithFallback(user.id)
    if (role !== 'admin') {
      return NextResponse.json({ error: 'Chỉ quản trị viên mới được thực hiện thao tác này.' }, { status: 403 })
    }

    const dailyRows = await fetchDailyWordsWithExampleItemsPg()
    const reviewRows = await fetchReviewQueueWithExampleItemsPg()
    if (dailyRows === null || reviewRows === null) {
      return NextResponse.json({ error: 'Không đọc được dữ liệu từ vựng.' }, { status: 500 })
    }

    const toFix: Array<{ table: string; id: string; word: string; target_language: string | null; native_language: string | null }> = []
    for (const row of dailyRows) {
      try {
        const items = JSON.parse(row.example_items_json || '[]') as Array<{ targetText?: string }>
        if (exampleItemsNeedFix(items, row.target_language)) {
          toFix.push({ table: 'daily_words', id: row.id, word: row.word, target_language: row.target_language, native_language: row.native_language })
        }
      } catch {}
    }
    for (const row of reviewRows) {
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
    const t = () => new Date().toISOString()
    for (const [, entry] of byWord) {
      const { word, target, native, rows } = entry
      const newItems = await fetchWordExamplesFromAI(word, target || 'Chinese', native || 'Vietnamese', adminUserId)
      if (!newItems || newItems.length === 0) continue
      entry.newItems = newItems
      const newJson = JSON.stringify(newItems)
      for (const r of rows) {
        if (r.table === 'daily_words') {
          const ok = await updateDailyWordExampleItemsPg({
            id: r.id,
            exampleItemsJson: newJson,
            exampleTarget: newItems[0]?.targetText || null,
            exampleNative: newItems[0]?.nativeText || null,
            updatedAtIso: t(),
          })
          if (ok) updatedDaily++
        } else {
          const ok = await updateReviewQueueExampleItemsPg({
            id: r.id,
            exampleItemsJson: newJson,
            updatedAtIso: t(),
          })
          if (ok) updatedReview++
        }
      }
    }

    const cacheRows = await fetchVocabCacheWithExampleItemsPg()
    if (cacheRows === null) {
      return NextResponse.json({ error: 'Không đọc được vocab cache.' }, { status: 500 })
    }

    let updatedCache = 0
    for (const row of cacheRows) {
      try {
        const items = JSON.parse(row.example_items_json || '[]') as Array<{ targetText?: string }>
        if (!exampleItemsNeedFix(items, row.target_language)) continue
        const k = `${row.word}::${row.target_language || ''}::${row.native_language || ''}`
        let newItems: Array<{ targetText: string; targetPinyin: string; nativeText: string }> | null | undefined =
          byWord.get(k)?.newItems
        if (!newItems) {
          newItems = await fetchWordExamplesFromAI(
            row.word,
            row.target_language || 'Chinese',
            row.native_language || 'Vietnamese',
            adminUserId
          )
        }
        if (newItems?.length) {
          const ok = await updateVocabCacheExampleItemsPg({
            id: row.id,
            exampleItemsJson: JSON.stringify(newItems),
            exampleTarget: newItems[0]?.targetText || null,
            exampleNative: newItems[0]?.nativeText || null,
            updatedAtIso: t(),
          })
          if (ok) updatedCache++
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
