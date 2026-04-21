export type HospitalityIntent =
  | 'room_availability'
  | 'price_quote'
  | 'booking'
  | 'payment_status'
  | 'cancel_policy'
  | 'greeting'
  | 'other'

const AVAILABILITY_RE =
  /(?:\b(?:trong|trong phòng|phong trong|còn phòng|available|vacancy|check[\s-]?in|check[\s-]?out)\b|(?:c[oó]\s*ph[oò]ng\s*g[iì]\??)|(?:room\s*types?)|(?:lo[aạ]i\s*ph[oò]ng))/i
const PRICE_RE = /\b(giá|bao nhiêu|price|cost|rate|chi phí)\b/i
const BOOKING_RE = /\b(đặt|book|booking|giữ phòng|reserve)\b/i
const PAYMENT_RE = /\b(thanh toán|payment|đã cọc|đã chuyển|invoice|bill)\b/i
const POLICY_RE = /\b(hủy|cancel|chính sách|refund|hoàn tiền|đổi lịch)\b/i
const GREETING_RE = /\b(chào|hello|hi|alo|xin chào)\b/i

export function classifyHospitalityIntent(text: string): HospitalityIntent {
  const t = String(text ?? '').trim()
  if (!t) return 'other'
  if (AVAILABILITY_RE.test(t)) return 'room_availability'
  if (PRICE_RE.test(t)) return 'price_quote'
  if (BOOKING_RE.test(t)) return 'booking'
  if (PAYMENT_RE.test(t)) return 'payment_status'
  if (POLICY_RE.test(t)) return 'cancel_policy'
  if (GREETING_RE.test(t)) return 'greeting'
  return 'other'
}
