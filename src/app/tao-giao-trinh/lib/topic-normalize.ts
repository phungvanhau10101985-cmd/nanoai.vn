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

/** Chuẩn hóa topic để so sánh/tìm kiếm: bỏ Bài X:, lowercase, bỏ dấu, gộp space */
export function normalizeTopicForSearch(topic: string): string {
  let s = topic.trim()
  s = s.replace(/\b(Bài|Bai)\s*\d+\s*[:\.]?\s*/gi, '')
  s = s.replace(/\b(Chương|Chuong)\s*\d+\s*[:\.]?\s*/gi, '')
  s = s.replace(/\b(Tiết|Tiet)\s*\d+\s*[:\.]?\s*/gi, '')
  s = s.replace(/\s+/g, ' ').trim()
  s = removeVietnameseTone(s)
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
