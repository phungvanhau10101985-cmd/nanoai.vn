import { createHash } from 'node:crypto'

const LABEL_PREFIX =
  /^(?:câu|bài|question|problem|q|题|問|문제)\s*\d{1,3}\s*[:.)．。、\-–]\s*/i
const BARE_NUMBER_PREFIX = /^\d{1,2}\s*[:.)．。]\s*/
const SUBSCRIPT_DIGITS = '₀₁₂₃₄₅₆₇₈₉'
const SUPERSCRIPT_DIGITS = '⁰¹²³⁴⁵⁶⁷⁸⁹'
const SCORE_PATTERN = /\(\s*\d+(?:[.,]\d+)?\s*đi[eể]m\s*\)/gi
const EXAM_LABEL =
  /(?:^|[\s])(?:câu|bài|question|problem|q|题|問|문제)\s*(?:\d{1,3}|[ivxlcdm]{1,8})\s*[:.)．。、\-–]*/gi
const LIST_MARKER = /(?:^|\s)\d{1,2}\s*[.)．、]\s+(?=[^\d\s])/g
const EQUATION_NUMBER = /\(\s*\d{1,2}\s*\)/g
const DATA_TOKEN = /[A-Z][a-z]?(?:\d+|(?:[A-Z][a-z]?\d*)+|\([A-Za-z0-9]+\)\d*)+|\d+(?:[.,]\d+)?/g

/** Số dưới/trên dòng thành số thường để FeCO₃ và FeCO3 là một công thức. */
export function foldPlainScience(value: string): string {
  let text = value.normalize('NFKC')
  for (let i = 0; i < 10; i += 1) {
    text = text.split(SUBSCRIPT_DIGITS[i] ?? '').join(String(i))
    text = text.split(SUPERSCRIPT_DIGITS[i] ?? '').join(String(i))
  }
  return text
}

function plainToken(raw: string): string {
  if (/^\d/.test(raw)) {
    const num = Number(raw.replace(',', '.'))
    return Number.isFinite(num) ? String(num) : ''
  }
  return raw.toLowerCase().replace(/[()]/g, '')
}

/**
 * Công thức và số liệu theo thứ tự trên đề, bỏ nhãn câu và điểm.
 * Hai lời đọc khác chữ nhưng cùng dữ kiện ra cùng một chuỗi.
 */
export function homeworkDataSignature(statement: string): string {
  let text = foldPlainScience(statement).replace(SCORE_PATTERN, ' ')
  text = text.replace(EXAM_LABEL, ' ').replace(EQUATION_NUMBER, ' ').replace(LIST_MARKER, ' ')
  const tokens: string[] = []
  for (const match of text.matchAll(DATA_TOKEN)) {
    const token = plainToken(match[0])
    if (token) tokens.push(token)
  }
  return tokens.join('|')
}

/** Cùng một đề dù lệch số câu, dấu cách, hoặc dấu câu. */
export function normalizeHomeworkStatement(raw: string): string {
  let text = foldPlainScience(raw).replace(/\s+/g, ' ').trim().toLowerCase()
  for (let i = 0; i < 2; i += 1) {
    const next = text.replace(LABEL_PREFIX, '').replace(BARE_NUMBER_PREFIX, '').trim()
    if (next === text) break
    text = next
  }
  return text.replace(/\s+/g, '').replace(/[.,;:!?。，；：！？]+/g, '')
}

export function homeworkStatementFingerprint(statement: string): string {
  const parts = homeworkDataSignature(statement).split('|').filter(Boolean)
  const basis = parts.length >= 4 ? parts.join('|') : normalizeHomeworkStatement(statement)
  return createHash('sha256').update(basis, 'utf8').digest('hex')
}

/** Nhiều câu nhưng không câu nào mang dữ kiện: ảnh mới chỉ đọc phần hỏi. */
export function homeworkReadIsThin(statements: string[]): boolean {
  if (statements.length < 2) return false
  return statements.every((statement) => homeworkDataSignature(statement).split('|').filter(Boolean).length < 3)
}

const TYPED_QUESTION_START =
  /^(?:câu|bài|question|problem|题|問|문제)\s*\d{1,3}\s*[:.)．。、\-–]\s*\S/i

/** Một ô gõ: một câu, hoặc nhiều câu cách nhau một dòng trống / nhãn Câu 1, Câu 2. */
export function splitTypedHomework(raw: string): string[] {
  const text = raw.replace(/\r\n/g, '\n').trim().slice(0, 8000)
  if (!text) return []
  const pieces: string[] = []
  for (const block of text.split(/\n\s*\n/)) {
    const lines = block.split('\n')
    let current: string[] = []
    const flush = () => {
      const joined = current.join('\n').replace(/\s+/g, ' ').trim()
      if (joined) pieces.push(joined.slice(0, 4000))
      current = []
    }
    for (const line of lines) {
      const trimmed = line.trim()
      if (trimmed && TYPED_QUESTION_START.test(trimmed) && current.some((item) => item.trim())) flush()
      current.push(line)
    }
    flush()
    if (pieces.length >= 8) break
  }
  return pieces.slice(0, 8)
}

const GIVEN_ILLUSTRATION =
  /(?:hình\s*(?:minh\s*họa|minh\s*hoa|vẽ|bên|dưới|trên|sau|kèm|đính\s*kèm|\d+|[a-d]\b)|như\s+hình|xem\s+hình|theo\s+hình|trên\s+hình|ở\s+hình|\(\s*hình|figure\s*\d|fig\.?\s*\d|as\s+shown|shown\s+in\s+the\s+(?:figure|diagram|graph)|sơ\s*đồ\s*(?:mạch|bên|sau|dưới|\d)|如图|见图|图\s*\d|図\s*\d|그림\s*\d)/i

/** Đề trỏ tới hình có sẵn trên ảnh. Câu chỉ bảo học sinh tự vẽ thì không cần gửi ảnh. */
export function homeworkStatementNeedsPhoto(statement: string): boolean {
  const text = statement.normalize('NFKC').replace(/\s+/g, ' ').trim()
  if (!text) return false
  const withoutDrawTask = text.replace(
    /(?:hãy\s+)?(?:vẽ|draw|sketch|plot)\s+(?:lại\s+)?(?:một\s+|các\s+|the\s+|a\s+)?(?:đồ thị|hình|sơ đồ|biểu đồ|graph|figure|diagram|chart)/gi,
    ' '
  )
  return GIVEN_ILLUSTRATION.test(withoutDrawTask)
}

export function homeworkPhotoCacheKey(images: Array<{ base64: string }>): string {
  const parts = images.map((image) =>
    createHash('sha256').update(Buffer.from(image.base64, 'base64')).digest('hex')
  )
  return createHash('sha256').update(parts.join('|'), 'utf8').digest('hex')
}
