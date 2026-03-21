/**
 * Số thứ tự bài (1.8 < 1.9) — dùng chung cho danh sách câu (catalog) và thứ tự slide giao-vien.
 * Ưu tiên parse từ nội dung đề (preview) trước topic "Bài 1: …".
 */
export function parseExerciseIndex(topic: string, preview: string): { major: number; minor: number } | null {
  const prev = String(preview ?? '')
    .replace(/\r\n/g, '\n')
    .trim()
  const top = String(topic ?? '').trim()
  const head = prev.slice(0, 1600)

  const stripMd = (s: string) => s.replace(/^\*{1,2}\s*/, '').replace(/\*{1,2}\s*$/, '').trim()

  const lines = head
    .split('\n')
    .map((l) => stripMd(l.trim()))
    .filter(Boolean)

  for (const line of lines.slice(0, 16)) {
    const h = line.match(/^#{1,6}\s*Bài\s+(\d+)\.(\d+)\b/i)
    if (h) return { major: parseInt(h[1], 10), minor: parseInt(h[2], 10) }
    const cau = line.match(/^Câu\s+(\d+)\.(\d+)\b/i)
    if (cau) return { major: parseInt(cau[1], 10), minor: parseInt(cau[2], 10) }
    const nm =
      line.match(/^(\d+)\.(\d+)\s*(?:[.),]|(?=\s|$))/) ||
      line.match(/^(\d+)\.(\d+)\b(?!\d)/)
    if (nm) return { major: parseInt(nm[1], 10), minor: parseInt(nm[2], 10) }
    const single = line.match(/^(\d+)\.\s+(?!\d)/)
    if (single) return { major: parseInt(single[1], 10), minor: 0 }
  }

  const anyInHead = head.match(/(?:^|\n)\s*\*{0,2}\s*(\d+)\.(\d+)\s*(?:[.),]|\b)/m)
  if (anyInHead) {
    return { major: parseInt(anyInHead[1], 10), minor: parseInt(anyInHead[2], 10) }
  }

  const baiTop =
    top.match(/Bài\s+(\d+)\.(\d+)\s*[.:]/i) ||
    top.match(/Bài\s+(\d+)\.(\d+)\b/i)
  if (baiTop) {
    return { major: parseInt(baiTop[1], 10), minor: parseInt(baiTop[2], 10) }
  }
  const baiSingle = top.match(/Bài\s+(\d+)\s*[.:]/i) || top.match(/Bài\s+(\d+)\b/i)
  if (baiSingle) return { major: parseInt(baiSingle[1], 10), minor: 0 }

  const baiPrev = head.match(/Bài\s+(\d+)\.(\d+)/i)
  if (baiPrev) {
    return { major: parseInt(baiPrev[1], 10), minor: parseInt(baiPrev[2], 10) }
  }

  return null
}

/** So sánh hai chỉ số đã parse; null xếp sau; tiebreak khi bằng nhau. */
export function compareExerciseIndexParsed(
  a: { major: number; minor: number } | null,
  b: { major: number; minor: number } | null,
  tiebreak: () => number
): number {
  if (a && b) {
    if (a.major !== b.major) return a.major - b.major
    if (a.minor !== b.minor) return a.minor - b.minor
    return tiebreak()
  }
  if (a && !b) return -1
  if (!a && b) return 1
  return tiebreak()
}
