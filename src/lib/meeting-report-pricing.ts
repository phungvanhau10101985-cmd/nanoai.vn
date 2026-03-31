/** Khối đầu 5 phút — đồng bộ client + server khi tính phí báo cáo cuộc họp. */
export const MEETING_REPORT_BLOCK_SECONDS = 300

/** Thời lượng (giây) mỗi đoạn audio khi phiên âm theo lô (tránh timeout API). */
export const MEETING_REPORT_TRANSCRIBE_CHUNK_SECONDS = MEETING_REPORT_BLOCK_SECONDS

/**
 * Trên ngưỡng này (hoặc nhiều file đoạn) → API phiên âm từng đoạn rồi tóm tắt text (không gửi một file quá dài một lần).
 */
export const MEETING_REPORT_CHUNKED_PIPELINE_THRESHOLD_SECONDS = MEETING_REPORT_BLOCK_SECONDS
/** Sau 5 phút đầu: mỗi phút (phần vượt, làm tròn lên) thêm bấy nhiêu credit. */
export const MEETING_REPORT_CREDITS_PER_MINUTE_AFTER_FIRST = 0.2
export const MEETING_REPORT_MIN_CREDITS = 1
export const MEETING_REPORT_MAX_DURATION_SECONDS = 2 * 60 * 60
export const MEETING_REPORT_MAX_FILE_BYTES = 20 * 1024 * 1024

/**
 * Trần thời lượng hợp lệ theo dung lượng file (chống khai báo dài hơn nội dung thật).
 * Giả định tối thiểu ~1,2 KB/giây cho webm/opus thoại.
 */
export function capMeetingDurationByFileSize(bytes: number, claimedSeconds: number): number {
  if (!Number.isFinite(bytes) || bytes < 1) return 0
  if (!Number.isFinite(claimedSeconds) || claimedSeconds <= 0) return 0
  const maxFromSize = Math.floor(bytes / 1200)
  const capped = Math.min(claimedSeconds, Math.max(1, maxFromSize), MEETING_REPORT_MAX_DURATION_SECONDS)
  return capped
}

/**
 * 5 phút đầu = 1 credit; phần sau tính theo phút: mỗi phút bắt đầu +0,2 credit
 * (giây vượt quá 5 phút làm tròn lên theo phút).
 */
export function computeMeetingReportCredits(durationSeconds: number): number {
  const s = Math.max(0, Math.floor(durationSeconds))
  if (s <= 0) return MEETING_REPORT_MIN_CREDITS
  if (s <= MEETING_REPORT_BLOCK_SECONDS) return MEETING_REPORT_MIN_CREDITS
  const excessSeconds = s - MEETING_REPORT_BLOCK_SECONDS
  const billedMinutesAfterFirst = Math.ceil(excessSeconds / 60)
  const credits =
    MEETING_REPORT_MIN_CREDITS +
    MEETING_REPORT_CREDITS_PER_MINUTE_AFTER_FIRST * billedMinutesAfterFirst
  return Math.round(credits * 10) / 10
}
