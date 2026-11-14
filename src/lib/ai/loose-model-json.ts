/** Đọc JSON model trả về. Bản đúng giữ nguyên. Chỉ nới khi `JSON.parse` thất bại. */

function stripJsonFence(raw: string): string {
  return raw.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim()
}

/** `\vec` không phải escape JSON. `\n`, `\"`, `\\`, `\u` giữ nguyên. */
export function repairJsonEscapes(text: string): string {
  return text
    .replace(/\\u(?![0-9a-fA-F]{4})/g, '\\\\u')
    .replace(/\\(?!["\\/bfnrtu])/g, '\\\\')
}

function relaxBrokenJson(text: string): string {
  return repairJsonEscapes(text).replace(/,\s*([}\]])/g, '$1')
}

function sliceOuterJson(text: string): string | null {
  const startObj = text.indexOf('{')
  const startArr = text.indexOf('[')
  let start = -1
  if (startObj >= 0 && startArr >= 0) start = Math.min(startObj, startArr)
  else start = Math.max(startObj, startArr)
  if (start < 0) return null
  const end = Math.max(text.lastIndexOf('}'), text.lastIndexOf(']'))
  if (end <= start) return null
  return text.slice(start, end + 1)
}

export function parseLooseJson(raw: string): unknown {
  const cleaned = stripJsonFence(raw)
  const slices = [cleaned]
  const outer = sliceOuterJson(cleaned)
  if (outer && outer !== cleaned) slices.push(outer)
  let lastError: unknown
  for (const slice of slices) {
    for (const text of [slice, relaxBrokenJson(slice)]) {
      try {
        return JSON.parse(text)
      } catch (error) {
        lastError = error
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error('JSON hỏng')
}

/** Object, phần tử đầu của mảng, hoặc chính object đó. */
export function asJsonObject(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) {
    const first = value.find((item) => item && typeof item === 'object' && !Array.isArray(item))
    return (first as Record<string, unknown> | undefined) ?? null
  }
  if (!value || typeof value !== 'object') return null
  return value as Record<string, unknown>
}
