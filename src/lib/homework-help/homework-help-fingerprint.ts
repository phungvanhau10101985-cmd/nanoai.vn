import { createHash } from 'node:crypto'

const LABEL_PREFIX =
  /^(?:câu|bài|question|problem|q|题|問|문제)\s*\d{1,3}\s*[:.)．。、\-–]\s*/i
const BARE_NUMBER_PREFIX = /^\d{1,2}\s*[:.)．。]\s*/

/** Cùng một đề dù lệch số câu, dấu cách, hoặc dấu câu. */
export function normalizeHomeworkStatement(raw: string): string {
  let text = raw.normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase()
  for (let i = 0; i < 2; i += 1) {
    const next = text.replace(LABEL_PREFIX, '').replace(BARE_NUMBER_PREFIX, '').trim()
    if (next === text) break
    text = next
  }
  return text.replace(/\s+/g, '').replace(/[.,;:!?。，；：！？]+/g, '')
}

export function homeworkStatementFingerprint(statement: string): string {
  return createHash('sha256').update(normalizeHomeworkStatement(statement), 'utf8').digest('hex')
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
      if (joined) pieces.push(joined.slice(0, 1200))
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

export function homeworkPhotoCacheKey(images: Array<{ base64: string }>): string {
  const parts = images.map((image) =>
    createHash('sha256').update(Buffer.from(image.base64, 'base64')).digest('hex')
  )
  return createHash('sha256').update(parts.join('|'), 'utf8').digest('hex')
}
