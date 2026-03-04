import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserForAction } from '@/lib/auth'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { getInternalBaseUrl } from '@/lib/internal-url'

type ReviewPayload = {
  id?: string
  score?: number
}

function adminClient() {
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

function parseJsonArrayText(input: string | null | undefined): unknown[] {
  const raw = String(input || '').trim()
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
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

function sanitizeSenseItems(input: unknown): Array<{ gloss: string; exampleTarget: string; exampleNative: string }> {
  if (!Array.isArray(input)) return []
  return input
    .map((row) => ({
      gloss: String((row as { gloss?: unknown })?.gloss || '').trim(),
      exampleTarget: String((row as { exampleTarget?: unknown })?.exampleTarget || '').trim(),
      exampleNative: String((row as { exampleNative?: unknown })?.exampleNative || '').trim(),
    }))
    .filter((row) => row.gloss || (row.exampleTarget && row.exampleNative))
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

function hasMeaning(row: { meaning?: string | null; meaning_items_json?: string | null }): boolean {
  const meaning = String(row.meaning ?? '').trim()
  return Boolean(meaning)
}

function normalizeUsageLevel(input: unknown): 'high' | 'medium' | 'low' {
  const normalized = String(input || '').trim().toLowerCase()
  if (normalized === 'high' || normalized === 'medium' || normalized === 'low') return normalized
  return 'medium'
}

function normalizeImportanceScore(input: unknown): number {
  const n = Number(input)
  if (!Number.isFinite(n)) return 50
  return Math.min(100, Math.max(0, Math.round(n)))
}

function normalizeContextSensitive(input: unknown): boolean {
  if (typeof input === 'boolean') return input
  const normalized = String(input || '').trim().toLowerCase()
  return normalized === '1' || normalized === 'true' || normalized === 'yes'
}

function exampleItemsNeedFix(items: Array<{ targetText?: string }>, targetLang: string | null): boolean {
  const norm = String(targetLang || '').toLowerCase()
  if (!norm.includes('chinese') && !norm.includes('zh') && !norm.includes('mandarin') && !norm.includes('japanese') && !norm.includes('ja') && !norm.includes('korean') && !norm.includes('ko')) return false
  const hasCjk = (s: string) => /[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/.test(s)
  for (const item of items) {
    const t = String(item.targetText || '').trim()
    if (t && !hasCjk(t)) return true
  }
  return false
}

async function normalizeIncompleteWords(
  adminSupabase: ReturnType<typeof adminClient>,
  userId: string,
  baseUrl: string
) {
  const { data: dailyRows } = await adminSupabase
    .from('language_coach_daily_words')
    .select('id, word, target_language, native_language, meaning, meaning_items_json, example_items_json')
    .eq('user_id', userId)
  const toFix: Array<{ table: 'daily' | 'review'; id: string; word: string; target: string; native: string }> = []
  for (const r of dailyRows ?? []) {
    const needsMeaning = !hasMeaning(r)
    const exItems = parseJsonArrayText(r.example_items_json) as Array<{ targetText?: string }>
    const needsExamples = exItems.length > 0 && exampleItemsNeedFix(exItems, r.target_language)
    if (needsMeaning || needsExamples) {
      toFix.push({
        table: 'daily',
        id: r.id,
        word: r.word,
        target: r.target_language || 'Chinese',
        native: r.native_language || 'Vietnamese',
      })
    }
  }
  const { data: reviewRows } = await adminSupabase
    .from('language_coach_review_queue')
    .select('id, word, target_language, native_language, meaning, meaning_items_json, example_items_json')
    .eq('user_id', userId)
  for (const r of reviewRows ?? []) {
    const needsMeaning = !hasMeaning(r)
    const exItems = parseJsonArrayText(r.example_items_json) as Array<{ targetText?: string }>
    const needsExamples = exItems.length > 0 && exampleItemsNeedFix(exItems, r.target_language)
    if (needsMeaning || needsExamples) {
      toFix.push({
        table: 'review',
        id: r.id,
        word: r.word,
        target: r.target_language || 'Chinese',
        native: r.native_language || 'Vietnamese',
      })
    }
  }
  const byKey = new Map<string, (typeof toFix)[0]>()
  for (const r of toFix) {
    const k = `${r.word}::${r.target}::${r.native}`
    if (!byKey.has(k)) byKey.set(k, r)
  }
  const maxFix = 3
  let wordsFixed = 0
  for (const [, r] of byKey) {
    if (wordsFixed >= maxFix) break
    try {
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
        senses?: Array<{ gloss: string; exampleTarget: string; exampleNative: string }>
        exampleItems?: Array<{ targetText: string; targetPinyin?: string; nativeText: string }>
        usageLevel?: string
        importanceScore?: number
        contextSensitive?: boolean
      }
      if (!res.ok || !data.meaning) continue
      const senses = sanitizeSenseItems(data.senses)
      const exampleItems = sanitizeExampleItems(data.exampleItems)
      const primaryEx = exampleItems[0]
      const rowsToUpdate = toFix.filter((x) => x.word === r.word && x.target === r.target && x.native === r.native)
      for (const row of rowsToUpdate) {
        if (row.table === 'daily') {
          await adminSupabase
            .from('language_coach_daily_words')
            .update({
              meaning: data.meaning || null,
              pronunciation: data.pronunciation || null,
              meaning_items_json: senses.length > 0 ? JSON.stringify(senses) : null,
              example_items_json: exampleItems.length > 0 ? JSON.stringify(exampleItems) : null,
              usage_level: normalizeUsageLevel(data.usageLevel),
              importance_score: normalizeImportanceScore(data.importanceScore),
              is_context_sensitive: normalizeContextSensitive(data.contextSensitive),
              example_target: primaryEx?.targetText || null,
              example_native: primaryEx?.nativeText || null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', row.id)
        } else {
          await adminSupabase
            .from('language_coach_review_queue')
            .update({
              meaning: data.meaning || null,
              pronunciation: data.pronunciation || null,
              meaning_items_json: senses.length > 0 ? JSON.stringify(senses) : null,
              example_items_json: exampleItems.length > 0 ? JSON.stringify(exampleItems) : null,
              usage_level: normalizeUsageLevel(data.usageLevel),
              importance_score: normalizeImportanceScore(data.importanceScore),
              is_context_sensitive: normalizeContextSensitive(data.contextSensitive),
              updated_at: new Date().toISOString(),
            })
            .eq('id', row.id)
        }
      }
      wordsFixed++
    } catch {
      // ignore
    }
  }
}

function computeNextIntervalDays(score: number, previous: number): number {
  if (score < 3) return 1
  if (previous <= 1) return 3
  if (previous <= 3) return 7
  return Math.min(30, Math.round(previous * 1.6))
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const auth = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập để xem từ cần ôn.')
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })
    const { user } = auth
    const limitRaw = Number(request.nextUrl.searchParams.get('limit') || 10)
    const limit = Number.isFinite(limitRaw) ? Math.min(50, Math.max(1, Math.floor(limitRaw))) : 10

    const adminSupabase = adminClient()

    const { data, error } = await adminSupabase
      .from('language_coach_review_queue')
      .select('id, word, target_language, native_language, meaning, pronunciation, meaning_items_json, example_items_json, usage_level, importance_score, is_context_sensitive, due_at, repetitions, interval_days')
      .eq('user_id', user.id)
      .lte('due_at', new Date().toISOString())
      .order('due_at', { ascending: true })
      .limit(limit)
    if (error) return NextResponse.json({ error: error.message || 'Không tải được danh sách ôn tập.' }, { status: 500 })
    const senses = (row: { meaning_items_json?: string | null }) => {
      return sanitizeSenseItems(parseJsonArrayText(row.meaning_items_json))
    }
    const getExampleItems = (row: { example_items_json?: string | null }) => {
      return sanitizeExampleItems(parseJsonArrayText(row.example_items_json))
    }
    const items = (data ?? [])
      .filter(hasMeaning)
      .map((row) => {
        const si = senses(row)
        const ei = getExampleItems(row)
        const firstEx = ei[0]
        return {
          id: row.id,
          word: row.word,
          targetLanguage: row.target_language,
          nativeLanguage: row.native_language,
          meaning: row.meaning || '',
          pronunciation: row.pronunciation || '',
          senses: si,
          meaningItems: [],
          exampleItems: ei,
          exampleTarget: firstEx?.targetText || '',
          exampleNative: firstEx?.nativeText || '',
          usageLevel: normalizeUsageLevel(row.usage_level),
          importanceScore: normalizeImportanceScore(row.importance_score),
          contextSensitive: normalizeContextSensitive(row.is_context_sensitive),
          pronunciationAudioUrl: '',
          dueAt: row.due_at,
          repetitions: row.repetitions,
          intervalDays: row.interval_days,
        }
      })
    return NextResponse.json({ items })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Lỗi không xác định.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as ReviewPayload
    const id = String(payload.id || '').trim()
    const score = Math.min(5, Math.max(0, Math.floor(Number(payload.score || 3))))
    if (!id) return NextResponse.json({ error: 'Thiếu id bản ghi ôn tập.' }, { status: 400 })

    const supabase = createClient()
    const auth = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập để cập nhật ôn tập.')
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })
    const { user } = auth
    const adminSupabase = adminClient()

    const { data: rows } = await adminSupabase
      .from('language_coach_review_queue')
      .select('id, interval_days, repetitions')
      .eq('id', id)
      .eq('user_id', user.id)
      .limit(1)
    const row = Array.isArray(rows) && rows.length > 0 ? rows[0] : null
    if (!row) return NextResponse.json({ error: 'Không tìm thấy mục ôn tập.' }, { status: 404 })

    const prevInterval = Number(row.interval_days || 1)
    const prevRepetitions = Number(row.repetitions || 0)
    const nextInterval = computeNextIntervalDays(score, prevInterval)
    const repetitions = score < 3 ? 1 : prevRepetitions + 1
    const due = new Date()
    due.setDate(due.getDate() + nextInterval)

    const { error } = await adminSupabase
      .from('language_coach_review_queue')
      .update({
        repetitions,
        interval_days: nextInterval,
        due_at: due.toISOString(),
        last_reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('user_id', user.id)
    if (error) return NextResponse.json({ error: error.message || 'Không cập nhật được lịch ôn tập.' }, { status: 500 })

    return NextResponse.json({ ok: true, nextDueAt: due.toISOString(), nextIntervalDays: nextInterval })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Lỗi không xác định.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
