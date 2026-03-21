type JsonLike = Record<string, unknown> | null | undefined

function stripSolutionHeading(input: string): string {
  return input
    .replace(/^\s*(?:\*\*Lời giải\*\*:\s*|Lời giải:\s*|#{1,6}\s*Lời giải[^\n]*\n\s*)+/i, '')
    .trim()
}

function pickString(v: unknown): string {
  if (typeof v === 'string') return v.trim()
  if (typeof v === 'number') return String(v).trim()
  if (v && typeof v === 'object') {
    const obj = v as Record<string, unknown>
    const nested = pickString(obj.text ?? obj.value ?? obj.content ?? obj.markdown ?? null)
    if (nested) return nested
  }
  return ''
}

/** Đọc đề bài tự luận từ content_json, tương thích nhiều schema cũ. */
export function getEssayProblem(contentJson: unknown): string {
  const c = (contentJson ?? null) as JsonLike
  if (!c || typeof c !== 'object') return ''
  return (
    pickString(c.problem) ||
    pickString(c.question) ||
    pickString(c.prompt) ||
    pickString(c.de_bai) ||
    pickString(c.debai)
  )
}

/** Chuẩn hóa solution (string | array | object) thành string để lưu DB. */
export function normalizeSolutionToStr(v: unknown): string {
  if (typeof v === 'string') return stripSolutionHeading(dedupeSolution(v.trim()))
  if (typeof v === 'number') return String(v)
  if (Array.isArray(v)) {
    const parts = v.map((item) => {
      if (typeof item === 'string') return item.trim()
      if (item && typeof item === 'object') {
        const o = item as Record<string, unknown>
        return String(o.text ?? o.content ?? o.value ?? o.step ?? o.markdown ?? '').trim()
      }
      return ''
    }).filter(Boolean)
    return stripSolutionHeading(dedupeSolution(parts.join('\n\n')))
  }
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>
    return stripSolutionHeading(dedupeSolution(String(o.text ?? o.content ?? o.value ?? '').trim()))
  }
  return ''
}

/** Loại bỏ lời giải bị lặp (AI có thể trả về cùng nội dung 2–3 lần). */
function dedupeSolution(s: string): string {
  if (!s || s.length < 80) return s

  const stripLeadingSolutionMarkers = (input: string): string => stripSolutionHeading(input)

  const normalize = (input: string): string =>
    input
      .toLowerCase()
      .replace(/\r/g, '\n')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[*_`>#-]/g, '')
      .trim()

  const isNearDuplicate = (a: string, b: string): boolean => {
    const na = normalize(a)
    const nb = normalize(b)
    if (!na || !nb) return false
    if (na === nb) return true
    const sampleLen = Math.min(160, Math.max(80, Math.floor(na.length * 0.35)))
    const head = na.slice(0, sampleLen)
    return nb.startsWith(head.slice(0, Math.min(120, head.length)))
  }

  const markers = ['**Lời giải:**', '**Lời giải**', 'Lời giải:']
  for (const marker of markers) {
    const parts = s.split(marker).map((p) => p.trim()).filter(Boolean)
    if (parts.length >= 2) {
      const first = parts[0]!
      const isDuplicate = parts.slice(1).some((p) => p.length > 40 && isNearDuplicate(first, p))
      if (isDuplicate) return first
    }
  }

  // Fallback 0: thân lời giải bị lặp lại (có thể xen marker ở giữa).
  const body = stripLeadingSolutionMarkers(s)
  const probe = body.slice(0, 180).trim()
  if (probe.length >= 70) {
    // Trường hợp rõ nhất: thân bài bị lặp trực tiếp 2 lần trong chính "body".
    const secondInBody = body.indexOf(probe, Math.max(120, probe.length))
    if (secondInBody > 180) {
      const firstBody = body.slice(0, secondInBody).trim()
      const secondBody = body.slice(secondInBody).trim()
      if (isNearDuplicate(firstBody, secondBody)) return firstBody
    }

    // Trường hợp có thêm marker/định dạng chen giữa 2 bản sao.
    const firstAt = s.indexOf(probe)
    const secondAt = firstAt >= 0 ? s.indexOf(probe, firstAt + Math.max(80, Math.floor(probe.length * 0.7))) : -1
    if (secondAt > 180) {
      const firstChunk = s.slice(0, secondAt).trim()
      const secondChunk = s.slice(secondAt).trim()
      if (isNearDuplicate(stripLeadingSolutionMarkers(firstChunk), stripLeadingSolutionMarkers(secondChunk))) {
        return firstChunk
      }
    }
  }

  // Fallback 1: cắt theo cụm heading lặp lại (ví dụ "### Lời giải chi tiết")
  const headingRegex = /(?:^|\n)\s{0,3}#{1,6}\s*Lời giải[^\n]*\n/gi
  const headingMatches = [...s.matchAll(headingRegex)]
  if (headingMatches.length >= 2) {
    const firstIdx = headingMatches[0]?.index ?? -1
    const secondIdx = headingMatches[1]?.index ?? -1
    if (firstIdx >= 0 && secondIdx > firstIdx + 40) {
      const firstBlock = s.slice(firstIdx, secondIdx).trim()
      const secondBlock = s.slice(secondIdx).trim()
      if (isNearDuplicate(firstBlock, secondBlock)) return s.slice(0, secondIdx).trim()
    }
  }

  // Fallback 2: nếu nửa sau giống nửa đầu (chênh nhẹ khoảng trắng/markdown) thì cắt.
  const mid = Math.floor(s.length / 2)
  if (mid > 150) {
    const firstHalf = s.slice(0, mid).trim()
    const secondHalf = s.slice(mid).trim()
    if (isNearDuplicate(firstHalf, secondHalf)) return firstHalf
  }
  return s
}

/** Đọc lời giải tự luận từ content_json, tương thích nhiều schema cũ.
 * Xử lý solution là string, array (các bước), hoặc object. */
export function getEssaySolution(contentJson: unknown): string {
  const c = (contentJson ?? null) as JsonLike
  if (!c || typeof c !== 'object') return ''
  const raw =
    c.solution ?? c.answer ?? c.explanation ?? c.loi_giai ?? c.loigiai ?? c.giai ?? c.suggestedAnswer ?? c.suggested_answer
  const s = normalizeSolutionToStr(raw)
  if (s) return s
  return pickString(raw) || ''
}
