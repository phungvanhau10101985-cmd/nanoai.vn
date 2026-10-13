export type CustomerErrorSource = 'toast' | 'boundary' | 'server'

export const CUSTOMER_ERROR_SOURCES: readonly CustomerErrorSource[] = ['toast', 'boundary', 'server']

export const CUSTOMER_ERROR_LIMITS = {
  title: 200,
  message: 2000,
  detail: 8000,
  path: 500,
  digest: 120,
  userAgent: 400,
} as const

/** Khách thiếu credit / chưa đăng nhập: không phải lỗi hệ thống. */
const ALWAYS_EXPECTED =
  /không đủ credit|insufficient credit|not enough credit|积分不足|クレジットが不足|크레딧이 부족|chưa đăng nhập|vui lòng đăng nhập|please (sign|log) in|login required|請登录|请登录|ログインしてください|로그인해 주세요/i

/** Nhắc khách nhập thiếu: có lời nhờ mà không có chữ lỗi. */
const VALIDATION_HINT = /vui lòng|hãy |please |请|してください|해 주세요|선택해|입력해/i
const FAILURE_WORD =
  /lỗi|error|fail|thất bại|không thể|timeout|quá thời gian|http \d{3}|失败|错误|エラー|失敗|오류|실패|exception|unexpected/i

/** Cùng tập crawler với analytics — không ghi nhật ký lỗi khách. */
const BOT_UA =
  /bot|crawler|spider|facebookexternalhit|facebot|meta-externalagent|meta-externalfetcher|slackbot|whatsapp|telegrambot|twitterbot|linkedinbot|bingbot|googlebot|yandex|duckduckbot|embedly|quora link preview|pinterest|discordbot|applebot/i

export function isLikelyBotUserAgent(userAgent: string | null | undefined): boolean {
  const ua = (userAgent || '').trim()
  if (!ua) return false
  return BOT_UA.test(ua)
}

export function clipText(value: unknown, max: number): string {
  const s = typeof value === 'string' ? value : value == null ? '' : String(value)
  return s.replace(/\u0000/g, '').trim().slice(0, max)
}

export function isExpectedCustomerMessage(title: string, message: string): boolean {
  const text = `${title}\n${message}`
  if (!message.trim() && !title.trim()) return true
  if (ALWAYS_EXPECTED.test(text)) return true
  if (VALIDATION_HINT.test(message) && !FAILURE_WORD.test(message)) return true
  return false
}

/** Bỏ số, uuid, url ảnh để lỗi giống nhau gộp một dòng. */
export function normalizeErrorForFingerprint(message: string): string {
  return message
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, '<url>')
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, '<id>')
    .replace(/\d+/g, '#')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 400)
}

export function normalizePathForFingerprint(path: string): string {
  const p = (path.split('?')[0] || '/').replace(/\/+$/, '') || '/'
  return p
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id')
    .replace(/\/\d+(?=\/|$)/g, '/:n')
}
