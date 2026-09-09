import type { ImageLocDeepseekPricing } from './image-localization-types'

const PEAK_RANGES_UTC: Array<[number, number]> = [
  [60, 240],
  [360, 600],
]

function minuteOfDayUtc(d = new Date()): number {
  return d.getUTCHours() * 60 + d.getUTCMinutes()
}

export function isDeepseekPeakUtc(d = new Date()): boolean {
  const m = minuteOfDayUtc(d)
  return PEAK_RANGES_UTC.some(([start, end]) => m >= start && m < end)
}

export function secondsUntilDeepseekOffPeak(d = new Date()): number {
  if (!isDeepseekPeakUtc(d)) return 0
  const m = minuteOfDayUtc(d)
  for (const [start, end] of PEAK_RANGES_UTC) {
    if (m >= start && m < end) {
      const endMs = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, end, 0, 0)
      return Math.max(1, Math.ceil((endMs - d.getTime()) / 1000))
    }
  }
  return 0
}

export function offPeakWaitMessageVi(sec: number): string {
  const m = Math.max(1, Math.ceil(sec / 60))
  return `Đang chờ hết giờ cao điểm DeepSeek (~${m} phút). OCR/dịch sẽ chạy khi vào khung giá thấp điểm (08–11h và 13–17h VN = 2× token).`
}

export function deepseekPricingForAdmin(opts: {
  offPeakOnlyEnabled: boolean
  envDefault: boolean
}): ImageLocDeepseekPricing {
  const peakNow = isDeepseekPeakUtc()
  const sec = secondsUntilDeepseekOffPeak()
  const wait = opts.offPeakOnlyEnabled && peakNow
  return {
    peak_now: peakNow,
    off_peak_only_enabled: opts.offPeakOnlyEnabled,
    off_peak_only_env_default: opts.envDefault,
    seconds_until_off_peak: sec,
    banner_variant: peakNow ? (wait ? 'wait' : 'peak') : null,
    banner_message_vi: peakNow
      ? wait
        ? offPeakWaitMessageVi(sec)
        : 'Đang giờ cao điểm DeepSeek (08–11h, 13–17h VN). Job chạy ngay với giá token ×2. Bật «Chờ giờ thấp điểm» để đợi khung rẻ.'
      : null,
  }
}

export function deepseekOffPeakOnlyEnvDefault(): boolean {
  const v = (process.env.IMAGE_LOCALIZATION_DEEPSEEK_OFF_PEAK_ONLY || '').trim().toLowerCase()
  return v === '1' || v === 'true' || v === 'yes' || v === 'on'
}
