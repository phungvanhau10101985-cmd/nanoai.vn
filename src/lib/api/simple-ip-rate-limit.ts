/**
 * Giới hạn tần suất theo khóa (vd. IP + partnerId) — phù hợp một process (VPS).
 * Serverless nhiều instance: mỗi instance có bộ đếm riêng (vẫn có ích).
 */

type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()

function pruneIfStale(key: string, now: number) {
  const b = buckets.get(key)
  if (b && now >= b.resetAt) buckets.delete(key)
}

/**
 * @returns true nếu đã vượt giới hạn (nên trả 429).
 */
export function isRateLimited(key: string, max: number, windowMs: number): boolean {
  const now = Date.now()
  pruneIfStale(key, now)
  let b = buckets.get(key)
  if (!b || now >= b.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return false
  }
  b.count += 1
  return b.count > max
}

/** Số giây nên chờ trước khi thử lại (HTTP Retry-After). */
export function getRateLimitRetryAfterSec(key: string): number {
  const b = buckets.get(key)
  if (!b) return 60
  return Math.max(1, Math.ceil((b.resetAt - Date.now()) / 1000))
}

/** IP gần đúng của client (reverse proxy thường set X-Forwarded-For). */
export function getClientIpFromRequest(req: Request): string {
  const xff = req.headers.get('x-forwarded-for')
  if (xff) {
    const first = xff.split(',')[0]?.trim()
    if (first) return first.slice(0, 64)
  }
  const real = req.headers.get('x-real-ip')?.trim()
  if (real) return real.slice(0, 64)
  return 'unknown'
}
