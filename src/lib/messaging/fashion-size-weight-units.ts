/**
 * Bảng size hàng Trung Quốc thường ghi cân theo 斤 (cân TQ), 1 斤 = 0,5 kg.
 * Khách Việt dễ hiểu nhầm 90–105 là kg — tư vấn phải quy đổi ra kg.
 */

const JIN_RANGE_IN_PARENS_RE = /\((\d{2,3})\s*[-–—]\s*(\d{2,3})\)/g

/** Số trong khoảng 60–250 sau nhãn size → gần như chắc là cân TQ (斤), không phải kg. */
export function looksLikeChineseJinWeightRange(min: number, max: number): boolean {
  if (!Number.isFinite(min) || !Number.isFinite(max) || min >= max) return false
  return min >= 60 && max <= 250
}

export function formatKgRangeFromChineseJin(minJin: number, maxJin: number): string {
  const minKg = minJin / 2
  const maxKg = maxJin / 2
  const fmt = (n: number) =>
    Number.isInteger(n) ? String(n) : String(n).replace('.', ',')
  return `${fmt(minKg)}–${fmt(maxKg)} kg`
}

/** Chuẩn bị dữ liệu kho cho AI: ghi rõ kg để tư vấn, giữ số gốc nội bộ. */
export function annotateFashionSizeWeightTextForAi(text: string): string {
  const raw = String(text ?? '').trim()
  if (!raw) return raw
  return raw.replace(JIN_RANGE_IN_PARENS_RE, (match, a, b) => {
    const min = Number(a)
    const max = Number(b)
    if (!looksLikeChineseJinWeightRange(min, max)) return match
    return `(≈ ${formatKgRangeFromChineseJin(min, max)} | bảng gốc ${min}–${max} cân TQ/斤 — **chỉ nói kg với khách**)`
  })
}

/** Luật bắt buộc cho Partner AI thời trang — nhúng vào system prompt. */
export const FASHION_CHINESE_JIN_SIZE_WEIGHT_AI_PROMPT = `
- **Bảng size / cân nặng trong kho (hàng Trung Quốc):** Số trong ngoặc sau size (vd. 90–105) là **cân TQ (斤)**, **không phải kg**. Quy đổi: **1 斤 = 0,5 kg**. Khi **tư vấn khách Việt**: **chỉ nói cân nặng đã quy đổi sang kg** (vd. size M **≈ 45–52,5 kg**) — **cấm** đọc nguyên số 90–105 cho khách, **cấm** nói «cân nặng 90–105» / «mặc size M từ 90 kg» như thể đó là kg.
- **Hỏi khách chiều cao–cân nặng** để chốt size: luôn hỏi theo **kg**.
- Khi khách thắc mắc size «to» / số trông lớn: giải thích size thực tế theo **kg đã quy đổi**; không bảo khách phải nặng 90 kg.`

const CUSTOMER_WEIGHT_MISLABEL_RE =
  /(?:cân nặng|cân|dành cho cân nặng|phù hợp cân)\s*(\d{2,3})\s*[-–—]\s*(\d{2,3})(?!\s*(?:kg|kilogram|cân TQ|斤|jin|cân trung))/gi

const SIZE_LABEL_JIN_IN_PARENS_RE =
  /\b((?:\dXL|[SMLXL]{1,3}|[SMLXL]{1,2}XL))\s*\((\d{2,3})\s*[-–—]\s*(\d{2,3})\)(?!\s*(?:cân|kg|斤|jin|≈))/gi

function replaceJinRangeWithKgForCustomer(min: number, max: number): string {
  return formatKgRangeFromChineseJin(min, max)
}

/** Hậu xử lý tin AI: thay số cân TQ bằng kg khi gửi khách. */
export function sanitizeFashionSizeWeightMessageForCustomer(message: string): string {
  let raw = String(message ?? '').trim()
  if (!raw) return message

  raw = raw.replace(SIZE_LABEL_JIN_IN_PARENS_RE, (match, label, a, b) => {
    const min = Number(a)
    const max = Number(b)
    if (!looksLikeChineseJinWeightRange(min, max)) return match
    return `${label} (${replaceJinRangeWithKgForCustomer(min, max)})`
  })

  raw = raw.replace(CUSTOMER_WEIGHT_MISLABEL_RE, (match, a, b) => {
    const min = Number(a)
    const max = Number(b)
    if (!looksLikeChineseJinWeightRange(min, max)) return match
    const kg = replaceJinRangeWithKgForCustomer(min, max)
    return match
      .replace(`${a}-${b}`, kg)
      .replace(`${a}–${b}`, kg)
      .replace(`${a}—${b}`, kg)
  })

  return raw
}
