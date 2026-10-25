/** Khóa đối chiếu đề dựng sẵn: cùng tập tên bài, không phụ thuộc thứ tự hay dấu. */
export function normalizeExamTopic(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^bai\s+\d+\s*:\s*/, '')
}

export function examTopicKey(topics: string[]): string {
  const set = new Set(topics.map((t) => normalizeExamTopic(t)).filter(Boolean))
  return [...set].sort().join('\n')
}

export function topicsFromExamConfig(config: unknown): string[] {
  const c = config && typeof config === 'object' && !Array.isArray(config)
    ? (config as Record<string, unknown>)
    : {}
  const curriculumTopics = readTopicList(c.curriculumTopics)
  if (curriculumTopics.length > 0) return curriculumTopics
  return readTopicList(c.lessonTopics)
}

function readTopicList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw.map((x) => String(x ?? '').trim()).filter(Boolean)
}
