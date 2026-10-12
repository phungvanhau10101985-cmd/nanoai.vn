import { tutorTopicKey } from '@/lib/ai-tutor/ai-tutor-parse'
import type { TutorLabel } from '@/lib/ai-tutor/ai-tutor-types'

export type TutorTopicName = {
  topicKey: string
  title: string
}

/** Chữ thường, bỏ dấu, gom khoảng trắng. Dùng để khớp tên đã lưu. */
export function foldTutorTitle(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

const LEAD_IN =
  /^(?:bai hoc ve|hoc ve|bai ve|noi ve|tim hieu ve|giai thich ve|giai thich|cho toi hoc|day toi ve|day ve|hoc)\s+/

function questionFold(raw: string): string {
  let folded = foldTutorTitle(raw)
  for (let i = 0; i < 3; i += 1) {
    const next = folded.replace(LEAD_IN, '').trim()
    if (next === folded) break
    folded = next
  }
  return folded
}

function phraseIn(haystack: string, needle: string): boolean {
  if (!needle) return false
  return ` ${haystack} `.includes(` ${needle} `)
}

function titlesInside(text: string, saved: TutorTopicName[]): TutorTopicName[] {
  const folded = questionFold(text)
  if (!folded) return []
  const hits = saved.filter((row) => {
    const title = foldTutorTitle(row.title)
    if (!title) return false
    if (title === folded) return true
    const words = title.split(' ').filter(Boolean)
    if (words.length < 2) return false
    return phraseIn(folded, title)
  })
  return hits.filter((row) => {
    const title = foldTutorTitle(row.title)
    return !hits.some((other) => {
      if (other.topicKey === row.topicKey) return false
      const longer = foldTutorTitle(other.title)
      return longer.length > title.length && phraseIn(longer, title)
    })
  })
}

/**
 * Câu học sinh nói đúng một chủ đề đã lưu thì lấy chủ đề đó.
 * Nhiều chủ đề cùng xuất hiện thì để bước phân loại chọn.
 * `saved` theo thứ tự tạo, bản đầu thắng khi trùng tên.
 */
export function pickSavedTopicFromQuestion(text: string, saved: TutorTopicName[]): TutorTopicName | null {
  const folded = questionFold(text)
  const exact = saved.find((row) => foldTutorTitle(row.title) === folded)
  if (exact) return exact
  const hits = titlesInside(text, saved)
  if (hits.length !== 1) return null
  return hits[0] ?? null
}

/** Bấm nhãn: khớp tên trước, khóa chỉ là dự phòng. Không cần biết nhãn nằm ở bài nào. */
export function pickSavedTopicByTag(
  label: { key: string; title: string },
  saved: TutorTopicName[]
): TutorTopicName | null {
  const title = foldTutorTitle(label.title)
  const byTitle = title ? saved.find((row) => foldTutorTitle(row.title) === title) : undefined
  if (byTitle) return byTitle
  const key = tutorTopicKey(label.key)
  if (!key) return null
  return saved.find((row) => row.topicKey === key) ?? null
}

/** Phân loại xong: cùng tên hoặc cùng khóa với bản đã lưu thì dùng bản đó. */
export function pickSavedTopicFromClassified(
  classified: { topicKey: string; title: string },
  saved: TutorTopicName[]
): TutorTopicName | null {
  return pickSavedTopicByTag({ key: classified.topicKey, title: classified.title }, saved)
}

/** Nhãn mới trùng tên đã lưu thì gắn đúng khóa đó. Chủ đề không tự gắn làm nhãn của chính nó. */
export function bindLabelsToSaved(
  labels: TutorLabel[],
  saved: TutorTopicName[],
  parentTitle: string
): TutorLabel[] {
  const parent = foldTutorTitle(parentTitle)
  const out: TutorLabel[] = []
  const seenKey = new Set<string>()
  const seenTitle = new Set<string>()
  for (const label of labels) {
    const folded = foldTutorTitle(label.title)
    if (!folded || folded === parent) continue
    const known = saved.find((row) => foldTutorTitle(row.title) === folded)
    const key = known?.topicKey || label.key
    const title = known?.title || label.title
    const titleFold = foldTutorTitle(title)
    if (!key || seenKey.has(key) || seenTitle.has(titleFold)) continue
    seenKey.add(key)
    seenTitle.add(titleFold)
    out.push({ key, title })
    if (out.length === 3) break
  }
  return out
}
