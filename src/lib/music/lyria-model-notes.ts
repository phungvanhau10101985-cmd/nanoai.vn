/** Parse text blobs Lyria sometimes returns: timestamped lines, Caption, Mosic/Music score, BPM. */

export type LyriaParsedModelNotes = {
  segments: Array<{ start: number; end: number; text: string }>
  caption: string | null
  musicScore: number | null
  bpm: number | null
}

const TIMESTAMP_LINE = /^\[(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)\]\s*(.*)$/

export function parseLyriaModelNotes(raw: string): LyriaParsedModelNotes | null {
  const text = raw.trim()
  if (!text) return null

  const lines = text.split(/\r?\n/)
  const segments: LyriaParsedModelNotes['segments'] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    if (!line.trim()) {
      if (segments.length > 0) break
      i++
      continue
    }
    const m = line.match(TIMESTAMP_LINE)
    if (!m) break
    segments.push({
      start: Number(m[1]),
      end: Number(m[2]),
      text: m[3].trim(),
    })
    i++
  }

  const tail = lines.slice(i).join('\n').trim()

  let caption: string | null = null
  const capStop = tail.match(/Caption:\s*([\s\S]*?)(?=\n\s*(?:Mosic|Music|BPM)\s*:)/i)
  if (capStop) caption = capStop[1].trim()
  else {
    const capOnly = tail.match(/Caption:\s*([\s\S]+)$/i)
    if (capOnly) caption = capOnly[1].trim()
  }

  const musicMatch = tail.match(/(?:^|\n)\s*(?:Mosic|Music)\s*:\s*([\d.]+)/im)
  const bpmMatch = tail.match(/(?:^|\n)\s*BPM\s*:\s*([\d.]+)/im)
  const musicScore = musicMatch ? Number(musicMatch[1]) : null
  const bpm = bpmMatch ? Number(bpmMatch[1]) : null

  const hasStructure =
    segments.length > 0 ||
    (caption != null && caption.length > 0) ||
    musicScore != null ||
    bpm != null

  if (!hasStructure) return null

  return {
    segments,
    caption: caption && caption.length > 0 ? caption : null,
    musicScore: musicScore != null && !Number.isNaN(musicScore) ? musicScore : null,
    bpm: bpm != null && !Number.isNaN(bpm) ? bpm : null,
  }
}
