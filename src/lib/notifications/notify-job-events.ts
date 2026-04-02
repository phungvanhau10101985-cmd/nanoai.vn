import type { SupabaseClient } from '@supabase/supabase-js'
import { createUserNotificationWithEmail } from '@/lib/notifications/create-user-notification-server'

const WORKSHEET_JOB_LABELS: Record<string, { title: string; ok: string; fail: string }> = {
  parse_sgk_extract: {
    title: 'Phiếu bài tập — tách câu từ SGK',
    ok: 'Tách câu từ ảnh SGK đã xong. Mở giáo trình / phiếu bài tập để xem.',
    fail: 'Tách câu từ ảnh SGK thất bại. Xem chi tiết trong Trung tâm tác vụ.',
  },
  solve_sgk_essays: {
    title: 'Phiếu bài tập — lời giải tự luận',
    ok: 'Bù / sinh lời giải tự luận đã xong.',
    fail: 'Xử lý lời giải tự luận thất bại. Xem Trung tâm tác vụ.',
  },
  step_by_step_quiz: {
    title: 'Phiếu bài tập — tạo câu trắc nghiệm',
    ok: 'Đã thêm câu trắc nghiệm theo từng bước.',
    fail: 'Tạo câu trắc nghiệm thất bại. Xem Trung tâm tác vụ.',
  },
  step_by_step_essay: {
    title: 'Phiếu bài tập — tạo câu tự luận',
    ok: 'Đã thêm câu tự luận theo từng bước.',
    fail: 'Tạo câu tự luận thất bại. Xem Trung tâm tác vụ.',
  },
}

function worksheetCopy(type: string, ok: boolean): { title: string; body: string } {
  const row = WORKSHEET_JOB_LABELS[type]
  if (row) {
    return { title: row.title, body: ok ? row.ok : row.fail }
  }
  return {
    title: ok ? 'Tác vụ phiếu bài tập đã xong' : 'Tác vụ phiếu bài tập thất bại',
    body: ok ? 'Mở Trung tâm tác vụ hoặc trang tạo giáo trình để tiếp tục.' : 'Xem lỗi trong Trung tâm tác vụ.',
  }
}

/**
 * Sau khi một trang dịch xong: nếu thuộc lô (batch_id) và còn job pending/processing → không gửi.
 * Khi lô xử lý hết → một thông báo tóm tắt (tránh spam nhiều trang).
 */
export async function notifyTranslateImageSuccessSmart(
  admin: SupabaseClient,
  params: { userId: string; historyId: string }
): Promise<void> {
  const { userId, historyId } = params

  const { data: row, error } = await admin
    .from('try_on_history')
    .select('batch_id')
    .eq('id', historyId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error || !row) {
    await notifyTranslateImageJobDone(admin, { userId, historyId, success: true })
    return
  }

  const bid = row.batch_id as string | null | undefined
  if (!bid) {
    await notifyTranslateImageJobDone(admin, { userId, historyId, success: true })
    return
  }

  const { data: batchHist } = await admin
    .from('try_on_history')
    .select('id, status')
    .eq('batch_id', bid)
    .eq('user_id', userId)

  const ids = (batchHist ?? []).map((h) => h.id)
  if (ids.length === 0) {
    await notifyTranslateImageJobDone(admin, { userId, historyId, success: true })
    return
  }

  const { count: remaining, error: cErr } = await admin
    .from('translate_jobs')
    .select('id', { count: 'exact', head: true })
    .in('history_id', ids)
    .in('status', ['pending', 'processing'])

  if (cErr) {
    await notifyTranslateImageJobDone(admin, { userId, historyId, success: true })
    return
  }

  if ((remaining ?? 0) > 0) {
    return
  }

  const completed = (batchHist ?? []).filter((h) => h.status === 'completed').length
  const failed = (batchHist ?? []).filter((h) => h.status === 'failed').length
  const total = batchHist?.length ?? 0

  const body =
    failed === 0
      ? `Đã dịch xong ${completed}/${total} ảnh trong lô. Mở Trung tâm tác vụ hoặc Dịch ảnh tài liệu để tải.`
      : `Lô dịch kết thúc: ${completed} thành công, ${failed} lỗi (tổng ${total}). Xem chi tiết trong Trung tâm tác vụ.`

  await createUserNotificationWithEmail(admin, {
    user_id: userId,
    type: 'translate_batch_completed',
    title: 'Dịch ảnh tài liệu — lô đã xử lý xong',
    body,
    meta: {
      push_url: '/dashboard/tasks',
      batch_id: bid,
    },
  })
}

/** Dịch ảnh tài liệu (job nền / process-translate). */
export async function notifyTranslateImageJobDone(
  admin: SupabaseClient,
  params: { userId: string; historyId: string; success: boolean; errorMessage?: string | null }
): Promise<void> {
  const { userId, historyId, success } = params
  const err = (params.errorMessage || '').trim()
  await createUserNotificationWithEmail(admin, {
    user_id: userId,
    type: success ? 'translate_image_completed' : 'translate_image_failed',
    title: success ? 'Dịch ảnh tài liệu đã xong' : 'Dịch ảnh tài liệu thất bại',
    body: success
      ? 'Ảnh đã dịch xong. Mở Lịch sử / Trung tâm tác vụ để tải hoặc xem.'
      : err
        ? `Có lỗi: ${err.slice(0, 500)}`
        : 'Có lỗi khi dịch. Mở Trung tâm tác vụ để xem chi tiết.',
    meta: {
      push_url: '/dashboard/tasks',
      history_id: historyId,
    },
  })
}

/** Worksheet background jobs (PM2 worker). */
export async function notifyWorksheetJobOutcome(
  admin: SupabaseClient,
  params: { userId: string; jobId: string; jobType: string; success: boolean; errorMessage?: string | null }
): Promise<void> {
  const { userId, jobId, jobType, success } = params
  const { title, body } = worksheetCopy(jobType, success)
  const err = (params.errorMessage || '').trim()
  await createUserNotificationWithEmail(admin, {
    user_id: userId,
    type: success ? 'worksheet_job_completed' : 'worksheet_job_failed',
    title,
    body: success ? body : err ? `${body} (${err.slice(0, 400)})` : body,
    meta: {
      push_url: '/dashboard/tasks',
      job_id: jobId,
      job_type: jobType,
    },
  })
}

/** Giáo viên vừa chấm điểm tự luận — báo học sinh (nếu có user_id). */
export async function notifyExamEssayGraded(
  admin: SupabaseClient,
  params: {
    studentUserId: string
    sessionCode: string
    attemptId: string
    essayPoints: number
    essayMax: number
    totalScore: number
    maxScore: number
  }
): Promise<void> {
  const { studentUserId, sessionCode, attemptId, essayPoints, essayMax, totalScore, maxScore } = params
  const codeEnc = encodeURIComponent(sessionCode)
  await createUserNotificationWithEmail(admin, {
    user_id: studentUserId,
    type: 'exam_essay_graded',
    title: 'Bài thi đã được chấm tự luận',
    body: `Điểm tự luận: ${essayPoints}/${essayMax}. Tổng: ${totalScore}/${maxScore}. Mở bài làm để xem chi tiết.`,
    meta: {
      push_url: `/lam-bai/${codeEnc}`,
      attempt_id: attemptId,
      session_code: sessionCode,
    },
  })
}

/** Nhắc ôn từ (SRS) — gọi từ cron, đã chống spam theo khoảng thời gian. */
export async function notifyCoachReviewDueIfAllowed(
  admin: SupabaseClient,
  params: { userId: string; dueWordCount: number; minHoursSinceLast: number }
): Promise<boolean> {
  const { userId, dueWordCount, minHoursSinceLast } = params
  if (dueWordCount <= 0) return false

  const since = new Date(Date.now() - minHoursSinceLast * 3600000).toISOString()
  const { count, error } = await admin
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('type', 'coach_review_due')
    .gte('created_at', since)

  if (error) {
    console.error('[notifyCoachReviewDueIfAllowed] count:', error.message)
    return false
  }
  if ((count ?? 0) > 0) return false

  await createUserNotificationWithEmail(admin, {
    user_id: userId,
    type: 'coach_review_due',
    title: 'Có từ vựng cần ôn tập',
    body:
      dueWordCount === 1
        ? 'Bạn có 1 từ đến hạn ôn trong Học ngoại ngữ AI. Mở phần Ôn tập để luyện.'
        : `Bạn có ${dueWordCount} từ đến hạn ôn. Mở Học ngoại ngữ AI → Ôn tập.`,
    meta: { push_url: '/hoc-tieng-anh-ai' },
  })
  return true
}
