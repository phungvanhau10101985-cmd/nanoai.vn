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

function daysAgo(dateText: string, days: number): string {
  const d = new Date(`${dateText}T00:00:00.000Z`)
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
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

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const auth = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập để xem tiến độ học.')
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })
    const { user } = auth
    const adminSupabase = adminClient()
    const today = toSafeDate(request.nextUrl.searchParams.get('date') || '')
    const targetLanguage = String(request.nextUrl.searchParams.get('targetLanguage') || '').trim()
    const currentLevelRaw = Number(request.nextUrl.searchParams.get('currentLevel') || '')
    const currentLevel = Number.isFinite(currentLevelRaw)
      ? Math.min(4, Math.max(0, Math.round(currentLevelRaw)))
      : null

    const todayProgressQuery = adminSupabase
      .from('language_coach_progress_daily')
      .select('*')
      .eq('user_id', user.id)
      .eq('progress_date', today)
      .order('updated_at', { ascending: false })
      .limit(1)
    if (targetLanguage) todayProgressQuery.eq('target_language', targetLanguage)

    const last7From = daysAgo(today, 6)
    const [
      { data: todayRows },
      { data: dueRows },
      { data: activeGoal },
      { data: weeklyRows },
      { data: diagnosticsRows },
      { data: latestBaseline },
      { data: latestCheckpoint },
      { data: recentCheckpoints },
    ] = await Promise.all([
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
      adminSupabase
        .from('language_coach_progress_daily')
        .select('turns_count, sessions_count, corrected_turns, avg_pronunciation_score, progress_date')
        .eq('user_id', user.id)
        .gte('progress_date', last7From)
        .lte('progress_date', today)
        .order('progress_date', { ascending: false }),
      adminSupabase
        .from('language_coach_turn_diagnostics')
        .select('weak_words_json, word_scores_json')
        .eq('user_id', user.id)
        .eq('target_language', targetLanguage || 'unknown')
        .order('created_at', { ascending: false })
        .limit(30),
      adminSupabase
        .from('language_coach_assessments')
        .select('cefr_level, learner_level, overall_score, confidence, taken_at, summary')
        .eq('user_id', user.id)
        .eq('assessment_type', 'baseline')
        .eq('target_language', targetLanguage || 'English')
        .order('taken_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      adminSupabase
        .from('language_coach_assessments')
        .select('cefr_level, learner_level, overall_score, confidence, taken_at, summary')
        .eq('user_id', user.id)
        .eq('assessment_type', 'checkpoint')
        .eq('target_language', targetLanguage || 'English')
        .order('taken_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      adminSupabase
        .from('language_coach_assessments')
        .select('learner_level, overall_score, taken_at')
        .eq('user_id', user.id)
        .eq('assessment_type', 'checkpoint')
        .eq('target_language', targetLanguage || 'English')
        .order('taken_at', { ascending: false })
        .limit(2),
    ])

    const weeklyList = Array.isArray(weeklyRows) ? weeklyRows : []
    const weeklyTurns = weeklyList.reduce((sum, row) => sum + Number(row?.turns_count || 0), 0)
    const weeklySessions = weeklyList.reduce((sum, row) => sum + Number(row?.sessions_count || 0), 0)
    const weeklyActiveDays = weeklyList.reduce((sum, row) => sum + (Number(row?.turns_count || 0) > 0 ? 1 : 0), 0)
    const weeklyTargetSessions = Math.max(1, Number(activeGoal?.target_weekly_sessions || 5))
    const weeklyCompletionPercent = Math.min(100, Math.round((weeklySessions / weeklyTargetSessions) * 100))
    const weeklyCorrectedTurns = weeklyList.reduce((sum, row) => sum + Number(row?.corrected_turns || 0), 0)
    const weeklyCorrectionRate = weeklyTurns > 0 ? weeklyCorrectedTurns / weeklyTurns : 0
    const weeklyPronSamples = weeklyList
      .map((row) => Number(row?.avg_pronunciation_score || 0))
      .filter((x) => Number.isFinite(x) && x > 0)
    const weeklyPronAvg = weeklyPronSamples.length > 0
      ? weeklyPronSamples.reduce((sum, x) => sum + x, 0) / weeklyPronSamples.length
      : 0

    const todayRow = Array.isArray(todayRows) && todayRows.length > 0 ? todayRows[0] : null
    const dueReviewCount = dueRows?.length || 0
    const streak = Number(todayRow?.streak_days || 0)
    const badges: string[] = []
    if (streak >= 3) badges.push('streak_3')
    if (streak >= 7) badges.push('streak_7')
    if (weeklySessions >= weeklyTargetSessions) badges.push('weekly_goal_hit')
    if (dueReviewCount === 0 && Number(todayRow?.turns_count || 0) > 0) badges.push('review_zero_inbox')

    const weakWordCount = new Map<string, number>()
    for (const row of diagnosticsRows ?? []) {
      const weakWords = parseJsonArrayText(String(row?.weak_words_json || '[]'))
      weakWords.forEach((word) => {
        const key = String(word || '').trim().toLowerCase()
        if (!key) return
        weakWordCount.set(key, (weakWordCount.get(key) || 0) + 1)
      })
      const wordScores = parseJsonArrayText(String(row?.word_scores_json || '[]'))
      wordScores.forEach((item) => {
        const word = String((item as { word?: unknown })?.word || '').trim().toLowerCase()
        const score = Number((item as { score?: unknown })?.score)
        if (!word) return
        if (Number.isFinite(score) && score < 70) {
          weakWordCount.set(word, (weakWordCount.get(word) || 0) + 1)
        }
      })
    }
    const topWeakWords = [...weakWordCount.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([word]) => word)

    const deltaOverall =
      latestBaseline && latestCheckpoint
        ? Number(latestCheckpoint.overall_score || 0) - Number(latestBaseline.overall_score || 0)
        : null

    const checkpointList = Array.isArray(recentCheckpoints) ? recentCheckpoints : []
    const checkpointDelta =
      checkpointList.length >= 2
        ? Number(checkpointList[0]?.overall_score || 0) - Number(checkpointList[1]?.overall_score || 0)
        : null

    let levelRecommendation: {
      suggestedLevel: number
      direction: 'up' | 'down'
      reason: string
      confidence: number
      basedOn: string[]
    } | null = null
    if (currentLevel !== null) {
      const basedOn: string[] = []
      if (weeklySessions >= weeklyTargetSessions) basedOn.push('weekly_goal')
      if (weeklyTurns >= 20) basedOn.push('turn_volume')
      if (weeklyPronAvg >= 78) basedOn.push('pronunciation')
      if (checkpointDelta !== null) basedOn.push('checkpoint_trend')

      const shouldLevelUp =
        currentLevel < 4 &&
        weeklySessions >= weeklyTargetSessions &&
        weeklyTurns >= 20 &&
        weeklyCorrectionRate <= 0.22 &&
        weeklyPronAvg >= 75 &&
        (checkpointDelta === null || checkpointDelta >= 3)

      const shouldLevelDown =
        currentLevel > 0 &&
        weeklyTurns >= 12 &&
        weeklyCorrectionRate >= 0.58 &&
        weeklyPronAvg > 0 &&
        weeklyPronAvg < 58 &&
        (checkpointDelta === null || checkpointDelta <= -6)

      if (shouldLevelUp) {
        levelRecommendation = {
          suggestedLevel: currentLevel + 1,
          direction: 'up',
          reason:
            'Bạn đang đạt tiến độ tốt: tỷ lệ sửa lỗi thấp, điểm phát âm khá và hoàn thành mục tiêu tuần. Nên tăng level để giữ độ thử thách.',
          confidence: Math.min(95, Math.max(55, Math.round(62 + weeklyPronAvg / 5))),
          basedOn,
        }
      } else if (shouldLevelDown) {
        levelRecommendation = {
          suggestedLevel: currentLevel - 1,
          direction: 'down',
          reason:
            'Tuần này hệ thống ghi nhận nhiều lỗi cần sửa và điểm phát âm thấp. Nên giảm 1 level để củng cố nền tảng, rồi tăng lại sau.',
          confidence: Math.min(90, Math.max(55, Math.round(70 - weeklyPronAvg / 6))),
          basedOn: basedOn.length > 0 ? basedOn : ['error_rate', 'pronunciation'],
        }
      }
    }

    return NextResponse.json({
      today: todayRow,
      dueReviewCount,
      activeGoal: activeGoal || null,
      weekly: {
        turns: weeklyTurns,
        sessions: weeklySessions,
        activeDays: weeklyActiveDays,
        targetSessions: weeklyTargetSessions,
        completionPercent: weeklyCompletionPercent,
      },
      badges,
      assessment: {
        baseline: latestBaseline || null,
        checkpoint: latestCheckpoint || null,
        deltaOverall,
      },
      personalizedReview: {
        focusWords: topWeakWords,
        note:
          topWeakWords.length > 0
            ? `Ưu tiên ôn: ${topWeakWords.join(', ')}`
            : 'Chưa có đủ dữ liệu lỗi lặp lại. Hãy học thêm 1-2 buổi để hệ thống gợi ý chính xác hơn.',
      },
      levelRecommendation,
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
