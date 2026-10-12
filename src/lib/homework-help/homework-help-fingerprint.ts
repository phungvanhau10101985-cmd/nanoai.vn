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

export function homeworkPhotoCacheKey(images: Array<{ base64: string }>): string {
  const parts = images.map((image) =>
    createHash('sha256').update(Buffer.from(image.base64, 'base64')).digest('hex')
  )
  return createHash('sha256').update(parts.join('|'), 'utf8').digest('hex')
}
