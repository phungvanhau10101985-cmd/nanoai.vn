import { NextRequest, NextResponse } from 'next/server'
import { getUserForAction } from '@/lib/auth'
import { hasCompleteClassMemberProfileForExamPg } from '@/lib/db/classes-pg'
import {
  fetchExamAttemptFullForUserGetRoutePg,
  fetchExamSessionActiveForStudentFlowPg,
  touchExamAttemptLastSeenPg,
} from '@/lib/db/exam-session-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { verifyExamLayoutToken } from '@/lib/exam-layout-token'
import { CLASS_ENROLLMENT_ERROR_VI } from '@/lib/lop/require-class-enrollment'
import { isExamSignalLost } from '@/lib/exam-session/exam-presence'
import {
  fetchAlreadySubmittedPayloadForAttemptPg,
  finalizedAttemptClientJson,
  isServerDeadlinePassed,
  tryFinalizeOpenExamAttemptPg,
  tryFinalizeOverdueExamAttemptPg,
  tryFinalizeSignalLostExamAttemptPg,
} from '@/lib/exam-session/finalize-overdue-exam-attempt'

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, max-age=0, must-revalidate',
}

/** Bài thi tính điểm: gia hạn tín hiệu sống, hoặc nộp nháp nếu đã quá ngưỡng / hết giờ. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const auth = await getUserForAction('Vui lòng đăng nhập.')
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: 401, headers: NO_STORE_HEADERS })
    }
    const user = auth.user
    const { code } = await params
    if (!code || code.length < 4) {
      return NextResponse.json({ error: 'Mã bài thi không hợp lệ.' }, { status: 400, headers: NO_STORE_HEADERS })
    }
    const body = await req.json().catch(() => ({}))
    const layoutToken = String(body?.layoutToken ?? '').trim()
    if (!layoutToken) {
      return NextResponse.json({ error: 'Thiếu layoutToken.' }, { status: 400, headers: NO_STORE_HEADERS })
    }
    if (!isPgConfigured()) {
      return NextResponse.json({ error: 'Chưa cấu hình cơ sở dữ liệu.' }, { status: 503, headers: NO_STORE_HEADERS })
    }

    const sessionRow = await fetchExamSessionActiveForStudentFlowPg(code.toUpperCase())
    if (sessionRow === null) {
      return NextResponse.json({ error: 'Lỗi đọc bài thi.' }, { status: 500, headers: NO_STORE_HEADERS })
    }
    if (sessionRow === 'not_found') {
      return NextResponse.json({ error: 'Không tìm thấy bài thi.' }, { status: 404, headers: NO_STORE_HEADERS })
    }
    if (sessionRow.is_practice_homework) {
      return NextResponse.json({ ok: true, skipped: true }, { headers: NO_STORE_HEADERS })
    }

    const layout = await verifyExamLayoutToken(layoutToken)
    if (!layout || layout.sessionId !== String(sessionRow.id) || layout.userId !== user.id) {
      return NextResponse.json(
        { error: 'Phiên làm bài không hợp lệ hoặc đã hết hạn.' },
        { status: 400, headers: NO_STORE_HEADERS }
      )
    }

    if (sessionRow.class_id) {
      const ok = await hasCompleteClassMemberProfileForExamPg(String(sessionRow.class_id), user.id)
      if (ok === null) {
        return NextResponse.json({ error: 'Lỗi kiểm tra tham gia lớp.' }, { status: 500, headers: NO_STORE_HEADERS })
      }
      if (!ok) {
        return NextResponse.json({ error: CLASS_ENROLLMENT_ERROR_VI }, { status: 403, headers: NO_STORE_HEADERS })
      }
    }

    const attempt = await fetchExamAttemptFullForUserGetRoutePg(sessionRow.id, user.id)
    if (!attempt) {
      return NextResponse.json({ error: 'Không có phiên làm bài đang mở.' }, { status: 400, headers: NO_STORE_HEADERS })
    }
    if (attempt.submitted_at) {
      const saved = await fetchAlreadySubmittedPayloadForAttemptPg(
        attempt.id,
        false,
        '',
        sessionRow.duration_minutes
      )
      if (saved) {
        return NextResponse.json({ ...saved, classId: sessionRow.class_id ?? null }, { headers: NO_STORE_HEADERS })
      }
      return NextResponse.json({ alreadySubmitted: true }, { headers: NO_STORE_HEADERS })
    }

    const serverNowMs = Date.now()
    const title = sessionRow.title.trim()
    if (
      isServerDeadlinePassed(attempt.deadline_at, attempt.started_at, sessionRow.duration_minutes, serverNowMs)
    ) {
      const finalized = await tryFinalizeOverdueExamAttemptPg({
        sessionId: String(sessionRow.id),
        sessionTitle: title,
        durationMinutes: sessionRow.duration_minutes,
        practiceHomework: false,
        attemptId: attempt.id,
        layoutSnapshot: attempt.layout_snapshot,
        answers: attempt.answers,
        essaySubmission: attempt.essay_submission,
        serverNowMs,
      })
      if (finalized) {
        return NextResponse.json(finalizedAttemptClientJson(finalized, sessionRow.class_id ?? null), {
          headers: NO_STORE_HEADERS,
        })
      }
    }

    if (isExamSignalLost(attempt.last_seen_at, serverNowMs)) {
      const lost = await tryFinalizeSignalLostExamAttemptPg({
        sessionId: String(sessionRow.id),
        sessionTitle: title,
        durationMinutes: sessionRow.duration_minutes,
        practiceHomework: false,
        attemptId: attempt.id,
        layoutSnapshot: attempt.layout_snapshot,
        answers: attempt.answers,
        essaySubmission: attempt.essay_submission,
        lastSeenAt: attempt.last_seen_at,
        serverNowMs,
      })
      if (lost) {
        return NextResponse.json(finalizedAttemptClientJson(lost, sessionRow.class_id ?? null), {
          headers: NO_STORE_HEADERS,
        })
      }
      const saved = await fetchAlreadySubmittedPayloadForAttemptPg(
        attempt.id,
        false,
        title,
        sessionRow.duration_minutes
      )
      if (saved) {
        return NextResponse.json({ ...saved, classId: sessionRow.class_id ?? null }, { headers: NO_STORE_HEADERS })
      }
      return NextResponse.json(
        { error: 'Bài thi đã mất tín hiệu. Vui lòng tải lại trang.' },
        { status: 409, headers: NO_STORE_HEADERS }
      )
    }

    const touched = await touchExamAttemptLastSeenPg(attempt.id, user.id)
    if (touched === 'stale' || touched === 'closed') {
      const lost =
        touched === 'stale'
          ? await tryFinalizeOpenExamAttemptPg({
              sessionId: String(sessionRow.id),
              sessionTitle: title,
              durationMinutes: sessionRow.duration_minutes,
              practiceHomework: false,
              attemptId: attempt.id,
              layoutSnapshot: attempt.layout_snapshot,
              answers: attempt.answers,
              essaySubmission: attempt.essay_submission,
              serverNowMs: Date.now(),
              reason: 'signal_lost',
            })
          : null
      if (lost) {
        return NextResponse.json(finalizedAttemptClientJson(lost, sessionRow.class_id ?? null), {
          headers: NO_STORE_HEADERS,
        })
      }
      const saved = await fetchAlreadySubmittedPayloadForAttemptPg(
        attempt.id,
        false,
        title,
        sessionRow.duration_minutes
      )
      if (saved) {
        return NextResponse.json({ ...saved, classId: sessionRow.class_id ?? null }, { headers: NO_STORE_HEADERS })
      }
    }

    return NextResponse.json({ ok: true }, { headers: NO_STORE_HEADERS })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[exam-heartbeat]', msg)
    return NextResponse.json({ error: `Lỗi: ${msg}` }, { status: 500, headers: NO_STORE_HEADERS })
  }
}
