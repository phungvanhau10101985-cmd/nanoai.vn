/** Mỗi block 5 phút — đồng bộ client + server khi tính phí báo cáo cuộc họp. */
export const MEETING_REPORT_BLOCK_SECONDS = 300
export const MEETING_REPORT_CREDITS_PER_BLOCK = 0.5
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

export function computeMeetingReportCredits(durationSeconds: number): number {
  const s = Math.max(0, Math.floor(durationSeconds))
  if (s <= 0) return MEETING_REPORT_MIN_CREDITS
  const blocks = Math.ceil(s / MEETING_REPORT_BLOCK_SECONDS)
  const raw = blocks * MEETING_REPORT_CREDITS_PER_BLOCK
  return Math.max(MEETING_REPORT_MIN_CREDITS, Math.round(raw * 10) / 10)
}
