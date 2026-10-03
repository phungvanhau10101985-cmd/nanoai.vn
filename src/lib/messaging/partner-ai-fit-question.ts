/**
 * Câu hỏi fit cuối tin tư vấn: quần áo hỏi chiều cao/cân nặng;
 * giày/dép hỏi size đang đi — không dùng chiều cao/cân nặng để chốt size giày.
 */

export type FashionFitQuestionRow = {
  name?: string | null
  category_l1?: string | null
  category_l2?: string | null
  category_l3?: string | null
  style?: string | null
}

const SHOE_RE =
  /(?:^|[^\p{L}\p{N}])(?:giày|giay|dép|dep|sandal|boots?|sneaker|loafer|guốc|guoc)(?=$|[^\p{L}\p{N}])/iu
const APPAREL_NAME_RE =
  /(?:^|[^\p{L}\p{N}])(?:áo|ao|quần|quan|váy|vay|đầm|dam|blazer|vest|khoác|khoac)(?=$|[^\p{L}\p{N}])/iu
const HEIGHT_WEIGHT_SENTENCE_RE =
  /[^.!?\n]*chi[eề]u\s*cao(?:\s*\([^)]{0,16}\))?\s*(?:và|va|,)\s*c[aâ]n\s*n[aặ]ng(?:\s*\([^)]{0,16}\))?[^.!?\n]*[.!?]?/giu

export function inventoryRowLooksLikeShoes(row: FashionFitQuestionRow | null | undefined): boolean {
  if (!row) return false
  const name = String(row.name ?? '')
  const categories = [row.category_l1, row.category_l2, row.category_l3, row.style]
    .map((s) => String(s ?? ''))
    .join(' ')
  const nameIsShoe = SHOE_RE.test(name)
  const nameIsApparel = APPAREL_NAME_RE.test(name)
  if (nameIsApparel) return false
  if (nameIsShoe) return true
  return SHOE_RE.test(categories)
}

function shoeSizeFitQuestion(sentence: string): string {
  const match = sentence.match(/(?:^|[^\p{L}])(anh|chị|bạn|mình)(?=[^\p{L}]|$)/iu)
  const word = match?.[1] ?? 'Anh'
  const who = word.charAt(0).toLocaleUpperCase('vi-VN') + word.slice(1)
  return `${who} thường đi size bao nhiêu để em tư vấn tiếp nhé?`
}

/** Giày/dép: đổi câu hỏi chiều cao–cân nặng thành hỏi size đang đi. */
export function rewriteShoeHeightWeightFitQuestion(
  message: string,
  row: FashionFitQuestionRow | null | undefined
): string {
  const raw = String(message ?? '').trim()
  if (!raw || !inventoryRowLooksLikeShoes(row)) return message
  if (!HEIGHT_WEIGHT_SENTENCE_RE.test(raw)) return message
  HEIGHT_WEIGHT_SENTENCE_RE.lastIndex = 0
  let replaced = false
  const next = raw.replace(HEIGHT_WEIGHT_SENTENCE_RE, (sentence) => {
    if (replaced) return ' '
    replaced = true
    return ` ${shoeSizeFitQuestion(sentence)} `
  })
  return next
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([.!?])/g, '$1')
    .trim()
}
