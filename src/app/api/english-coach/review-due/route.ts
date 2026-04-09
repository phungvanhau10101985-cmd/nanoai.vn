import { NextRequest, NextResponse } from 'next/server'
import { getUserForAction } from '@/lib/auth'
import { isPgConfigured } from '@/lib/db/pool'
import {
  fetchDueReviewQueuePg,
  fetchReviewQueueSpacingPg,
  updateReviewQueueAfterReviewPg,
} from '@/lib/db/language-coach-goals-review-pg'

type ReviewPayload = {
  id?: string
  score?: number
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
    const auth = await getUserForAction()
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })
    const { user } = auth
    const limitRaw = Number(request.nextUrl.searchParams.get('limit') || 10)
    const limit = Number.isFinite(limitRaw) ? Math.min(50, Math.max(1, Math.floor(limitRaw))) : 10

    if (!isPgConfigured()) {
      return NextResponse.json({ error: 'Server database is not configured.' }, { status: 503 })
    }

    const data = await fetchDueReviewQueuePg(user.id, limit)
    if (data === null) {
      return NextResponse.json({ error: 'Không tải được danh sách ôn tập.' }, { status: 500 })
    }

    const senses = (row: { meaning_items_json?: string | null }) => {
      return sanitizeSenseItems(parseJsonArrayText(row.meaning_items_json))
    }
    const getExampleItems = (row: { example_items_json?: string | null }) => {
      return sanitizeExampleItems(parseJsonArrayText(row.example_items_json))
    }
    const items = data
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

    const auth = await getUserForAction()
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })
    const { user } = auth

    if (!isPgConfigured()) {
      return NextResponse.json({ error: 'Server database is not configured.' }, { status: 503 })
    }

    const row = await fetchReviewQueueSpacingPg(user.id, id)
    if (!row) return NextResponse.json({ error: 'Không tìm thấy mục ôn tập.' }, { status: 404 })

    const prevInterval = Number(row.interval_days || 1)
    const prevRepetitions = Number(row.repetitions || 0)
    const nextInterval = computeNextIntervalDays(score, prevInterval)
    const repetitions = score < 3 ? 1 : prevRepetitions + 1
    const due = new Date()
    due.setDate(due.getDate() + nextInterval)
    const nowIso = new Date().toISOString()

    const ok = await updateReviewQueueAfterReviewPg({
      userId: user.id,
      reviewId: id,
      repetitions,
      intervalDays: nextInterval,
      dueAtIso: due.toISOString(),
      lastReviewedAtIso: nowIso,
    })
    if (!ok) {
      return NextResponse.json({ error: 'Không cập nhật được lịch ôn tập.' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, nextDueAt: due.toISOString(), nextIntervalDays: nextInterval })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Lỗi không xác định.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
