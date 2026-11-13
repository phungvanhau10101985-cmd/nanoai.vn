/**
 * Bật So khớp nâng cao tự động trên pixel (Events Manager).
 * Token CAPI đôi khi không có quyền sửa pixel — lỗi không chặn lưu cấu hình.
 */
const GRAPH_VERSION = 'v21.0'

/** Đúng các mục Meta liệt kê trong bước xác minh khách hàng. */
export const META_AUTOMATIC_MATCHING_FIELDS = [
  'em',
  'ph',
  'fn',
  'ln',
  'ge',
  'db',
  'ct',
  'st',
  'zp',
  'country',
  'external_id',
] as const

const enabledPixelIds = new Set<string>()
const failedUntilMs = new Map<string, number>()
const inflight = new Map<string, Promise<'enabled' | 'failed' | 'skipped'>>()
const FAIL_COOLDOWN_MS = 60 * 60 * 1000

export function metaAutomaticMatchingUpdateBody(accessToken: string): {
  enable_automatic_matching: true
  automatic_matching_fields: string[]
  access_token: string
} {
  return {
    enable_automatic_matching: true,
    automatic_matching_fields: [...META_AUTOMATIC_MATCHING_FIELDS],
    access_token: accessToken,
  }
}

/** Một lần thành công / pixel / process. Lỗi thì nghỉ một giờ, trừ khi `force` (lúc merchant bấm Lưu). */
export async function ensureMetaPixelAutomaticMatching(
  pixelId: string,
  accessToken: string,
  options?: { force?: boolean }
): Promise<'enabled' | 'failed' | 'skipped'> {
  const id = pixelId.trim()
  const token = accessToken.trim()
  if (!/^\d{10,20}$/.test(id) || token.length < 20) return 'skipped'
  if (enabledPixelIds.has(id)) return 'skipped'
  if (!options?.force && Date.now() < (failedUntilMs.get(id) || 0)) return 'skipped'
  const pending = inflight.get(id)
  if (pending && !options?.force) return pending
  const job = postMetaPixelAutomaticMatching(id, token)
  inflight.set(id, job)
  void job.finally(() => {
    if (inflight.get(id) === job) inflight.delete(id)
  })
  return job
}

async function postMetaPixelAutomaticMatching(
  id: string,
  token: string
): Promise<'enabled' | 'failed' | 'skipped'> {
  try {
    const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${encodeURIComponent(id)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(metaAutomaticMatchingUpdateBody(token)),
    })
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null
      failedUntilMs.set(id, Date.now() + FAIL_COOLDOWN_MS)
      console.warn('[meta automatic matching]', id, body?.error?.message || res.status)
      return 'failed'
    }
    enabledPixelIds.add(id)
    failedUntilMs.delete(id)
    return 'enabled'
  } catch (e) {
    failedUntilMs.set(id, Date.now() + FAIL_COOLDOWN_MS)
    console.warn('[meta automatic matching]', id, e instanceof Error ? e.message : 'fetch_failed')
    return 'failed'
  }
}
