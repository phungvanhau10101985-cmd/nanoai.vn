/** Độ dài tối đa mỗi bong bóng chat — chia đoạn cho dễ đọc (tư vấn AI). */
const CHUNK_SOFT_MAX = 400

function cutAtSemanticBoundary(s: string, max: number): { text: string; rest: string } {
  if (s.length <= max) return { text: s, rest: '' }
  const window = s.slice(0, max + 1)

  const nl = window.lastIndexOf('\n')
  if (nl >= max * 0.32) {
    return { text: s.slice(0, nl).trimEnd(), rest: s.slice(nl + 1).trimStart() }
  }

  const punctRe = /[.!?…。]["')\]]?\s+/g
  let best = -1
  let m: RegExpExecArray | null
  while ((m = punctRe.exec(window)) !== null) {
    const end = m.index + m[0].length
    if (end <= max && end > best) best = end
  }
  if (best > max * 0.22) {
    return { text: s.slice(0, best).trimEnd(), rest: s.slice(best).trimStart() }
  }

  const sp = window.lastIndexOf(' ')
  if (sp >= max * 0.45) {
    return { text: s.slice(0, sp).trimEnd(), rest: s.slice(sp + 1).trimStart() }
  }

  return { text: s.slice(0, max).trimEnd(), rest: s.slice(max).trimStart() }
}

/** Gộp mảnh quá ngắn vào tin trước nếu còn chỗ (tránh nhiều bong bóng 1–2 từ). */
function mergeShortFragments(chunks: string[], minLen: number, hardMax: number): string[] {
  if (chunks.length <= 1) return chunks
  const out: string[] = []
  for (const c of chunks) {
    const t = c.trim()
    if (!t) continue
    const last = out[out.length - 1]
    if (
      last &&
      t.length < minLen &&
      last.length + t.length + 2 <= Math.floor(hardMax * 1.12)
    ) {
      out[out.length - 1] = `${last}\n\n${t}`
    } else {
      out.push(t)
    }
  }
  return out
}

/**
 * Chia nội dung tư vấn dài thành nhiều đoạn ngắt ý (đoạn → câu → từ).
 * Trả về ít nhất một phần nếu `body` không rỗng.
 */
export function splitAutomatedReplyIntoChunks(body: string): string[] {
  const normalized = body.replace(/\r\n/g, '\n').trim()
  if (!normalized) return []

  if (normalized.length <= CHUNK_SOFT_MAX) return [normalized]

  const out: string[] = []
  const paragraphs = normalized.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)
  const blocks = paragraphs.length > 0 ? paragraphs : [normalized]

  for (const block of blocks) {
    if (block.length <= CHUNK_SOFT_MAX) {
      out.push(block)
      continue
    }
    let rest = block
    let guard = 0
    while (rest.length > CHUNK_SOFT_MAX && guard < 500) {
      guard += 1
      const head = cutAtSemanticBoundary(rest, CHUNK_SOFT_MAX)
      if (!head.text.length) {
        out.push(rest.slice(0, CHUNK_SOFT_MAX))
        rest = rest.slice(CHUNK_SOFT_MAX).trimStart()
        continue
      }
      out.push(head.text)
      rest = head.rest
    }
    if (rest.length) out.push(rest)
  }

  return mergeShortFragments(out, 28, CHUNK_SOFT_MAX)
}
