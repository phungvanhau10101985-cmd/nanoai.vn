import { NextRequest, NextResponse } from 'next/server'
import { getUserForAction } from '@/lib/auth'
import { isPgConfigured } from '@/lib/db/pool'
import {
  deactivateAllLearningGoalsPg,
  fetchActiveLearningGoalPg,
  insertLearningGoalPg,
} from '@/lib/db/language-coach-goals-review-pg'

type GoalPayload = {
  goalType?: string
  title?: string
  targetLanguage?: string
  nativeLanguage?: string
  targetDays?: number
  targetDailyMinutes?: number
  targetWeeklySessions?: number
  targetPronunciationScore?: number
}

export async function GET() {
  try {
    const auth = await getUserForAction()
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })
    const { user } = auth
    if (!isPgConfigured()) {
      return NextResponse.json({ error: 'Server database is not configured.' }, { status: 503 })
    }
    const data = await fetchActiveLearningGoalPg(user.id)
    return NextResponse.json({ goal: data || null })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Lỗi không xác định.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as GoalPayload
    const goalType = String(payload.goalType || 'communication').trim()
    const title = String(payload.title || 'Mục tiêu giao tiếp theo chủ đề').trim()
    const targetLanguage = String(payload.targetLanguage || 'English').trim()
    const nativeLanguage = String(payload.nativeLanguage || 'Vietnamese').trim()
    const targetDays = Math.min(180, Math.max(7, Math.floor(Number(payload.targetDays || 30))))
    const targetDailyMinutes = Math.min(180, Math.max(5, Math.floor(Number(payload.targetDailyMinutes || 15))))
    const targetWeeklySessions = Math.min(14, Math.max(1, Math.floor(Number(payload.targetWeeklySessions || 5))))
    const targetPronunciationScore = Math.min(100, Math.max(50, Math.floor(Number(payload.targetPronunciationScore || 80))))

    const auth = await getUserForAction()
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })
    const { user } = auth
    if (!isPgConfigured()) {
      return NextResponse.json({ error: 'Server database is not configured.' }, { status: 503 })
    }

    const deactivated = await deactivateAllLearningGoalsPg(user.id)
    if (!deactivated) {
      return NextResponse.json({ error: 'Không cập nhật được mục tiêu học.' }, { status: 500 })
    }

    const endsAt = new Date()
    endsAt.setDate(endsAt.getDate() + targetDays)
    const startedAtIso = new Date().toISOString()
    const endsAtIso = endsAt.toISOString()

    const data = await insertLearningGoalPg({
      userId: user.id,
      goalType,
      title,
      targetLanguage,
      nativeLanguage,
      targetDays,
      targetDailyMinutes,
      targetWeeklySessions,
      targetPronunciationScore,
      startedAtIso,
      endsAtIso,
    })
    if (!data) {
      return NextResponse.json({ error: 'Không lưu được mục tiêu học.' }, { status: 500 })
    }
    return NextResponse.json({ goal: data })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Lỗi không xác định.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
