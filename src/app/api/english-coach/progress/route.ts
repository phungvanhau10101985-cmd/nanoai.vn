import { NextRequest, NextResponse } from 'next/server'
import { getUserForAction } from '@/lib/auth'
import { isPgConfigured } from '@/lib/db/pool'
import { fetchActiveLearningGoalPg } from '@/lib/db/language-coach-goals-review-pg'
import {
  countDueReviewItemsPg,
  fetchTodayProgressRowPg,
  fetchWeeklyProgressRowsPg,
  fetchDiagnosticsSamplePg,
  fetchBaselineAssessmentPg,
  fetchLatestCheckpointAssessmentPg,
  fetchRecentCheckpointScoresPg,
  fetchProgressRowForDatePg,
  fetchYesterdayStreakRowPg,
  upsertProgressDailyPg,
  insertTurnDiagnosticPg,
} from '@/lib/db/language-coach-progress-pg'

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
    if (!isPgConfigured()) {
      return NextResponse.json({ error: 'Cơ sở dữ liệu chưa cấu hình.' }, { status: 503 })
    }
    const auth = await getUserForAction()
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })
    const { user } = auth
    const today = toSafeDate(request.nextUrl.searchParams.get('date') || '')
    const targetLanguage = String(request.nextUrl.searchParams.get('targetLanguage') || '').trim()
    const currentLevelRaw = Number(request.nextUrl.searchParams.get('currentLevel') || '')
    const currentLevel = Number.isFinite(currentLevelRaw)
      ? Math.min(4, Math.max(0, Math.round(currentLevelRaw)))
      : null

    const last7From = daysAgo(today, 6)
    const diagLang = targetLanguage || 'unknown'
    const assessmentLang = targetLanguage || 'English'

    const [
      todayRow,
      dueCount,
      activeGoal,
      weeklyRows,
      diagnosticsRows,
      latestBaseline,
      latestCheckpoint,
      recentCheckpoints,
    ] = await Promise.all([
      fetchTodayProgressRowPg(user.id, today, targetLanguage),
      countDueReviewItemsPg(user.id),
      fetchActiveLearningGoalPg(user.id),
      fetchWeeklyProgressRowsPg(user.id, last7From, today),
      fetchDiagnosticsSamplePg(user.id, diagLang, 30),
      fetchBaselineAssessmentPg(user.id, assessmentLang),
      fetchLatestCheckpointAssessmentPg(user.id, assessmentLang),
      fetchRecentCheckpointScoresPg(user.id, assessmentLang, 2),
    ])

    if (
      dueCount === null ||
      weeklyRows === null ||
      diagnosticsRows === null ||
      recentCheckpoints === null
    ) {
      return NextResponse.json({ error: 'Không tải được tiến độ học.' }, { status: 500 })
    }

    const weeklyList = weeklyRows
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

    const dueReviewCount = dueCount
    const streak = Number(todayRow?.streak_days || 0)
    const badges: string[] = []
    if (streak >= 3) badges.push('streak_3')
    if (streak >= 7) badges.push('streak_7')
    if (weeklySessions >= weeklyTargetSessions) badges.push('weekly_goal_hit')
    if (dueReviewCount === 0 && Number(todayRow?.turns_count || 0) > 0) badges.push('review_zero_inbox')

    const weakWordCount = new Map<string, number>()
    for (const row of diagnosticsRows) {
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

    const checkpointList = recentCheckpoints
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
    if (!isPgConfigured()) {
      return NextResponse.json({ error: 'Cơ sở dữ liệu chưa cấu hình.' }, { status: 503 })
    }
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

    const auth = await getUserForAction()
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })
    const { user } = auth

    const date = toSafeDate(payload.localDate)
    const yesterday = yesterdayOf(date)
    const targetLangDb = targetLanguage || null

    const current = await fetchProgressRowForDatePg(user.id, date, targetLangDb)

    let streakDays = Number(current?.streak_days || 0)
    if (!current) {
      const y = await fetchYesterdayStreakRowPg(user.id, yesterday, targetLangDb)
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

    const up = await upsertProgressDailyPg({
      userId: user.id,
      progressDate: date,
      targetLanguage: targetLangDb,
      turnsCount: nextTurns,
      sessionsCount: nextSessions,
      correctedTurns: nextCorrected,
      pronunciationSamples: nextSamples,
      avgPronunciationScore: Number(nextAvg.toFixed(2)),
      streakDays,
      updatedAtIso: new Date().toISOString(),
    })
    if (!up.ok) {
      return NextResponse.json({ error: up.message || 'Không lưu được tiến độ học.' }, { status: 500 })
    }

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

      await insertTurnDiagnosticPg({
        userId: user.id,
        sessionId: sessionId || `session-${date}`,
        progressDate: date,
        targetLanguage: targetLanguage || 'unknown',
        nativeLanguage: nativeLanguage || null,
        speakingMode,
        inputSource,
        hadCorrections,
        pronunciationScore: hasPronunciationScore ? Math.round(pronunciationScore) : null,
        pronunciationAccuracy: pronAccuracy,
        pronunciationFluency: pronFluency,
        pronunciationProsody: pronProsody,
        weakWordsJson: JSON.stringify(weakWords),
        wordScoresJson: JSON.stringify(wordScores),
        inferredMeaning: String(diagnostics?.inferredMeaning || '').trim() || null,
        targetTranscript: String(diagnostics?.targetTranscript || '').trim() || null,
        nativeTranscript: String(diagnostics?.nativeTranscript || '').trim() || null,
        mergedTranscript: String(diagnostics?.mergedTranscript || '').trim() || null,
      })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Lỗi không xác định.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
