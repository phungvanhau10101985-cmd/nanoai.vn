export type WeddingTimelineItem = {
  time: string
  title: string
  note: string
}

export function isWeddingTimelineClock(value: string): boolean {
  return /^\d{1,2}:\d{2}$/.test(value.trim())
}

export function normalizeWeddingTimelineClock(value: string): string {
  const trimmed = value.trim()
  const match = trimmed.match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return trimmed
  return `${match[1].padStart(2, '0')}:${match[2]}`
}

export function weddingTimelineItemContent(item: WeddingTimelineItem): string {
  if (item.note) return item.title ? `${item.title} - ${item.note}` : item.note
  return item.title
}

/** Bỏ đúng một dấu cách ngăn cách sau dấu |, giữ dấu cách người dùng đang gõ. */
function timelineContentAfterPipe(line: string, pipeIndex: number): string {
  const rest = line.slice(pipeIndex + 1)
  return rest.startsWith(' ') ? rest.slice(1) : rest
}

function splitTimelineContent(content: string): { title: string; note: string } {
  const parts = content.split(' - ')
  return {
    title: parts[0] ?? '',
    note: parts.slice(1).join(' - '),
  }
}

export function parseWeddingEventTimeline(value: string): WeddingTimelineItem[] {
  const rows = value
    .split('\n')
    .filter((line) => line.length > 0)
    .map((line) => {
      const pipeIndex = line.indexOf('|')
      if (pipeIndex >= 0) {
        const timePart = line.slice(0, pipeIndex).trim()
        const { title, note } = splitTimelineContent(timelineContentAfterPipe(line, pipeIndex))
        return {
          time: normalizeWeddingTimelineClock(timePart),
          title,
          note,
        }
      }

      if (isWeddingTimelineClock(line.trim())) {
        return { time: normalizeWeddingTimelineClock(line), title: '', note: '' }
      }

      const { title, note } = splitTimelineContent(line)
      return {
        time: '',
        title,
        note,
      }
    })

  return rows.length > 0 ? rows : [{ time: '', title: '', note: '' }]
}

export function serializeWeddingEventTimeline(rows: WeddingTimelineItem[]): string {
  return rows
    .map((row) => {
      const time = normalizeWeddingTimelineClock(row.time.trim())
      const content = row.note ? (row.title ? `${row.title} - ${row.note}` : row.note) : row.title
      if (!time && !content) return ''
      if (!time) return content
      return content ? `${time} | ${content}` : `${time} |`
    })
    .filter((line) => line.length > 0)
    .join('\n')
}

export function countWeddingEventTimelineItems(value: string): number {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean).length
}
