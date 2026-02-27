import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserForAction } from '@/lib/auth'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

type DailyWordPayload = {
  learnedDate?: string
  sessionId?: string
  word?: string
  targetLanguage?: string
  nativeLanguage?: string
  meaning?: string
  pronunciation?: string
  exampleTarget?: string
  exampleNative?: string
  pronunciationAudioUrl?: string
  meaningItems?: unknown[]
  exampleItems?: unknown[]
  usageLevel?: string
  importanceScore?: number
  contextSensitive?: boolean
}

function adminClient() {
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

function toSafeDate(input: string): string {
  const value = input.trim()
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : new Date().toISOString().slice(0, 10)
}

function normalizeLookup(input: string): string {
  return String(input || '').trim().toLowerCase()
}

function preferIncomingOrExisting(incoming: string, existing?: string | null): string | null {
  const nextValue = String(incoming || '').trim()
  if (nextValue) return nextValue
  const oldValue = String(existing || '').trim()
  return oldValue || null
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

function preferIncomingOrExistingLevel(
  incoming: unknown,
  existing?: string | null
): 'high' | 'medium' | 'low' {
  const incomingRaw = String(incoming || '').trim()
  if (incomingRaw) return normalizeUsageLevel(incomingRaw)
  return normalizeUsageLevel(existing)
}

function preferIncomingOrExistingScore(incoming: unknown, existing?: number | null): number {
  if (incoming !== undefined && incoming !== null && String(incoming).trim() !== '') {
    return normalizeImportanceScore(incoming)
  }
  return normalizeImportanceScore(existing)
}

function preferIncomingOrExistingContextSensitive(incoming: unknown, existing?: boolean | null): boolean {
  if (incoming !== undefined && incoming !== null && String(incoming).trim() !== '') {
    return normalizeContextSensitive(incoming)
  }
  return normalizeContextSensitive(existing)
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

function mergeMeaningItems(
  incoming: Array<{ text: string; pinyin?: string }>,
  existingJson: string | null | undefined,
  fallbackMeaning: string
): Array<{ text: string; pinyin?: string }> {
  if (incoming.length > 0) return incoming
  const existing = sanitizeMeaningItems(parseJsonArrayText(existingJson))
  if (existing.length > 0) return existing
  const fallback = String(fallbackMeaning || '').trim()
  return fallback ? [{ text: fallback }] : []
}

function mergeExampleItems(
  incoming: Array<{ targetText: string; targetPinyin?: string; nativeText: string }>,
  existingJson: string | null | undefined,
  fallbackTarget: string | null,
  fallbackNative: string | null,
  fallbackPinyin?: string | null
): Array<{ targetText: string; targetPinyin?: string; nativeText: string }> {
  if (incoming.length > 0) return incoming
  const existing = sanitizeExampleItems(parseJsonArrayText(existingJson))
  if (existing.length > 0) return existing
  const target = String(fallbackTarget || '').trim()
  const native = String(fallbackNative || '').trim()
  const pinyin = String(fallbackPinyin || '').trim()
  return target && native ? [{ targetText: target, targetPinyin: pinyin || undefined, nativeText: native }] : []
}

function hasMeaning(row: { meaning?: string | null; meaning_items_json?: string | null }): boolean {
  const meaning = String(row.meaning ?? '').trim()
  if (meaning) return true
  const items = parseJsonArrayText(row.meaning_items_json)
  return Array.isArray(items) && items.some((x) => String((x as { text?: unknown })?.text ?? '').trim())
}

const hasCjk = (s: string) => /[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/.test(s)

function exampleItemsNeedFix(items: Array<{ targetText?: string }>, targetLang: string | null): boolean {
  const norm = String(targetLang || '').toLowerCase()
  if (!norm.includes('chinese') && !norm.includes('zh') && !norm.includes('mandarin') && !norm.includes('japanese') && !norm.includes('ja') && !norm.includes('korean') && !norm.includes('ko')) return false
  for (const item of items) {
    const t = String(item.targetText || '').trim()
    if (t && !hasCjk(t)) return true
  }
  return false
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
  const items = parseJsonArrayText(row.meaning_items_json)
  return String((items[0] as { text?: unknown })?.text ?? '').trim()
}

/** Nghĩa đang ở ngôn ngữ đích (CJK) thay vì mẹ đẻ */
function meaningInWrongLanguage(row: {
  meaning?: string | null
  meaning_items_json?: string | null
  target_language?: string | null
  native_language?: string | null
}): boolean {
  if (!isTargetCjk(row.target_language)) return false
  if (isNativeCjk(row.native_language)) return false
  const text = getMeaningText(row)
  if (!text) return false
  return hasCjk(text)
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
    .eq('enrich_attempted', false) // Chỉ chọn những từ chưa thử

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
    .eq('enrich_attempted', false) // Chỉ chọn những từ chưa thử

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
  if (byKey.size > 0) {
    console.log(`[WORD-FIX] Found ${byKey.size} unique words needing enrichment for user ${userId}.`)
  }
  const maxFix = 10
  let wordsFixed = 0
  for (const [, r] of byKey) {
    if (wordsFixed >= maxFix) {
      console.log(`[WORD-FIX] Reached fix limit of ${maxFix}. Remaining words will be fixed on next request.`)
      break
    }
    try {
      // Đánh dấu đã thử ngay lập tức để không thử lại
      const rowsToMark = toFix.filter((x) => x.word === r.word && x.target === r.target && x.native === r.native)
      for (const row of rowsToMark) {
        const tableName = row.table === 'daily' ? 'language_coach_daily_words' : 'language_coach_review_queue'
        await adminSupabase.from(tableName).update({ enrich_attempted: true }).eq('id', row.id)
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
        usageLevel?: string
        importanceScore?: number
        contextSensitive?: boolean
      }
      if (!res.ok || !data.meaning) {
        console.error(`[WORD-FIX] Failed to get meaning for "${r.word}". Status: ${res.status}. It will not be retried.`)
        continue
      }
      const meaningItems = sanitizeMeaningItems(data.meaningItems)
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
              meaning_items_json: meaningItems.length > 0 ? JSON.stringify(meaningItems) : null,
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
              meaning_items_json: meaningItems.length > 0 ? JSON.stringify(meaningItems) : null,
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
      console.log(`[WORD-FIX] Successfully fixed data for word "${r.word}". Total fixed: ${wordsFixed}/${byKey.size}`)
    } catch (e) {
      console.error(`[WORD-FIX] Error fixing word "${r.word}":`, e)
    }
  }

  // Chuẩn hóa nghĩa mẹ đẻ sai (CJK thay vì native) - chạy tự động 1 lần
  try {
    const { data: dailyMeaningRows } = await adminSupabase
      .from('language_coach_daily_words')
      .select('id, user_id, word, target_language, native_language, meaning, meaning_items_json')
      .eq('user_id', userId)
      .eq('meaning_fix_attempted', false)

    const meaningToFix: Array<{ table: 'daily' | 'review'; id: string; word: string; target: string; native: string }> = []
    for (const r of dailyMeaningRows ?? []) {
      if (meaningInWrongLanguage(r)) {
        meaningToFix.push({
          table: 'daily',
          id: r.id,
          word: r.word,
          target: r.target_language || 'Chinese',
          native: r.native_language || 'Vietnamese',
        })
      }
    }

    const { data: reviewMeaningRows } = await adminSupabase
      .from('language_coach_review_queue')
      .select('id, user_id, word, target_language, native_language, meaning, meaning_items_json')
      .eq('user_id', userId)
      .eq('meaning_fix_attempted', false)

    for (const r of reviewMeaningRows ?? []) {
      if (meaningInWrongLanguage(r)) {
        meaningToFix.push({
          table: 'review',
          id: r.id,
          word: r.word,
          target: r.target_language || 'Chinese',
          native: r.native_language || 'Vietnamese',
        })
      }
    }

    const meaningByKey = new Map<string, (typeof meaningToFix)[0]>()
    for (const r of meaningToFix) {
      const k = `${r.word}::${r.target}::${r.native}`
      if (!meaningByKey.has(k)) meaningByKey.set(k, r)
    }

    let meaningFixed = 0
    for (const [, r] of meaningByKey) {
      if (meaningFixed >= 5) break
      const rowsToMark = meaningToFix.filter((x) => x.word === r.word && x.target === r.target && x.native === r.native)
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
          meaningItems?: Array<{ text: string; pinyin?: string }>
          exampleItems?: Array<{ targetText: string; targetPinyin?: string; nativeText: string }>
          usageLevel?: string
          importanceScore?: number
          contextSensitive?: boolean
        }

        if (!res.ok || !data.meaning) {
          const errMsg = (data as { error?: string }).error || `Status ${res.status}`
          for (const row of rowsToMark) {
            await adminSupabase.from('language_coach_meaning_fix_failed').insert({
              word: r.word,
              target_language: r.target,
              native_language: r.native,
              user_id: userId,
              source_table: row.table === 'daily' ? 'language_coach_daily_words' : 'language_coach_review_queue',
              source_id: row.id,
              error_message: errMsg,
            })
          }
          continue
        }

        const meaningItems = sanitizeMeaningItems(data.meaningItems)
        const exampleItems = sanitizeExampleItems(data.exampleItems)
        const primaryEx = exampleItems[0]

        for (const row of rowsToMark) {
          if (row.table === 'daily') {
            await adminSupabase
              .from('language_coach_daily_words')
              .update({
                meaning: data.meaning || null,
                meaning_items_json: meaningItems.length > 0 ? JSON.stringify(meaningItems) : null,
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
                meaning_items_json: meaningItems.length > 0 ? JSON.stringify(meaningItems) : null,
                example_items_json: exampleItems.length > 0 ? JSON.stringify(exampleItems) : null,
                usage_level: normalizeUsageLevel(data.usageLevel),
                importance_score: normalizeImportanceScore(data.importanceScore),
                is_context_sensitive: normalizeContextSensitive(data.contextSensitive),
                updated_at: new Date().toISOString(),
              })
              .eq('id', row.id)
          }
        }
        meaningFixed++
        console.log(`[MEANING-FIX] Fixed native meaning for "${r.word}"`)
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : 'Lỗi không xác định'
        for (const row of rowsToMark) {
          await adminSupabase.from('language_coach_meaning_fix_failed').insert({
            word: r.word,
            target_language: r.target,
            native_language: r.native,
            user_id: userId,
            source_table: row.table === 'daily' ? 'language_coach_daily_words' : 'language_coach_review_queue',
            source_id: row.id,
            error_message: errMsg,
          })
        }
      }
    }
  } catch (e) {
    console.warn('[MEANING-FIX] Skip (column meaning_fix_attempted may not exist):', e)
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const auth = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập để xem từ mới.')
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })
    const { user } = auth

    const adminSupabase = adminClient()
    const baseUrl = request.nextUrl.origin || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
    void normalizeIncompleteWords(adminSupabase, user.id, baseUrl)

    const dateQuery = String(request.nextUrl.searchParams.get('date') || '').trim()
    const sessionId = String(request.nextUrl.searchParams.get('sessionId') || '').trim()
    const limitRaw = Number(request.nextUrl.searchParams.get('limit') || 30)
    const limit = Number.isFinite(limitRaw) ? Math.min(100, Math.max(1, Math.floor(limitRaw))) : 30

    let learnedDate: string
    let previousSessionId = ''
    if (sessionId) {
      learnedDate = new Date().toISOString().slice(0, 10)
    } else if (dateQuery === 'last' || dateQuery === 'previous') {
      const { data: latestSessionRows } = await adminSupabase
        .from('language_coach_daily_words')
        .select('session_id, learned_date')
        .eq('user_id', user.id)
        .not('session_id', 'is', null)
        .order('updated_at', { ascending: false })
        .limit(1)
      previousSessionId = String(latestSessionRows?.[0]?.session_id || '').trim()

      const { data: maxRow } = await adminSupabase
        .from('language_coach_daily_words')
        .select('learned_date')
        .eq('user_id', user.id)
        .order('learned_date', { ascending: false })
        .limit(1)
      learnedDate = maxRow?.[0]?.learned_date
        ? String(maxRow[0].learned_date).slice(0, 10)
        : new Date().toISOString().slice(0, 10)
    } else {
      learnedDate = toSafeDate(dateQuery || new Date().toISOString().slice(0, 10))
    }

    const baseQuery = adminSupabase
      .from('language_coach_daily_words')
      .select(
        'id, session_id, learned_date, word, target_language, native_language, meaning, pronunciation, pronunciation_audio_url, example_target, example_native, meaning_items_json, example_items_json, usage_level, importance_score, is_context_sensitive, updated_at'
      )
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(limit)

    const effectiveSessionId = sessionId || previousSessionId
    const query = effectiveSessionId ? baseQuery.eq('session_id', effectiveSessionId) : baseQuery.eq('learned_date', learnedDate)
    const { data, error } = await query

    if (error) return NextResponse.json({ error: error.message || 'Không tải được từ mới trong ngày.' }, { status: 500 })

    const hasMeaning = (row: { meaning?: string | null; meaning_items_json?: string | null }) => {
      const meaning = String(row.meaning ?? '').trim()
      if (meaning) return true
      const items = parseJsonArrayText(row.meaning_items_json)
      return Array.isArray(items) && items.some((x) => String((x as { text?: unknown })?.text ?? '').trim())
    }

    const mapped = (data ?? [])
      .filter(hasMeaning)
      .map((row) => ({
        id: row.id,
        sessionId: row.session_id,
        learnedDate: row.learned_date,
        word: row.word,
        targetLanguage: row.target_language,
        nativeLanguage: row.native_language,
        meaning: row.meaning || '',
        pronunciation: row.pronunciation || '',
        pronunciationAudioUrl: row.pronunciation_audio_url || '',
        exampleTarget: row.example_target || '',
        exampleNative: row.example_native || '',
        meaningItems: sanitizeMeaningItems(parseJsonArrayText(row.meaning_items_json || '')),
        exampleItems: sanitizeExampleItems(parseJsonArrayText(row.example_items_json || '')),
        usageLevel: normalizeUsageLevel(row.usage_level),
        importanceScore: normalizeImportanceScore(row.importance_score),
        contextSensitive: normalizeContextSensitive(row.is_context_sensitive),
        updatedAt: row.updated_at,
      }))

    return NextResponse.json({
      date: learnedDate,
      items: mapped,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Lỗi không xác định.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as DailyWordPayload
    const learnedDate = toSafeDate(String(payload.learnedDate || new Date().toISOString().slice(0, 10)))
    const sessionId = String(payload.sessionId || '').trim()
    const word = String(payload.word || '').trim()
    const targetLanguage = String(payload.targetLanguage || '').trim()
    const nativeLanguage = String(payload.nativeLanguage || '').trim()
    const meaning = String(payload.meaning || '').trim()
    const pronunciation = String(payload.pronunciation || '').trim()
    const exampleTarget = String(payload.exampleTarget || '').trim()
    const exampleNative = String(payload.exampleNative || '').trim()
    const pronunciationAudioUrl = String(payload.pronunciationAudioUrl || '').trim()
    const usageLevel = preferIncomingOrExistingLevel(payload.usageLevel, null)
    const importanceScore = preferIncomingOrExistingScore(payload.importanceScore, null)
    const contextSensitive = preferIncomingOrExistingContextSensitive(payload.contextSensitive, null)
    const incomingMeaningItems = sanitizeMeaningItems(payload.meaningItems)
    const incomingExampleItems = sanitizeExampleItems(payload.exampleItems)

    if (!word || !sessionId) {
      return NextResponse.json({ error: 'Thiếu từ hoặc sessionId cần lưu.' }, { status: 400 })
    }

    const supabase = createClient()
    const auth = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập để lưu từ mới.')
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })
    const { user } = auth

    const adminSupabase = adminClient()
    const normalizedWord = word.slice(0, 120)
    const normalizedTargetLanguage = targetLanguage || null
    let existingDailyQuery = adminSupabase
      .from('language_coach_daily_words')
      .select('meaning, pronunciation, pronunciation_audio_url, example_target, example_native, meaning_items_json, example_items_json, usage_level, importance_score, is_context_sensitive')
      .eq('user_id', user.id)
      .eq('session_id', sessionId)
      .eq('word', normalizedWord)
      .limit(1)
    existingDailyQuery = normalizedTargetLanguage
      ? existingDailyQuery.eq('target_language', normalizedTargetLanguage)
      : existingDailyQuery.is('target_language', null)
    const { data: existingDailyRows } = await existingDailyQuery
    const existingDailyRow = Array.isArray(existingDailyRows) ? existingDailyRows[0] : null

    const mergedMeaning = preferIncomingOrExisting(meaning, existingDailyRow?.meaning)
    const mergedPronunciation = preferIncomingOrExisting(pronunciation, existingDailyRow?.pronunciation)
    const mergedPronunciationAudioUrl = preferIncomingOrExisting(
      pronunciationAudioUrl,
      existingDailyRow?.pronunciation_audio_url
    )
    const mergedExampleTarget = preferIncomingOrExisting(exampleTarget, existingDailyRow?.example_target)
    const mergedExampleNative = preferIncomingOrExisting(exampleNative, existingDailyRow?.example_native)
    const mergedUsageLevel = preferIncomingOrExistingLevel(usageLevel, existingDailyRow?.usage_level)
    const mergedImportanceScore = preferIncomingOrExistingScore(importanceScore, existingDailyRow?.importance_score)
    const mergedContextSensitive = preferIncomingOrExistingContextSensitive(
      contextSensitive,
      existingDailyRow?.is_context_sensitive
    )
    const mergedMeaningItems = mergeMeaningItems(incomingMeaningItems, existingDailyRow?.meaning_items_json, mergedMeaning || '')

    const hasMeaning = (mergedMeaning?.length ?? 0) > 0 || mergedMeaningItems.length > 0
    if (!hasMeaning) {
      return NextResponse.json(
        { error: 'Thiếu nghĩa. Không lưu từ thiếu thông tin. Vui lòng bấm từ để phân tích nghĩa trước khi lưu.' },
        { status: 400 }
      )
    }
    const mergedExampleItems = mergeExampleItems(
      incomingExampleItems,
      existingDailyRow?.example_items_json,
      mergedExampleTarget,
      mergedExampleNative,
      mergedPronunciation
    )
    const primaryExample = mergedExampleItems[0] || null

    const { data: existingReviewRows } = await adminSupabase
      .from('language_coach_review_queue')
      .select('id, meaning, pronunciation, meaning_items_json, example_items_json, usage_level, importance_score, is_context_sensitive')
      .eq('user_id', user.id)
      .eq('word', normalizedWord)
      .eq('target_language', targetLanguage || '')
      .limit(1)
    const existedInReviewQueue = Array.isArray(existingReviewRows) && existingReviewRows.length > 0
    const existingReviewRow = Array.isArray(existingReviewRows) && existingReviewRows.length > 0 ? existingReviewRows[0] : null

    const mergedReviewMeaning = preferIncomingOrExisting(mergedMeaning || '', existingReviewRow?.meaning)
    const mergedReviewPronunciation = preferIncomingOrExisting(mergedPronunciation || '', existingReviewRow?.pronunciation)
    const mergedReviewMeaningItems = mergeMeaningItems(
      mergedMeaningItems,
      existingReviewRow?.meaning_items_json,
      mergedReviewMeaning || ''
    )
    const mergedReviewExampleItems = mergeExampleItems(
      mergedExampleItems,
      existingReviewRow?.example_items_json,
      primaryExample?.targetText || mergedExampleTarget,
      primaryExample?.nativeText || mergedExampleNative,
      mergedReviewPronunciation
    )
    const mergedReviewUsageLevel = preferIncomingOrExistingLevel(mergedUsageLevel, existingReviewRow?.usage_level)
    const mergedReviewImportanceScore = preferIncomingOrExistingScore(
      mergedImportanceScore,
      existingReviewRow?.importance_score
    )
    const mergedReviewContextSensitive = preferIncomingOrExistingContextSensitive(
      mergedContextSensitive,
      existingReviewRow?.is_context_sensitive
    )

    const { error } = await adminSupabase.from('language_coach_daily_words').upsert(
      {
        user_id: user.id,
        session_id: sessionId,
        learned_date: learnedDate,
        word: normalizedWord,
        target_language: normalizedTargetLanguage,
        native_language: nativeLanguage || null,
        meaning: mergedMeaning,
        pronunciation: mergedPronunciation,
        pronunciation_audio_url: mergedPronunciationAudioUrl,
        example_target: primaryExample?.targetText || mergedExampleTarget,
        example_native: primaryExample?.nativeText || mergedExampleNative,
        meaning_items_json: mergedMeaningItems.length > 0 ? JSON.stringify(mergedMeaningItems) : null,
        example_items_json: mergedExampleItems.length > 0 ? JSON.stringify(mergedExampleItems) : null,
        usage_level: mergedUsageLevel,
        importance_score: mergedImportanceScore,
        is_context_sensitive: mergedContextSensitive,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'user_id,session_id,word,target_language',
      }
    )

    if (error) return NextResponse.json({ error: error.message || 'Không lưu được từ mới.' }, { status: 500 })

    if (word && targetLanguage) {
      await adminSupabase.from('language_coach_review_queue').upsert(
        {
          user_id: user.id,
          word: normalizedWord,
          target_language: targetLanguage,
          native_language: nativeLanguage || null,
          meaning: mergedReviewMeaning,
          pronunciation: mergedReviewPronunciation,
          meaning_items_json: mergedReviewMeaningItems.length > 0 ? JSON.stringify(mergedReviewMeaningItems) : null,
          example_items_json: mergedReviewExampleItems.length > 0 ? JSON.stringify(mergedReviewExampleItems) : null,
          usage_level: mergedReviewUsageLevel,
          importance_score: mergedReviewImportanceScore,
          is_context_sensitive: mergedReviewContextSensitive,
          due_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,word,target_language' }
      )
    }

    if (word && targetLanguage && nativeLanguage && mergedMeaning) {
      const sharedPayload: {
        word: string
        normalized_word: string
        target_language: string
        normalized_target_language: string
        native_language: string
        normalized_native_language: string
        part_of_speech?: string | null
        meaning: string
        pronunciation?: string | null
        example_target?: string | null
        example_native?: string | null
        pronunciation_audio_url?: string | null
        usage_level?: 'high' | 'medium' | 'low' | null
        importance_score?: number | null
        is_context_sensitive?: boolean | null
        source_model: string
        last_used_at: string
        updated_at: string
      } = {
        word: normalizedWord,
        normalized_word: normalizeLookup(word).slice(0, 120),
        target_language: targetLanguage,
        normalized_target_language: normalizeLookup(targetLanguage).slice(0, 120),
        native_language: nativeLanguage,
        normalized_native_language: normalizeLookup(nativeLanguage).slice(0, 120),
        meaning: mergedMeaning.slice(0, 1500),
        pronunciation: mergedPronunciation,
        example_target: primaryExample?.targetText || mergedExampleTarget,
        example_native: primaryExample?.nativeText || mergedExampleNative,
        meaning_items_json: mergedMeaningItems.length > 0 ? JSON.stringify(mergedMeaningItems) : null,
        example_items_json: mergedExampleItems.length > 0 ? JSON.stringify(mergedExampleItems) : null,
        usage_level: mergedUsageLevel,
        importance_score: mergedImportanceScore,
        is_context_sensitive: mergedContextSensitive,
        source_model: 'daily-word-save',
        last_used_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      if (mergedPronunciationAudioUrl) sharedPayload.pronunciation_audio_url = mergedPronunciationAudioUrl

      await adminSupabase.from('language_coach_vocab_cache').upsert(
        sharedPayload,
        { onConflict: 'normalized_word,normalized_target_language,normalized_native_language' }
      )
    }

    if (!existedInReviewQueue && targetLanguage) {
      await adminSupabase.rpc('increment_language_coach_progress_new_words', {
        p_user_id: user.id,
        p_progress_date: learnedDate,
        p_target_language: targetLanguage,
        p_inc: 1,
      })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Lỗi không xác định.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = createClient()
    const auth = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập.')
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })
    const { user } = auth

    const cleanup = String(request.nextUrl.searchParams.get('cleanup') || '').trim()
    if (cleanup !== 'incomplete' && cleanup !== 'all') {
      return NextResponse.json(
        { error: 'Thiếu ?cleanup=incomplete (xóa từ thiếu nghĩa) hoặc ?cleanup=all (xóa hết để lưu lại từ đầu).' },
        { status: 400 }
      )
    }

    const adminSupabase = adminClient()

    if (cleanup === 'all') {
      const { data: deletedDaily, error: dailyErr } = await adminSupabase
        .from('language_coach_daily_words')
        .delete()
        .eq('user_id', user.id)
        .select('id')

      if (dailyErr) return NextResponse.json({ error: dailyErr.message }, { status: 500 })

      const { data: deletedReview, error: reviewErr } = await adminSupabase
        .from('language_coach_review_queue')
        .delete()
        .eq('user_id', user.id)
        .select('id')

      if (reviewErr) return NextResponse.json({ error: reviewErr.message }, { status: 500 })

      const dailyCount = deletedDaily?.length ?? 0
      const reviewCount = deletedReview?.length ?? 0
      const total = dailyCount + reviewCount
      return NextResponse.json({
        deleted: total,
        message: `Đã xóa hết dữ liệu đã lưu (${dailyCount} từ mới + ${reviewCount} mục ôn tập). Có thể lưu lại từ đầu.`,
      })
    }

    const { data: rows, error } = await adminSupabase
      .from('language_coach_daily_words')
      .select('id, meaning, meaning_items_json')
      .eq('user_id', user.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const ids = (rows ?? [])
      .filter((r) => {
        const meaning = String(r.meaning ?? '').trim()
        const items = parseJsonArrayText(r.meaning_items_json)
        const hasMeaningItems = Array.isArray(items) && items.some((x) => String((x as { text?: unknown })?.text ?? '').trim())
        return !meaning && !hasMeaningItems
      })
      .map((r) => r.id)
      .filter(Boolean)
    if (ids.length === 0) {
      return NextResponse.json({ deleted: 0, message: 'Không có từ thiếu nghĩa.' })
    }

    const { error: delError } = await adminSupabase
      .from('language_coach_daily_words')
      .delete()
      .eq('user_id', user.id)
      .in('id', ids)

    if (delError) return NextResponse.json({ error: delError.message }, { status: 500 })

    const { data: reviewRows } = await adminSupabase
      .from('language_coach_review_queue')
      .select('id, meaning, meaning_items_json')
      .eq('user_id', user.id)

    const reviewIds = (reviewRows ?? [])
      .filter((r) => {
        const meaning = String(r.meaning ?? '').trim()
        const items = parseJsonArrayText(r.meaning_items_json)
        const hasMeaningItems = Array.isArray(items) && items.some((x) => String((x as { text?: unknown })?.text ?? '').trim())
        return !meaning && !hasMeaningItems
      })
      .map((r) => r.id)
      .filter(Boolean)

    if (reviewIds.length > 0) {
      const { error: reviewDelErr } = await adminSupabase
        .from('language_coach_review_queue')
        .delete()
        .eq('user_id', user.id)
        .in('id', reviewIds)
      if (!reviewDelErr) {
        return NextResponse.json({
          deleted: ids.length + reviewIds.length,
          message: `Đã xóa ${ids.length} từ mới + ${reviewIds.length} mục ôn tập thiếu nghĩa.`,
        })
      }
    }

    return NextResponse.json({ deleted: ids.length, message: `Đã xóa ${ids.length} từ thiếu nghĩa.` })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Lỗi không xác định.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

