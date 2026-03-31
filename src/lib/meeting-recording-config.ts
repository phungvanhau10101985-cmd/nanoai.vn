/** Số ngày giữ bản ghi cuộc họp trên storage + DB (sau đó cron xóa). */
export const MEETING_RECORDING_RETENTION_DAYS = 7

export const MEETING_RECORDINGS_BUCKET = 'meeting-recordings' as const

/** Liên tục không phát hiện tiếng nói trong bấy nhiêu ms → tự dừng ghi (client). */
export const MEETING_RECORDING_SILENCE_AUTO_STOP_MS = 5 * 60 * 1000

/** Chu kỳ đo RMS mic (ms). */
export const MEETING_RECORDING_SILENCE_CHECK_MS = 250

/**
 * Ngưỡng RMS (0–~1) trên waveform chuẩn hoá; dưới ngưỡng coi là im lặng.
 * Tăng nếu môi trường nhiều nền; giảm nếu giọng nhỏ.
 */
export const MEETING_RECORDING_VOICE_RMS_THRESHOLD = 0.02
