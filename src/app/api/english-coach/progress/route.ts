import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserForAction } from '@/lib/auth'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

type ProgressPayload = {
  targetLanguage?: string
  nativeLanguage?: string
  sessionId?: string
  inputSource?: 'text' | 'mic'
  speakingMode?: 'auto' | 'target' | 'native' | 'mixed'
  pronunciationScore?: number | null
  hadCorrections?: boolean
  newSession?: boolean
  localDate?: string
  diagnostics?: {
    targetTranscript?: string
    nativeTranscript?: string
    mergedTranscript?: string
    inferredMeaning?: string
    weakWords?: string[]
    pronunciationAccuracy?: number
    pronunciationFluency?: number
    pronunciationProsody?: number
    wordScores?: Array<{
      word?: string
      score?: number
      issueType?: string
    }>
  }
}

function adminClient() {
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

function toSafeDate(input?: string): string {
  const raw = String(input || '').trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
  return new Date().toISOString().slice(0, 10)
}

function yesterdayOf(dateText: string): string {
  const d = new Date(`${dateText}T00:00:00.000Z`)
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const auth = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập để xem tiến độ học.')
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })
    const { user } = auth
    const adminSupabase = adminClient()
    const today = toSafeDate(request.nextUrl.searchParams.get('date') || '')
    const targetLanguage = String(request.nextUrl.searchParams.get('targetLanguage') || '').trim()

    const todayProgressQuery = adminSupabase
      .from('language_coach_progress_daily')
      .select('*')
      .eq('user_id', user.id)
      .eq('progress_date', today)
      .order('updated_at', { ascending: false })
      .limit(1)
    if (targetLanguage) todayProgressQuery.eq('target_language', targetLanguage)

    const [{ data: todayRows }, { data: dueRows }, { data: activeGoal }] = await Promise.all([
      todayProgressQuery,
      adminSupabase
        .from('language_coach_review_queue')
        .select('id', { count: 'exact' })
        .eq('user_id', user.id)
        .lte('due_at', new Date().toISOString()),
      adminSupabase
        .from('language_coach_learning_goals')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])

    return NextResponse.json({
      today: Array.isArray(todayRows) && todayRows.length > 0 ? todayRows[0] : null,
      dueReviewCount: dueRows?.length || 0,
      activeGoal: activeGoal || null,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Lỗi không xác định.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as ProgressPayload
    const targetLanguage = String(payload.targetLanguage || '').trim()
    const nativeLanguage = String(payload.nativeLanguage || '').trim()
    const sessionId = String(payload.sessionId || '').trim()
    const inputSource = payload.inputSource === 'mic' ? 'mic' : 'text'
    const speakingMode =
      payload.speakingMode === 'target'
        ? 'target'
        : payload.speakingMode === 'native'
          ? 'native'
          : payload.speakingMode === 'mixed'
            ? 'mixed'
            : 'auto'
    const pronunciationScore = Number(payload.pronunciationScore)
    const hasPronunciationScore = Number.isFinite(pronunciationScore) && pronunciationScore >= 0
    const hadCorrections = Boolean(payload.hadCorrections)
    const newSession = Boolean(payload.newSession)
    const diagnostics = payload.diagnostics && typeof payload.diagnostics === 'object' ? payload.diagnostics : null

    const supabase = createClient()
    const auth = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập để lưu tiến độ học.')
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })
    const { user } = auth
    const adminSupabase = adminClient()

    const date = toSafeDate(payload.localDate)
    const yesterday = yesterdayOf(date)
    const { data: todayRows } = await adminSupabase
      .from('language_coach_progress_daily')
      .select('*')
      .eq('user_id', user.id)
      .eq('progress_date', date)
      .eq('target_language', targetLanguage || null)
      .limit(1)
    const current = Array.isArray(todayRows) && todayRows.length > 0 ? todayRows[0] : null

    let streakDays = Number(current?.streak_days || 0)
    if (!current) {
      const { data: yRows } = await adminSupabase
        .from('language_coach_progress_daily')
        .select('streak_days, turns_count')
        .eq('user_id', user.id)
        .eq('progress_date', yesterday)
        .eq('target_language', targetLanguage || null)
        .limit(1)
      const y = Array.isArray(yRows) && yRows.length > 0 ? yRows[0] : null
      streakDays = y && Number(y.turns_count || 0) > 0 ? Number(y.streak_days || 0) + 1 : 1
    }

    const prevTurns = Number(current?.turns_count || 0)
    const prevSessions = Number(current?.sessions_count || 0)
    const prevCorrected = Number(current?.corrected_turns || 0)
    const prevSamples = Number(current?.pronunciation_samples || 0)
    const prevAvg = Number(current?.avg_pronunciation_score || 0)

    const nextTurns = prevTurns + 1
    const nextSessions = prevSessions + (newSession ? 1 : 0)
    const nextCorrected = prevCorrected + (hadCorrections ? 1 : 0)
    const nextSamples = prevSamples + (hasPronunciationScore ? 1 : 0)
    const nextAvg = hasPronunciationScore
      ? ((prevAvg * prevSamples) + pronunciationScore) / Math.max(1, nextSamples)
      : prevAvg

    const { error } = await adminSupabase.from('language_coach_progress_daily').upsert(
      {
        user_id: user.id,
        progress_date: date,
        target_language: targetLanguage || null,
        turns_count: nextTurns,
        sessions_count: nextSessions,
        corrected_turns: nextCorrected,
        pronunciation_samples: nextSamples,
        avg_pronunciation_score: Number(nextAvg.toFixed(2)),
        streak_days: streakDays,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,progress_date,target_language' }
    )
    if (error) return NextResponse.json({ error: error.message || 'Không lưu được tiến độ học.' }, { status: 500 })

    if (sessionId || diagnostics) {
      const weakWords = Array.isArray(diagnostics?.weakWords)
        ? diagnostics!.weakWords!.map((x) => String(x || '').trim()).filter(Boolean).slice(0, 12)
        : []
      const wordScores = Array.isArray(diagnostics?.wordScores)
        ? diagnostics!.wordScores!
          .map((x) => ({
            word: String(x?.word || '').trim(),
            score: Number.isFinite(Number(x?.score)) ? Math.min(100, Math.max(0, Math.round(Number(x?.score)))) : 0,
            issueType: String(x?.issueType || '').trim() || 'unclear',
          }))
          .filter((x) => x.word)
          .slice(0, 24)
        : []
      const pronAccuracy = Number.isFinite(Number(diagnostics?.pronunciationAccuracy))
        ? Math.min(100, Math.max(0, Math.round(Number(diagnostics?.pronunciationAccuracy))))
        : null
      const pronFluency = Number.isFinite(Number(diagnostics?.pronunciationFluency))
        ? Math.min(100, Math.max(0, Math.round(Number(diagnostics?.pronunciationFluency))))
        : null
      const pronProsody = Number.isFinite(Number(diagnostics?.pronunciationProsody))
        ? Math.min(100, Math.max(0, Math.round(Number(diagnostics?.pronunciationProsody))))
        : null

      await adminSupabase.from('language_coach_turn_diagnostics').insert({
        user_id: user.id,
        session_id: sessionId || `session-${date}`,
        progress_date: date,
        target_language: targetLanguage || 'unknown',
        native_language: nativeLanguage || null,
        speaking_mode: speakingMode,
        input_source: inputSource,
        had_corrections: hadCorrections,
        pronunciation_score: hasPronunciationScore ? Math.round(pronunciationScore) : null,
        pronunciation_accuracy: pronAccuracy,
        pronunciation_fluency: pronFluency,
        pronunciation_prosody: pronProsody,
        weak_words_json: JSON.stringify(weakWords),
        word_scores_json: JSON.stringify(wordScores),
        inferred_meaning: String(diagnostics?.inferredMeaning || '').trim() || null,
        target_transcript: String(diagnostics?.targetTranscript || '').trim() || null,
        native_transcript: String(diagnostics?.nativeTranscript || '').trim() || null,
        merged_transcript: String(diagnostics?.mergedTranscript || '').trim() || null,
      })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Lỗi không xác định.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
