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

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const auth = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập để xem từ mới.')
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })
    const { user } = auth

    const dateQuery = String(request.nextUrl.searchParams.get('date') || '').trim()
    const sessionId = String(request.nextUrl.searchParams.get('sessionId') || '').trim()
    const learnedDate = toSafeDate(dateQuery || new Date().toISOString().slice(0, 10))
    const limitRaw = Number(request.nextUrl.searchParams.get('limit') || 30)
    const limit = Number.isFinite(limitRaw) ? Math.min(100, Math.max(1, Math.floor(limitRaw))) : 30

    const adminSupabase = adminClient()
    const baseQuery = adminSupabase
      .from('language_coach_daily_words')
      .select(
        'id, session_id, learned_date, word, target_language, native_language, meaning, pronunciation, pronunciation_audio_url, example_target, example_native, meaning_items_json, example_items_json, updated_at'
      )
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(limit)

    const query = sessionId ? baseQuery.eq('session_id', sessionId) : baseQuery.eq('learned_date', learnedDate)
    const { data, error } = await query

    if (error) return NextResponse.json({ error: error.message || 'Không tải được từ mới trong ngày.' }, { status: 500 })

    return NextResponse.json({
      date: learnedDate,
      items: (data ?? []).map((row) => ({
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
        updatedAt: row.updated_at,
      })),
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
      .select('meaning, pronunciation, pronunciation_audio_url, example_target, example_native, meaning_items_json, example_items_json')
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
      .select('id, meaning, pronunciation, meaning_items_json, example_items_json')
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

    return NextResponse.json({ deleted: ids.length, message: `Đã xóa ${ids.length} từ thiếu nghĩa.` })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Lỗi không xác định.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

