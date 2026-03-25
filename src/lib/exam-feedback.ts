/** Quy đổi từ điểm thô (score/max) → thang 100, rồi tổng kết /10 (= điểm_100 / 10). */
export type ExamScoresScaled = {
  /** Điểm quy thang 100 (0–100), làm tròn 1 chữ số thập phân */
  scoreOn100: number
  /** Tổng kết thang 10, làm tròn 1 chữ số thập phân */
  grade10: number
}

export function computeExamScoresOn100And10(score: number, maxScore: number): ExamScoresScaled {
  const s = Number(score)
  const m = Number(maxScore)
  if (!Number.isFinite(s) || !Number.isFinite(m) || m <= 0) {
    return { scoreOn100: 0, grade10: 0 }
  }
  const clamped = Math.min(m, Math.max(0, s))
  const raw100 = (clamped / m) * 100
  const scoreOn100 = Math.round(raw100 * 10) / 10
  const grade10 = Math.round((raw100 / 10) * 10) / 10
  return { scoreOn100, grade10 }
}

/** Meta lưu kèm exam_attempts — phục vụ đề TN + tự luận và hiển thị lớp. */
export type ExamGradingMeta = {
  quizCorrect: number
  quizTotal: number
  quizPoints: number
  quizPointsMax: number
  essayPointsMax: number
  /** Điểm TL sau khi GV chấm (tổng các câu TL) */
  essayPointsAwarded?: number
  essayGradedAt?: string
  /** ISO: gợi ý thời điểm hết hạn lưu ảnh TL trên storage (chính sách lưu trữ) */
  essayImageUrlsExpireAt?: string
  /** Hệ thống nộp/chấm khi hết giờ server (HS không bấm nộp) */
  submittedByServerDeadline?: boolean
}

function feedbackFromQuizPct(pct: number, grade10: number): {
  grade10: number
  comment: string
  shareHint: string
} {
  if (pct >= 90) {
    return {
      grade10,
      comment: `Xuất sắc! Điểm ${grade10}/10. Em đã nắm vững kiến thức. Tiếp tục phát huy nhé!`,
      shareHint: 'Chia sẻ kết quả với bạn bè!',
    }
  }
  if (pct >= 80) {
    return {
      grade10,
      comment: `Rất tốt! Điểm ${grade10}/10. Em làm bài rất tốt. Hãy giữ vững phong độ!`,
      shareHint: 'Chia sẻ thành tích với mọi người.',
    }
  }
  if (pct >= 70) {
    return {
      grade10,
      comment: `Tốt! Điểm ${grade10}/10. Em đã hoàn thành tốt. Ôn thêm một chút sẽ càng giỏi hơn!`,
      shareHint: '',
    }
  }
  if (pct >= 50) {
    return {
      grade10,
      comment: `Điểm ${grade10}/10. Em đã cố gắng. Hãy xem lại các câu sai và ôn tập thêm nhé!`,
      shareHint: '',
    }
  }
  return {
    grade10,
    comment: `Điểm ${grade10}/10. Đừng nản lòng! Mỗi lần sai là một cơ hội để học hỏi. Em hãy ôn lại và thử lại lần sau nhé!`,
    shareHint: '',
  }
}

/** Nhận xét khích lệ theo thang 100 → tổng kết /10 (dùng chung nộp bài + hiển thị lại kết quả). */
export function getExamAttemptFeedback(
  score: number,
  maxScore: number
): { grade10: number; scoreOn100: number; comment: string; shareHint: string } {
  const { scoreOn100, grade10 } = computeExamScoresOn100And10(score, maxScore)
  const base = feedbackFromQuizPct(scoreOn100, grade10)
  return { grade10, scoreOn100, comment: base.comment, shareHint: base.shareHint }
}

export function parseExamGradingMeta(raw: unknown): ExamGradingMeta | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const quizCorrect = Number(o.quizCorrect)
  const quizTotal = Number(o.quizTotal)
  const quizPoints = Number(o.quizPoints)
  const quizPointsMax = Number(o.quizPointsMax)
  const essayPointsMax = Number(o.essayPointsMax)
  if (!Number.isFinite(quizTotal) || quizTotal < 0) return null
  if (
    !Number.isFinite(quizCorrect) ||
    !Number.isFinite(quizPoints) ||
    !Number.isFinite(quizPointsMax) ||
    !Number.isFinite(essayPointsMax)
  ) {
    return null
  }
  const base: ExamGradingMeta = {
    quizCorrect: Math.max(0, Math.floor(quizCorrect)),
    quizTotal: Math.max(0, Math.floor(quizTotal)),
    quizPoints: Math.max(0, quizPoints),
    quizPointsMax: Math.max(0, quizPointsMax),
    essayPointsMax: Math.max(0, essayPointsMax),
  }
  if ('essayPointsAwarded' in o && o.essayPointsAwarded !== null && o.essayPointsAwarded !== undefined) {
    const ep = Number(o.essayPointsAwarded)
    if (Number.isFinite(ep)) base.essayPointsAwarded = Math.max(0, ep)
  }
  if (typeof o.essayGradedAt === 'string' && o.essayGradedAt.trim()) {
    base.essayGradedAt = o.essayGradedAt.trim()
  }
  if (typeof o.essayImageUrlsExpireAt === 'string' && o.essayImageUrlsExpireAt.trim()) {
    base.essayImageUrlsExpireAt = o.essayImageUrlsExpireAt.trim()
  }
  if (o.submittedByServerDeadline === true) {
    base.submittedByServerDeadline = true
  }
  return base
}

/**
 * Kết quả HS: tổng kết /10 và thang 100 lấy theo score/max toàn bài (điểm tạm khi TL chưa chấm).
 * Chi tiết TN vẫn ghi trong comment.
 */
export function getExamAttemptFeedbackWithMeta(
  score: number,
  maxScore: number,
  meta: ExamGradingMeta | null
): { grade10: number; scoreOn100: number; comment: string; shareHint: string } {
  if (meta && meta.quizTotal === 0 && meta.essayPointsMax > 0) {
    const { scoreOn100, grade10 } = computeExamScoresOn100And10(score, maxScore)
    if (meta.essayPointsAwarded !== undefined && Number.isFinite(meta.essayPointsAwarded)) {
      const ea = Math.max(0, meta.essayPointsAwarded)
      return {
        grade10,
        scoreOn100,
        comment: `Bài làm đã được chấm. Tự luận: ${ea}/${meta.essayPointsMax} điểm (GV chấm). Tổng: ${score}/${maxScore}.`,
        shareHint: '',
      }
    }
    return {
      grade10,
      scoreOn100,
      comment: `Bài làm đã được ghi nhận. Phần tự luận do giáo viên chấm (tối đa ${meta.essayPointsMax} điểm).`,
      shareHint: '',
    }
  }
  if (meta && meta.quizTotal > 0 && meta.essayPointsMax > 0) {
    const { scoreOn100, grade10 } = computeExamScoresOn100And10(score, maxScore)
    const base = feedbackFromQuizPct(scoreOn100, grade10)
    if (meta.essayPointsAwarded !== undefined && Number.isFinite(meta.essayPointsAwarded)) {
      const ea = Math.max(0, meta.essayPointsAwarded)
      return {
        grade10,
        scoreOn100,
        comment: `${base.comment} Trắc nghiệm: ${meta.quizPoints}/${meta.quizPointsMax} điểm (theo đề). Tự luận (GV chấm): ${ea}/${meta.essayPointsMax} điểm. Tổng hiện tại: ${score}/${maxScore}.`,
        shareHint: base.shareHint,
      }
    }
    return {
      grade10,
      scoreOn100,
      comment: `${base.comment} Trắc nghiệm: ${meta.quizPoints}/${meta.quizPointsMax} điểm (theo đề). Điểm tạm toàn bài (gốc): ${score}/${maxScore}. Tự luận chưa chấm (tối đa ${meta.essayPointsMax} điểm).`,
      shareHint: base.shareHint,
    }
  }
  return getExamAttemptFeedback(score, maxScore)
}
