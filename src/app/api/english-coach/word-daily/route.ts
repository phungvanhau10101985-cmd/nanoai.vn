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
        'id, session_id, learned_date, word, target_language, native_language, meaning, pronunciation, pronunciation_audio_url, example_target, example_native, updated_at'
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

    if (!word || !sessionId) {
      return NextResponse.json({ error: 'Thiếu từ hoặc sessionId cần lưu.' }, { status: 400 })
    }

    const supabase = createClient()
    const auth = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập để lưu từ mới.')
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })
    const { user } = auth

    const adminSupabase = adminClient()
    const { data: existingReviewRows } = await adminSupabase
      .from('language_coach_review_queue')
      .select('id')
      .eq('user_id', user.id)
      .eq('word', word.slice(0, 120))
      .eq('target_language', targetLanguage || '')
      .limit(1)
    const existedInReviewQueue = Array.isArray(existingReviewRows) && existingReviewRows.length > 0

    const { error } = await adminSupabase.from('language_coach_daily_words').upsert(
      {
        user_id: user.id,
        session_id: sessionId,
        learned_date: learnedDate,
        word: word.slice(0, 120),
        target_language: targetLanguage || null,
        native_language: nativeLanguage || null,
        meaning: meaning || null,
        pronunciation: pronunciation || null,
        pronunciation_audio_url: pronunciationAudioUrl || null,
        example_target: exampleTarget || null,
        example_native: exampleNative || null,
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
          word: word.slice(0, 120),
          target_language: targetLanguage,
          native_language: nativeLanguage || null,
          meaning: meaning || null,
          pronunciation: pronunciation || null,
          due_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,word,target_language' }
      )
    }

    if (word && targetLanguage && nativeLanguage && meaning) {
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
        word: word.slice(0, 120),
        normalized_word: normalizeLookup(word).slice(0, 120),
        target_language: targetLanguage,
        normalized_target_language: normalizeLookup(targetLanguage).slice(0, 120),
        native_language: nativeLanguage,
        normalized_native_language: normalizeLookup(nativeLanguage).slice(0, 120),
        meaning: meaning.slice(0, 1500),
        pronunciation: pronunciation || null,
        example_target: exampleTarget || null,
        example_native: exampleNative || null,
        source_model: 'daily-word-save',
        last_used_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      if (pronunciationAudioUrl) sharedPayload.pronunciation_audio_url = pronunciationAudioUrl

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

