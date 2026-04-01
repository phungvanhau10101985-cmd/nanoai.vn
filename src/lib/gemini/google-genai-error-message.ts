/**
 * Google GenAI / Veo SDK often puts API errors in Error.message as JSON, e.g.:
 * {"error":{"code":503,"message":"The service is currently unavailable.","status":"UNAVAILABLE"}}
 */

type ParsedGoogleApiError = {
  code?: number
  status?: string
  message?: string
}

/** Lấy một object JSON cân ngoặc từ vị trí `{` (tránh lỗi parse khi sau JSON còn `)` hoặc chữ). */
function extractBalancedJsonFrom(s: string, start: number): string | null {
  if (start < 0 || start >= s.length || s[start] !== '{') return null
  let depth = 0
  let inStr = false
  let esc = false
  for (let i = start; i < s.length; i++) {
    const c = s[i]
    if (esc) {
      esc = false
      continue
    }
    if (c === '\\' && inStr) {
      esc = true
      continue
    }
    if (c === '"') {
      inStr = !inStr
      continue
    }
    if (inStr) continue
    if (c === '{') depth++
    else if (c === '}') {
      depth--
      if (depth === 0) return s.slice(start, i + 1)
    }
  }
  return null
}

function jsonCandidates(raw: string): string[] {
  const t = raw.trim()
  const out = new Set<string>()
  if (t.startsWith('{')) out.add(t)
  let from = 0
  while (from < t.length) {
    const i = t.indexOf('{"error"', from)
    if (i < 0) break
    const balanced = extractBalancedJsonFrom(t, i)
    if (balanced) out.add(balanced)
    from = i + 1
  }
  const j = t.indexOf('{')
  if (j >= 0) {
    const balanced = extractBalancedJsonFrom(t, j)
    if (balanced) out.add(balanced)
  }
  return [...out]
}

function tryParseGoogleApiError(raw: string): ParsedGoogleApiError | null {
  for (const s of jsonCandidates(raw)) {
    try {
      const o = JSON.parse(s) as Record<string, unknown>
      const err = o.error
      if (typeof err === 'string') return { message: err }
      if (err && typeof err === 'object') {
        const e = err as Record<string, unknown>
        const codeRaw = e.code
        const code =
          typeof codeRaw === 'number'
            ? codeRaw
            : typeof codeRaw === 'string' && /^\d+$/.test(codeRaw)
              ? Number(codeRaw)
              : undefined
        return {
          code,
          status: typeof e.status === 'string' ? e.status : undefined,
          message: typeof e.message === 'string' ? e.message : undefined,
        }
      }
    } catch {
      continue
    }
  }
  return null
}

function isTransientUnavailable(parsed: ParsedGoogleApiError, raw: string): boolean {
  const code = parsed.code
  const statusRaw = parsed.status ?? ''
  const status = statusRaw.toUpperCase()
  const msg = (parsed.message ?? '').toLowerCase()
  if (code === 503 || code === 429) return true
  if (status === 'UNAVAILABLE' || status === 'RESOURCE_EXHAUSTED') return true
  // API đôi khi trả status: "Service Unavailable" (không phải enum gRPC ngắn).
  if (/unavailable|resource_exhausted/i.test(statusRaw)) return true
  if (msg.includes('unavailable') || msg.includes('overloaded')) return true
  if (/503|unavailable|resource_exhausted|currently unavailable|không tải được video.*503|mã http 503/i.test(raw))
    return true
  return false
}

const OVERLOAD_VI = 'Hệ thống quá tải hoặc dịch vụ tạm tắt. Vui lòng thử lại sau vài phút.'

/** SDK / runtime đôi khi chỉ trả message ngắn khi stream hoặc server action bị cắt (timeout, deploy, tab đóng). */
function isLikelyTimeoutOrAbortMessage(raw: string): boolean {
  const t = raw.trim().toLowerCase()
  if (t === 'terminated' || t === 'abort' || t === 'aborted') return true
  return (
    /\bterminated\b/i.test(raw) ||
    /\babort(ed)?\b/i.test(raw) ||
    /econnreset|socket hang up|etimedout|timed out|timeout/i.test(raw) ||
    /body.*?timeout|fetch failed|network error/i.test(t)
  )
}

const VEO_TIMEOUT_EXTEND_VI =
  'Kéo dài video bị ngắt hoặc hết thời gian chờ (Veo thường mất vài phút). Hãy thử lại; nếu vẫn lỗi, tạo clip 8s mới rồi kéo dài khi URI Google còn hiệu lực.'

const VEO_TIMEOUT_CREATE_VI =
  'Tạo video bị ngắt hoặc hết thời gian chờ (Veo thường mất vài phút). Hãy thử lại sau ít phút.'

function truncate(s: string, max: number): string {
  if (s.length <= max) return s
  return `${s.slice(0, max - 1)}…`
}

export function formatGoogleGenAiCaughtErrorForVeoCreate(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e)
  if (isLikelyTimeoutOrAbortMessage(raw)) return VEO_TIMEOUT_CREATE_VI
  const parsed = tryParseGoogleApiError(raw)
  if (parsed && isTransientUnavailable(parsed, raw)) return OVERLOAD_VI
  if (/500|Internal Server Error|quota|limit/i.test(raw)) return OVERLOAD_VI
  if (parsed?.message && parsed.message.length > 0 && parsed.message.length < 500) {
    return `Tạo video thất bại: ${parsed.message}`
  }
  return `Tạo video thất bại: ${truncate(raw, 280)}`
}

export function formatGoogleGenAiCaughtErrorForVeoExtend(e: unknown): string {
  const raw = (e instanceof Error ? e.message : String(e)).trim()
  if (isLikelyTimeoutOrAbortMessage(raw)) return VEO_TIMEOUT_EXTEND_VI
  const uriHint =
    'Không kéo dài được (có thể URI Google đã hết hạn hoặc hệ thống quá tải). Thử tạo clip 720p 8s mới và kéo dài trong vài giờ tới.'
  const parsed = tryParseGoogleApiError(raw)
  if (parsed && isTransientUnavailable(parsed, raw)) return OVERLOAD_VI
  if (/500|Internal Server Error|quota|limit/i.test(raw)) return OVERLOAD_VI
  if (/expired|not found|invalid/i.test(raw)) return uriHint
  /** `downloadVeoVideoToBuffer` đã trả cây tiếng Việt đủ — tránh «Kéo dài…: Không tải…». */
  if (raw.startsWith('Không tải được video') || raw.startsWith('Không lấy được dữ liệu video')) {
    return raw
  }
  if (parsed?.message && parsed.message.length > 0 && parsed.message.length < 500) {
    return `Kéo dài video thất bại: ${parsed.message}`
  }
  return `Kéo dài video thất bại: ${truncate(raw, 280)}`
}

export function formatGoogleGenAiCaughtErrorForLyrics(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e)
  const lighterOverload = 'Hệ thống quá tải. Vui lòng thử lại sau vài phút.'
  if (isLikelyTimeoutOrAbortMessage(raw)) return lighterOverload
  const parsed = tryParseGoogleApiError(raw)
  if (parsed && isTransientUnavailable(parsed, raw)) return lighterOverload
  if (/500|Internal Server Error|quota|limit/i.test(raw)) return lighterOverload
  if (parsed?.message && parsed.message.length > 0 && parsed.message.length < 500) {
    return `Sinh lời thất bại: ${parsed.message}`
  }
  return `Sinh lời thất bại: ${truncate(raw, 280)}`
}
