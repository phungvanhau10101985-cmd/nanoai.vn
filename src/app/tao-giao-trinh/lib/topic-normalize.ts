/**
 * Chuẩn hóa chủ đề bài học theo SGK để tìm kiếm khớp.
 * - Bỏ "Bài X:", "Chương X:", "Tiết X:"
 * - Lowercase, bỏ dấu tiếng Việt, gộp khoảng trắng
 */

const VI_REMOVE: Record<string, string> = {
  à: 'a', á: 'a', ả: 'a', ã: 'a', ạ: 'a', ă: 'a', ằ: 'a', ắ: 'a', ẳ: 'a', ẵ: 'a', ặ: 'a', â: 'a', ầ: 'a', ấ: 'a', ẩ: 'a', ẫ: 'a', ậ: 'a',
  è: 'e', é: 'e', ẻ: 'e', ẽ: 'e', ẹ: 'e', ê: 'e', ề: 'e', ế: 'e', ể: 'e', ễ: 'e', ệ: 'e',
  ì: 'i', í: 'i', ỉ: 'i', ĩ: 'i', ị: 'i',
  ò: 'o', ó: 'o', ỏ: 'o', õ: 'o', ọ: 'o', ô: 'o', ồ: 'o', ố: 'o', ổ: 'o', ỗ: 'o', ộ: 'o', ơ: 'o', ờ: 'o', ớ: 'o', ở: 'o', ỡ: 'o', ợ: 'o',
  ù: 'u', ú: 'u', ủ: 'u', ũ: 'u', ụ: 'u', ư: 'u', ừ: 'u', ứ: 'u', ử: 'u', ữ: 'u', ự: 'u',
  ỳ: 'y', ý: 'y', ỷ: 'y', ỹ: 'y', ỵ: 'y',
  đ: 'd',
}

function removeVietnameseTone(str: string): string {
  return str
    .toLowerCase()
    .split('')
    .map((c) => VI_REMOVE[c] ?? c)
    .join('')
}

/**
 * Khóa cache bài theo chủ đề. Gọi cùng một hàm lúc lưu và lúc tra.
 * Bỏ nhãn đầu (Chủ đề, Bài, Chương, Tiết, kèm số và dấu), bỏ dấu, chữ thường.
 */
export function normalizeTopicForSearch(topic: string): string {
  let s = removeVietnameseTone(topic.trim()).replace(/\s+/g, ' ').trim()
  const label = /^(?:(?:chu\s*de|bai|chuong|tiet|theme|unit|topic)\s*\d+\s*[:.\-]*\s*|(?:chu\s*de|bai|chuong|tiet|theme|unit|topic)\s*[:.\-]+\s*)+/i
  s = s.replace(label, '')
  s = s.replace(/[^\p{L}\p{N}\s]+/gu, ' ')
  s = s.replace(/\s+/g, ' ').trim()
  return s
}

/** Trích số bài từ topic (vd: "Bài 1: Mệnh đề" -> 1) */
export function extractLessonNumber(topic: string): number | null {
  const m = topic.match(/\b(?:Bài|Bai)\s*(\d+)/i)
  return m ? parseInt(m[1], 10) : null
}

/** Hai topic có khớp không (một là prefix của kia hoặc bằng nhau) */
export function topicsMatch(a: string, b: string): boolean {
  const na = normalizeTopicForSearch(a)
  const nb = normalizeTopicForSearch(b)
  if (!na || !nb) return na === nb
  return na === nb || na.startsWith(nb + ' ') || nb.startsWith(na + ' ')
}
