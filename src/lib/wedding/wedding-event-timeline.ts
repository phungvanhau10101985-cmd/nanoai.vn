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

export function parseWeddingEventTimeline(value: string): WeddingTimelineItem[] {
  const rows = value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const pipeIndex = line.indexOf('|')
      if (pipeIndex >= 0) {
        const timePart = line.slice(0, pipeIndex).trim()
        const rest = line.slice(pipeIndex + 1).trim()
        const [titlePart, ...noteParts] = rest ? rest.split(' - ').map((part) => part.trim()) : ['']
        return {
          time: normalizeWeddingTimelineClock(timePart),
          title: titlePart || '',
          note: noteParts.join(' - '),
        }
      }

      if (isWeddingTimelineClock(line)) {
        return { time: normalizeWeddingTimelineClock(line), title: '', note: '' }
      }

      const [titlePart, ...noteParts] = line.split(' - ').map((part) => part.trim())
      return {
        time: '',
        title: titlePart || '',
        note: noteParts.join(' - '),
      }
    })

  return rows.length > 0 ? rows : [{ time: '', title: '', note: '' }]
}

export function serializeWeddingEventTimeline(rows: WeddingTimelineItem[]): string {
  return rows
    .map((row) => {
      const time = normalizeWeddingTimelineClock(row.time.trim())
      const title = row.title.trim()
      const note = row.note.trim()
      const content = note ? (title ? `${title} - ${note}` : note) : title
      if (time) return content ? `${time} | ${content}` : `${time} |`
      return content
    })
    .filter(Boolean)
    .join('\n')
}

export function countWeddingEventTimelineItems(value: string): number {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean).length
}
