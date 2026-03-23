/** Nhận xét khích lệ theo % đúng – thang điểm 10 (dùng chung nộp bài + hiển thị lại kết quả). */
export function getExamAttemptFeedback(
  score: number,
  maxScore: number
): { grade10: number; comment: string; shareHint: string } {
  const pct = maxScore > 0 ? (score / maxScore) * 100 : 0
  const grade10 = maxScore > 0 ? Math.round((score / maxScore) * 10 * 10) / 10 : 0

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
