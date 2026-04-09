import { NextRequest, NextResponse } from 'next/server'
import { getUserForAction } from '@/lib/auth'
import { resolveWebLocaleFromAcceptLanguage } from '@/lib/i18n/config'
import { resolveDefaultExamSessionTitle } from '@/lib/i18n/exam-session-default-titles'
import { signExamLayoutToken } from '@/lib/exam-layout-token'
import {
  fetchClassAndSchoolDisplayNamesPg,
  getClassMemberExamIdentityFromPg,
  hasCompleteClassMemberProfileForExamPg,
} from '@/lib/db/classes-pg'
import {
  fetchExamAttemptForBeginPg,
  fetchExamQuestionsFullOrderedForSessionPg,
  fetchExamSessionActiveForGetRoutePg,
  insertExamAttemptBeginPg,
  deleteExamAttemptByIdPg,
} from '@/lib/db/exam-session-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { CLASS_ENROLLMENT_ERROR_VI } from '@/lib/lop/require-class-enrollment'
import { isValidStudentDobIso } from '@/lib/student-dob'
import {
  buildFreshExamLayout,
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

type ExistingAttemptRow = {
  id: string
  submitted_at: string | null
  layout_snapshot: unknown
  answers: unknown
  essay_submission: unknown
  started_at: string | null
  deadline_at?: string | null
}

function mapFullToExisting(a: {
  id: string
  submitted_at: string | null
  layout_snapshot: unknown
  answers: unknown
  essay_submission: unknown
  started_at: string | null
  deadline_at: string | null
}): ExistingAttemptRow {
  return {
    id: a.id,
    submitted_at: a.submitted_at,
    layout_snapshot: a.layout_snapshot,
    answers: a.answers,
    essay_submission: a.essay_submission,
    started_at: a.started_at,
    deadline_at: a.deadline_at,
  }
}

/** HS bấm Bắt đầu — tạo attempt chưa nộp + snapshot; idempotent nếu đã có attempt đang làm. */
export async function POST(
  req: NextRequest,
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

    const body = await req.json().catch(() => ({}))
    const studentName = String(body?.studentName ?? '').trim()
    const studentDob = String(body?.studentDob ?? '').trim()
    if (!studentName) {
      return NextResponse.json(
        { error: 'Vui lòng nhập họ tên học sinh.' },
        { status: 400, headers: NO_STORE_HEADERS }
      )
    }
    if (!isValidStudentDobIso(studentDob)) {
      return NextResponse.json(
        { error: 'Vui lòng chọn ngày sinh hợp lệ.' },
        { status: 400, headers: NO_STORE_HEADERS }
      )
    }

    if (!isPgConfigured()) {
      return NextResponse.json(
        { error: 'Chưa cấu hình cơ sở dữ liệu.' },
        { status: 503, headers: NO_STORE_HEADERS }
      )
    }

    const sessRow = await fetchExamSessionActiveForGetRoutePg(code.toUpperCase())
    if (sessRow === null) {
      return NextResponse.json(
        { error: 'Không thể tải bài thi.' },
        { status: 503, headers: NO_STORE_HEADERS }
      )
    }
    if (sessRow === 'not_found') {
      return NextResponse.json(
        { error: 'Không tìm thấy bài thi hoặc bài thi đã đóng.' },
        { status: 404, headers: NO_STORE_HEADERS }
      )
    }

    const sess = sessRow
    const userId = user.id

    const practiceHomework = Boolean(sess.is_practice_homework)
    const reqLocale = resolveWebLocaleFromAcceptLanguage(req.headers.get('accept-language'))
    const sessionTitleFallback = resolveDefaultExamSessionTitle(reqLocale, practiceHomework)
    const resolvedSessionTitle = String(sess.title ?? '').trim() || sessionTitleFallback

    if (sess.class_id) {
      const enrolled = await hasCompleteClassMemberProfileForExamPg(String(sess.class_id), userId)
      if (enrolled === null) {
        return NextResponse.json(
          { error: 'Không thể kiểm tra tham gia lớp.' },
          { status: 503, headers: NO_STORE_HEADERS }
        )
      }
      if (!enrolled) {
        return NextResponse.json({ error: CLASS_ENROLLMENT_ERROR_VI }, { status: 403, headers: NO_STORE_HEADERS })
      }
    }

    let className: string | null = null
    let schoolName: string | null = null
    if (sess.class_id) {
      const names = await fetchClassAndSchoolDisplayNamesPg(String(sess.class_id), sess.school_id)
      if (names === null) {
        return NextResponse.json(
          { error: 'Không thể tải thông tin lớp.' },
          { status: 503, headers: NO_STORE_HEADERS }
        )
      }
      className = names.className
      schoolName = names.schoolName
    }

    let classExamIdentity: { displayName: string; birthDate: string } | null = null
    if (sess.class_id) {
      classExamIdentity = await getClassMemberExamIdentityFromPg(String(sess.class_id), userId)
    }

    const attemptFetch = await fetchExamAttemptForBeginPg(sess.id, userId)
    if (attemptFetch === null) {
      return NextResponse.json(
        { error: 'Không thể kiểm tra phiên làm bài trước đó.' },
        { status: 500, headers: NO_STORE_HEADERS }
      )
    }

    const durationMin = typeof sess.duration_minutes === 'number' ? sess.duration_minutes : 15

    async function loadQuestionsForLayout(): Promise<ExamQuestionRow[] | null> {
      const full = await fetchExamQuestionsFullOrderedForSessionPg(sess.id)
      if (full === null) return null
      return full.map(({ id, question_text, options, correct_index, source }) => ({
        id,
        question_text,
        options,
        correct_index,
        source,
      }))
    }

    async function buildResumeFromRow(
      attemptRow: {
        layout_snapshot: unknown
        answers: unknown
        essay_submission: unknown
        started_at: string | null
        deadline_at?: string | null
      },
      resumeInProgress: boolean
    ) {
      const snap = parseLayoutSnapshot(attemptRow.layout_snapshot)
      if (!snap) return null
      const questions = await loadQuestionsForLayout()
      if (!questions?.length) return null
      const publicQuestions = rebuildPublicFromSnapshot(questions, snap)
      if (!publicQuestions) return null
      const serverNowMs = Date.now()
      const endMs =
        resolveDeadlineEndMs(attemptRow.deadline_at, attemptRow.started_at, durationMin) ??
        serverNowMs + durationMin * 60_000
      const expJwt = Math.max(300, Math.floor((endMs - serverNowMs) / 1000) + 7200)
      const layoutToken = await signExamLayoutToken(
        { sessionId: String(sess.id), userId: userId, optionPerms: snap.optionPerms },
        expJwt
      )
      return buildActiveAttemptSessionJson({
        session: sess,
        resolvedTitle: resolvedSessionTitle,
        practiceHomework,
        className,
        schoolName,
        classExamIdentity,
        layoutToken,
        publicQuestions,
        attemptRow,
        resumeInProgress,
      })
    }

    const existingAttempt: ExistingAttemptRow | null =
      attemptFetch === 'missing' ? null : mapFullToExisting(attemptFetch)

    if (existingAttempt?.submitted_at) {
      return NextResponse.json(
        { error: 'Bạn đã nộp bài thi này rồi.' },
        { status: 409, headers: NO_STORE_HEADERS }
      )
    }

    if (existingAttempt && !existingAttempt.submitted_at) {
      const serverNowMs = Date.now()
      if (
        isServerDeadlinePassed(
          existingAttempt.deadline_at,
          existingAttempt.started_at,
          durationMin,
          serverNowMs
        )
      ) {
        const finalized = await tryFinalizeOverdueExamAttemptPg({
          sessionId: String(sess.id),
          sessionTitle: resolvedSessionTitle,
          durationMinutes: durationMin,
          practiceHomework,
          attemptId: String(existingAttempt.id),
          layoutSnapshot: existingAttempt.layout_snapshot,
          answers: existingAttempt.answers,
          essaySubmission: existingAttempt.essay_submission,
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
        const reopenedMain = await fetchAlreadySubmittedPayloadForAttemptPg(
          String(existingAttempt.id),
          practiceHomework,
          resolvedSessionTitle,
          durationMin
        )
        if (reopenedMain) {
          return NextResponse.json(reopenedMain, { headers: NO_STORE_HEADERS })
        }
        return NextResponse.json(
          {
            error:
              'Đã hết giờ làm bài nhưng hệ thống chưa ghi nhận xong. Vui lòng tải lại trang sau vài giây.',
          },
          { status: 503, headers: NO_STORE_HEADERS }
        )
      }
      const resumed = await buildResumeFromRow(existingAttempt, false)
      if (resumed) {
        return NextResponse.json(resumed, { headers: NO_STORE_HEADERS })
      }
      const del = await deleteExamAttemptByIdPg(existingAttempt.id)
      if (del === null || del === false) {
        return NextResponse.json(
          { error: 'Không thể làm mới phiên làm bài.' },
          { status: 500, headers: NO_STORE_HEADERS }
        )
      }
    }

    const questions = await loadQuestionsForLayout()
    if (questions === null) {
      return NextResponse.json(
        { error: 'Không thể tải câu hỏi.' },
        { status: 500, headers: NO_STORE_HEADERS }
      )
    }
    if (!questions.length) {
      return NextResponse.json(
        { error: 'Bài thi chưa có câu hỏi.' },
        { status: 404, headers: NO_STORE_HEADERS }
      )
    }

    const { snapshot, publicQuestions } = buildFreshExamLayout(questions)
    const startedDate = new Date()
    const startedIso = startedDate.toISOString()
    const deadlineIso = new Date(startedDate.getTime() + durationMin * 60_000).toISOString()
    const expJwt = Math.max(300, Math.floor((Date.parse(deadlineIso) - Date.now()) / 1000) + 7200)
    const layoutToken = await signExamLayoutToken(
      {
        sessionId: String(sess.id),
        userId: userId,
        optionPerms: snapshot.optionPerms,
      },
      expJwt
    )

    async function tryInsertOnce(): Promise<
      | { ok: true }
      | { ok: false; duplicate: boolean; pgCode: string; message: string }
      | null
    > {
      const ins = await insertExamAttemptBeginPg({
        sessionId: sess.id,
        userId,
        classId: sess.class_id,
        schoolId: sess.school_id,
        studentName: studentName || null,
        studentCode: studentDob || null,
        answers: {},
        essaySubmission: {},
        score: 0,
        maxScore: 0,
        startedIso,
        deadlineIso,
        layoutSnapshot: snapshot,
      })
      if (ins === null) return null
      if (ins === 'ok') return { ok: true }
      const duplicate = ins.pgCode === '23505'
      return { ok: false, duplicate, pgCode: ins.pgCode, message: ins.message }
    }

    let lastInsert: { pgCode: string; message: string } | null = null

    for (let insertRound = 0; insertRound < 2; insertRound++) {
      const ins = await tryInsertOnce()
      if (ins === null) {
        return NextResponse.json(
          { error: 'Không thể bắt đầu phiên làm bài.' },
          { status: 503, headers: NO_STORE_HEADERS }
        )
      }
      if (ins.ok) {
        return NextResponse.json(
          buildActiveAttemptSessionJson({
            session: sess,
            resolvedTitle: resolvedSessionTitle,
            practiceHomework,
            className,
            schoolName,
            classExamIdentity,
            layoutToken,
            publicQuestions,
            attemptRow: {
              answers: {},
              essay_submission: {},
              started_at: startedIso,
              deadline_at: deadlineIso,
            },
            resumeInProgress: false,
          }),
          { headers: NO_STORE_HEADERS }
        )
      }

      lastInsert = { pgCode: ins.pgCode, message: ins.message }
      const isUndefinedColumn =
        ins.pgCode === '42703' ||
        (ins.message && /column .* does not exist/i.test(ins.message))
      if (isUndefinedColumn) {
        console.error('[exam-session begin-attempt] schema:', code.toUpperCase(), ins.pgCode, ins.message)
        return NextResponse.json(
          {
            error:
              'Hệ thống làm bài chưa sẵn sàng: thiếu cột trên bảng exam_attempts (ví dụ layout_snapshot, deadline_at). Kiểm tra migration và schema Postgres.',
            errorCode: ins.pgCode,
            errorDetails: ins.message,
          },
          { status: 503, headers: NO_STORE_HEADERS }
        )
      }

      if (!ins.duplicate || insertRound === 1) {
        break
      }

      const againFetch = await fetchExamAttemptForBeginPg(sess.id, userId)
      if (againFetch === null || againFetch === 'missing') {
        break
      }
      const again = mapFullToExisting(againFetch)

      if (again.submitted_at) {
        return NextResponse.json(
          { error: 'Bạn đã nộp bài thi này rồi.' },
          { status: 409, headers: NO_STORE_HEADERS }
        )
      }

      const nowMs = Date.now()
      if (isServerDeadlinePassed(again.deadline_at, again.started_at, durationMin, nowMs)) {
        const finalized = await tryFinalizeOverdueExamAttemptPg({
          sessionId: String(sess.id),
          sessionTitle: resolvedSessionTitle,
          durationMinutes: durationMin,
          practiceHomework,
          attemptId: String(again.id),
          layoutSnapshot: again.layout_snapshot,
          answers: again.answers,
          essaySubmission: again.essay_submission,
          serverNowMs: nowMs,
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
        const reopenedRace = await fetchAlreadySubmittedPayloadForAttemptPg(
          String(again.id),
          practiceHomework,
          resolvedSessionTitle,
          durationMin
        )
        if (reopenedRace) {
          return NextResponse.json(reopenedRace, { headers: NO_STORE_HEADERS })
        }
        return NextResponse.json(
          {
            error:
              'Đã hết giờ làm bài nhưng hệ thống chưa ghi nhận xong. Vui lòng tải lại trang sau vài giây.',
          },
          { status: 503, headers: NO_STORE_HEADERS }
        )
      }

      const resumed = await buildResumeFromRow(again, true)
      if (resumed) {
        return NextResponse.json(resumed, { headers: NO_STORE_HEADERS })
      }

      const delRace = await deleteExamAttemptByIdPg(again.id)
      if (delRace === null || delRace === false) {
        break
      }
    }

    console.error(
      '[exam-session begin-attempt] insert:',
      code.toUpperCase(),
      lastInsert?.message,
      lastInsert?.pgCode
    )
    return NextResponse.json(
      {
        error: 'Không thể bắt đầu phiên làm bài.',
        errorCode: lastInsert?.pgCode ?? null,
        errorDetails: lastInsert?.message ?? null,
      },
      { status: 500, headers: NO_STORE_HEADERS }
    )
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[exam-session begin-attempt] error:', msg)
    return NextResponse.json(
      { error: `Lỗi: ${msg}` },
      { status: 500, headers: NO_STORE_HEADERS }
    )
  }
}
