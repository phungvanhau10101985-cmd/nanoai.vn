import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserForAction } from '@/lib/auth'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
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
