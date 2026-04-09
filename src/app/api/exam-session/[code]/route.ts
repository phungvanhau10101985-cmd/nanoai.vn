import { NextRequest, NextResponse } from 'next/server'
import { getUserForAction } from '@/lib/auth'
import {
  fetchClassAndSchoolDisplayNamesPg,
  getClassMemberExamIdentityFromPg,
} from '@/lib/db/classes-pg'
import {
  deleteExamAttemptByIdPg,
  existsAnyExamQuestionForSessionPg,
  fetchExamAttemptFullForUserGetRoutePg,
  fetchExamQuestionsFullOrderedForSessionPg,
  fetchExamSessionActiveForGetRoutePg,
} from '@/lib/db/exam-session-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { resolveWebLocaleFromAcceptLanguage } from '@/lib/i18n/config'
import { resolveDefaultExamSessionTitle } from '@/lib/i18n/exam-session-default-titles'
import { getExamAttemptFeedbackWithMeta, parseExamGradingMeta } from '@/lib/exam-feedback'
import { signExamLayoutToken } from '@/lib/exam-layout-token'
import {
  parseLayoutSnapshot,
  rebuildPublicFromSnapshot,
  type ExamQuestionRow,
} from '@/lib/exam-session/student-exam-layout'
import { buildActiveAttemptSessionJson } from '@/lib/exam-session/student-exam-session-payload'
import {
  tryFinalizeOverdueExamAttemptPg,
  isServerDeadlinePassed,
  resolveDeadlineEndMs,
  fetchAlreadySubmittedPayloadForAttemptPg,
} from '@/lib/exam-session/finalize-overdue-exam-attempt'

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, max-age=0, must-revalidate',
}

/** Lấy thông tin phiên thi theo mã. Câu hỏi chỉ trả khi đã có attempt đang làm (GET resume) hoặc sau POST begin-attempt. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const auth = await getUserForAction('Vui lòng đăng nhập để làm bài thi.')
    if ('error' in auth) {
      return NextResponse.json(
        { error: auth.error },
        { status: 401, headers: NO_STORE_HEADERS }
      )
    }
    const user = auth.user

    const { code } = await params
    if (!code || code.length < 4) {
      return NextResponse.json(
        { error: 'Mã bài thi không hợp lệ.' },
        { status: 400, headers: NO_STORE_HEADERS }
      )
    }

    if (!isPgConfigured()) {
      return NextResponse.json(
        { error: 'Chưa cấu hình cơ sở dữ liệu.' },
        { status: 503, headers: NO_STORE_HEADERS }
      )
    }

    const sessionRes = await fetchExamSessionActiveForGetRoutePg(code.toUpperCase())
    if (sessionRes === null) {
      return NextResponse.json(
        { error: 'Lỗi đọc bài thi.' },
        { status: 500, headers: NO_STORE_HEADERS }
      )
    }
    if (sessionRes === 'not_found') {
      return NextResponse.json(
        { error: 'Không tìm thấy bài thi hoặc bài thi đã đóng.' },
        { status: 404, headers: NO_STORE_HEADERS }
      )
    }

    const session = sessionRes
    const practiceHomework = session.is_practice_homework
    const reqLocale = resolveWebLocaleFromAcceptLanguage(_req.headers.get('accept-language'))
    const sessionTitleFallback = resolveDefaultExamSessionTitle(reqLocale, practiceHomework)
    const resolvedSessionTitle = String(session.title ?? '').trim() || sessionTitleFallback

    let attemptRow = await fetchExamAttemptFullForUserGetRoutePg(session.id, user.id)

    if (attemptRow && attemptRow.submitted_at == null) {
      const snap = parseLayoutSnapshot(attemptRow.layout_snapshot)
      if (!snap) {
        await deleteExamAttemptByIdPg(attemptRow.id)
        attemptRow = null
      }
    }

    if (attemptRow && attemptRow.submitted_at != null) {
      const sc = Number(attemptRow.score ?? 0)
      const mx = Number(attemptRow.max_score ?? 0)
      const meta = parseExamGradingMeta(attemptRow.grading_meta)
      const feedback = getExamAttemptFeedbackWithMeta(sc, mx, meta)
      const durationMin = session.duration_minutes
      return NextResponse.json(
        {
          alreadySubmitted: true,
          practiceHomework,
          title: resolvedSessionTitle,
          durationMinutes: durationMin,
          score: sc,
          maxScore: mx,
          grade10: feedback.grade10,
          scoreOn100: feedback.scoreOn100,
          comment: feedback.comment,
          shareHint: feedback.shareHint,
          scoringBreakdown: meta ?? undefined,
          submittedDueToServerDeadline: meta?.submittedByServerDeadline === true,
        },
        { headers: NO_STORE_HEADERS }
      )
    }

    let className: string | null = null
    let schoolName: string | null = null
    if (session.class_id) {
      const ns = await fetchClassAndSchoolDisplayNamesPg(session.class_id, session.school_id)
      if (ns) {
        className = ns.className
        schoolName = ns.schoolName
      }
    }

    let classExamIdentity: { displayName: string; birthDate: string } | null = null
    if (session.class_id) {
      classExamIdentity = await getClassMemberExamIdentityFromPg(String(session.class_id), user.id)
      if (!classExamIdentity) {
        return NextResponse.json(
          {
            needsEnrollment: true,
            practiceHomework,
            title: resolvedSessionTitle,
            durationMinutes: session.duration_minutes,
            className,
            schoolName,
          },
          { headers: NO_STORE_HEADERS }
        )
      }
    }

    const durationMin = session.duration_minutes
    const serverNowMs = Date.now()

    if (attemptRow && attemptRow.submitted_at == null) {
      const snap = parseLayoutSnapshot(attemptRow.layout_snapshot)
      if (snap) {
        if (
          isServerDeadlinePassed(
            attemptRow.deadline_at,
            attemptRow.started_at,
            durationMin,
            serverNowMs
          )
        ) {
          const finalized = await tryFinalizeOverdueExamAttemptPg({
            sessionId: String(session.id),
            sessionTitle: resolvedSessionTitle,
            durationMinutes: durationMin,
            practiceHomework,
            attemptId: String(attemptRow.id),
            layoutSnapshot: attemptRow.layout_snapshot,
            answers: attemptRow.answers,
            essaySubmission: attemptRow.essay_submission,
            serverNowMs,
          })
          if (finalized) {
            return NextResponse.json(
              {
                alreadySubmitted: true,
                practiceHomework: finalized.practiceHomework,
                title: finalized.title,
                durationMinutes: finalized.durationMinutes,
                score: finalized.score,
                maxScore: finalized.maxScore,
                grade10: finalized.grade10,
                scoreOn100: finalized.scoreOn100,
                comment: finalized.comment,
                shareHint: finalized.shareHint,
                scoringBreakdown: finalized.scoringBreakdown,
                submittedDueToServerDeadline: true,
              },
              { headers: NO_STORE_HEADERS }
            )
          }
          const reopened = await fetchAlreadySubmittedPayloadForAttemptPg(
            String(attemptRow.id),
            practiceHomework,
            resolvedSessionTitle,
            durationMin
          )
          if (reopened) {
            return NextResponse.json(reopened, { headers: NO_STORE_HEADERS })
          }
          return NextResponse.json(
            {
              error:
                'Đã hết giờ làm bài nhưng hệ thống chưa ghi nhận xong. Vui lòng tải lại trang sau vài giây.',
            },
            { status: 503, headers: NO_STORE_HEADERS }
          )
        }

        const questions = await fetchExamQuestionsFullOrderedForSessionPg(session.id)
        if (questions?.length) {
          const publicQuestions = rebuildPublicFromSnapshot(questions as ExamQuestionRow[], snap)
          if (publicQuestions?.length) {
            const endMs =
              resolveDeadlineEndMs(
                attemptRow.deadline_at,
                attemptRow.started_at,
                durationMin
              ) ?? serverNowMs + durationMin * 60_000
            const expJwt = Math.max(300, Math.floor((endMs - serverNowMs) / 1000) + 7200)
            const layoutToken = await signExamLayoutToken(
              { sessionId: String(session.id), userId: user.id, optionPerms: snap.optionPerms },
              expJwt
            )
            return NextResponse.json(
              buildActiveAttemptSessionJson({
                session,
                resolvedTitle: resolvedSessionTitle,
                practiceHomework,
                className,
                schoolName,
                classExamIdentity,
                layoutToken,
                publicQuestions,
                attemptRow,
                resumeInProgress: true,
              }),
              { headers: NO_STORE_HEADERS }
            )
          }
        }
      }
    }

    const anyQ = await existsAnyExamQuestionForSessionPg(session.id)
    if (anyQ === null) {
      return NextResponse.json(
        { error: 'Lỗi đọc câu hỏi.' },
        { status: 500, headers: NO_STORE_HEADERS }
      )
    }
    if (!anyQ) {
      return NextResponse.json(
        { error: 'Bài thi chưa có câu hỏi.' },
        { status: 404, headers: NO_STORE_HEADERS }
      )
    }

    return NextResponse.json(
      {
        mustBegin: true,
        code: session.code,
        title: resolvedSessionTitle,
        durationMinutes: session.duration_minutes,
        classId: session.class_id ?? null,
        schoolId: session.school_id ?? null,
        className,
        schoolName,
        classExamIdentity,
        practiceHomework,
      },
      { headers: NO_STORE_HEADERS }
    )
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[exam-session] GET error:', msg)
    return NextResponse.json(
      { error: `Lỗi: ${msg}` },
      { status: 500, headers: NO_STORE_HEADERS }
    )
  }
}
