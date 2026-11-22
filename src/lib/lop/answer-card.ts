/** Thẻ giấy A B C D. A ở trên khi mã QR đứng thẳng. Xoay thẻ theo chiều kim đồng hồ: B, C, D. */

export type AnswerChoice = 'A' | 'B' | 'C' | 'D'

/** Cách thầy cô cầm máy. Ảnh camera lấy “trên” theo mép trên của điện thoại. */
export type CameraHold = 'portrait' | 'landscape-left' | 'landscape-right'

export type ScanQuestion = {
  prompt: string
  choices: string[]
  correct: AnswerChoice
}

const CHOICES: AnswerChoice[] = ['A', 'B', 'C', 'D']
const TOKEN_RE = /^[A-Za-z0-9_-]{8,32}$/
const PHONE_TOKEN_RE = /^[A-Za-z0-9_-]{16,64}$/
const SEAT_RE = /^(0[1-9]|[1-9][0-9])$/

/** Số thứ tự trong lớp, 01–99. Máy quét đã biết lớp và trường, nên QR chỉ mang số này. */
export function answerCardSeatCode(cardNo: number): string | null {
  if (!Number.isInteger(cardNo) || cardNo < 1 || cardNo > 99) return null
  return String(cardNo).padStart(2, '0')
}

export function answerCardPayload(cardNo: number): string | null {
  return answerCardSeatCode(cardNo)
}

export function parseAnswerCardPayload(raw: string): string | null {
  const text = raw.trim()
  return SEAT_RE.test(text) ? text : null
}

export function isAnswerCardToken(token: string): boolean {
  return TOKEN_RE.test(token)
}

export function isAnswerCardPhoneToken(token: string): boolean {
  return PHONE_TOKEN_RE.test(token)
}

export function isAnswerChoice(value: string): value is AnswerChoice {
  return value === 'A' || value === 'B' || value === 'C' || value === 'D'
}

/**
 * Góc cạnh trên của mã (topLeft → topRight) so với trục x của ảnh.
 * 0° mã đứng thẳng → A. 90° theo chiều kim đồng hồ → B.
 * Máy nằm ngang: mép trên máy không còn là trần lớp, nên cộng bù.
 */
export function choiceFromQrTopEdge(
  topLeft: { x: number; y: number },
  topRight: { x: number; y: number },
  hold: CameraHold
): AnswerChoice {
  const dx = topRight.x - topLeft.x
  const dy = topRight.y - topLeft.y
  let deg = (Math.atan2(dy, dx) * 180) / Math.PI
  if (hold === 'landscape-left') deg -= 90
  if (hold === 'landscape-right') deg += 90
  const norm = ((deg % 360) + 360) % 360
  const quarter = Math.round(norm / 90) % 4
  return CHOICES[quarter] ?? 'A'
}

export function answerCardShortName(full: string): string {
  const parts = full.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean)
  if (parts.length === 0) return '—'
  if (parts.length <= 2) return parts.join(' ')
  return parts.slice(-2).join(' ')
}

export function answerCardDownloadBase(className: string): string {
  const safe = className
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
  return `the-tra-loi-${safe || 'lop'}`
}

export function fillAnswerCardText(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? ''))
}

function optionText(value: unknown): string {
  if (typeof value === 'string') return value.replace(/\s+/g, ' ').trim()
  if (value && typeof value === 'object') {
    const row = value as Record<string, unknown>
    const text = row.text ?? row.label ?? row.content
    if (typeof text === 'string') return text.replace(/\s+/g, ' ').trim()
  }
  return ''
}

/** Chỉ nhận câu 2–4 phương án. Thẻ không có chữ thứ năm. */
export function scanQuestionFromParts(
  prompt: unknown,
  options: unknown,
  correctIndex: unknown
): ScanQuestion | null {
  const text = String(prompt ?? '').replace(/\s+/g, ' ').trim()
  if (!text || text.length > 4000) return null
  if (!Array.isArray(options) || options.length < 2 || options.length > 4) return null
  const index = Number(correctIndex)
  if (!Number.isInteger(index) || index < 0 || index >= options.length) return null
  const choices = options.map((item) => optionText(item).slice(0, 500))
  return {
    prompt: text,
    choices,
    correct: CHOICES[index] ?? 'A',
  }
}

/** Vị trí câu trên đề chiếu, tính trong các câu thẻ A–D, bỏ tự luận. */
export function raisedCardQuestionIndex(canScan: boolean[], position: number): number | null {
  if (!canScan[position]) return null
  let index = 0
  for (let i = 0; i < position; i += 1) {
    if (canScan[i]) index += 1
  }
  return index
}

export function scanQuestionFromWorksheetContent(content: unknown): ScanQuestion | null {
  if (!content || typeof content !== 'object') return null
  const row = content as Record<string, unknown>
  const prompt = row.question ?? row.prompt ?? row.question_text
  const correct = row.correctIndex ?? row.correct_index
  return scanQuestionFromParts(prompt, row.options, correct)
}

export function summarizeAnswerPicks(
  rosterIds: string[],
  picks: Array<{ userId: string; choice: AnswerChoice }>,
  correct: AnswerChoice
): {
  correct: number
  wrong: number
  unanswered: number
  answered: number
  byChoice: Record<AnswerChoice, number>
} {
  const roster = new Set(rosterIds)
  const latest = new Map<string, AnswerChoice>()
  for (const pick of picks) {
    if (!roster.has(pick.userId)) continue
    latest.set(pick.userId, pick.choice)
  }
  const byChoice: Record<AnswerChoice, number> = { A: 0, B: 0, C: 0, D: 0 }
  let correctCount = 0
  let wrong = 0
  for (const choice of latest.values()) {
    byChoice[choice] += 1
    if (choice === correct) correctCount += 1
    else wrong += 1
  }
  return {
    correct: correctCount,
    wrong,
    unanswered: rosterIds.length - latest.size,
    answered: latest.size,
    byChoice,
  }
}
