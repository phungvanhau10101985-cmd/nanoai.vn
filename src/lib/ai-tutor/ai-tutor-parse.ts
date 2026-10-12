import type { TutorAnswer, TutorLabel, TutorShare } from '@/lib/ai-tutor/ai-tutor-types'

export function tutorTopicKey(raw: string): string {
  const ascii = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
    .replace(/-+$/g, '')
  return ascii.length >= 3 ? ascii : ''
}

export function cleanTutorLine(value: unknown, max: number): string {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
    .trim()
}

export function cleanTutorProse(value: unknown, max: number): string {
  return String(value ?? '')
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
    .slice(0, max)
    .trim()
}

export function parseTutorLabels(raw: unknown): TutorLabel[] {
  if (!Array.isArray(raw)) return []
  const out: TutorLabel[] = []
  const seen = new Set<string>()
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    if (row.ok === false) continue
    const key = tutorTopicKey(String(row.key ?? row.topicKey ?? ''))
    const title = cleanTutorLine(row.title, 80)
    if (!key || !title || seen.has(key)) continue
    seen.add(key)
    out.push({ key, title })
    if (out.length === 3) break
  }
  return out
}

export function parseTutorClassify(raw: unknown): { topicKey: string; title: string; reuse: boolean } | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Record<string, unknown>
  const topicKey = tutorTopicKey(String(row.topicKey ?? ''))
  const title = cleanTutorLine(row.title, 80)
  if (!topicKey || !title) return null
  return { topicKey, title, reuse: row.reuse === true }
}

export function parseTutorDraft(raw: unknown): { explanation: string; practice: string; labels: TutorLabel[] } | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Record<string, unknown>
  const explanation = cleanTutorProse(row.explanation, 2000)
  const practice = cleanTutorProse(row.practice, 800)
  const labels = parseTutorLabels(row.labels)
  if (!explanation || !practice || labels.length < 2) return null
  return { explanation, practice, labels }
}

export function parseTutorCheck(raw: unknown): {
  ok: boolean
  explanation: string
  practice: string
  labels: TutorLabel[]
} | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Record<string, unknown>
  if (typeof row.ok !== 'boolean') return null
  if (!row.ok) return { ok: false, explanation: '', practice: '', labels: [] }
  const explanation = cleanTutorProse(row.explanation, 2000)
  const practice = cleanTutorProse(row.practice, 800)
  const labels = parseTutorLabels(row.labels)
  if (!explanation || !practice || labels.length < 2) {
    return { ok: false, explanation: '', practice: '', labels: [] }
  }
  return { ok: true, explanation, practice, labels }
}

export function parseStoredTutorAnswer(payload: unknown, topicKey: string): TutorAnswer | null {
  if (!payload || typeof payload !== 'object') return null
  const row = payload as Record<string, unknown>
  const explanation = cleanTutorProse(row.explanation, 2000)
  if (!explanation) return null
  const share: TutorShare =
    row.share === 'reused' || row.share === 'saved' || row.share === 'private' ? row.share : 'saved'
  const key = tutorTopicKey(String(row.topicKey ?? topicKey)) || topicKey
  return {
    topicKey: key,
    title: cleanTutorLine(row.title, 80),
    explanation,
    practice: cleanTutorProse(row.practice, 800),
    labels: parseTutorLabels(row.labels),
    share,
  }
}
