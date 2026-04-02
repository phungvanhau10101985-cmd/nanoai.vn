import type { InboundNormalized } from '@/lib/customer-care/types'

/** So khớp secret Zalo OA cấu hình trên console (header thường là X-Bot-Api-Secret-Token). */
export function verifyZaloWebhookSecret(headers: Headers, expectedSecret: string): boolean {
  if (!expectedSecret) return false
  const h1 = headers.get('x-bot-api-secret-token') || headers.get('X-Bot-Api-Secret-Token')
  const h2 = headers.get('x-zalo-secret') || headers.get('X-Zalo-Secret')
  const token = h1 || h2
  if (!token) return false
  return token.trim() === expectedSecret.trim()
}

/**
 * Parse payload webhook Zalo OA (nhiều biến thể field). Điều chỉnh theo sự kiện thực tế trên Zalo Developer.
 * @see https://developers.zalo.me/docs/official-account/webhook/tong-quan
 */
export function parseZaloOaInbound(body: unknown): InboundNormalized[] {
  const out: InboundNormalized[] = []
  if (!body || typeof body !== 'object') return out
  const b = body as Record<string, unknown>

  const eventName = typeof b.event_name === 'string' ? b.event_name : ''
  const textCandidates = [
    b.text,
    (b.message as Record<string, unknown> | undefined)?.text,
    (b.data as Record<string, unknown> | undefined)?.content,
  ]
  let text = ''
  for (const c of textCandidates) {
    if (typeof c === 'string' && c.trim()) {
      text = c.trim()
      break
    }
  }
  if (!text && eventName !== 'user_send_text' && eventName !== 'user_send_image') {
    return out
  }

  const sender = (b.sender as Record<string, unknown> | undefined) || (b.user as Record<string, unknown> | undefined)
  const uid =
    (typeof sender?.id === 'string' && sender.id) ||
    (typeof b.user_id === 'string' && b.user_id) ||
    (typeof b.uid === 'string' && b.uid) ||
    ''

  if (!uid || !text) return out

  const name = typeof sender?.display_name === 'string' ? sender.display_name : typeof b.display_name === 'string' ? b.display_name : null

  out.push({
    channel: 'zalo',
    externalUserId: uid,
    text,
    customerName: name,
    raw: b,
  })
  return out
}

export async function sendZaloOaText(userId: string, text: string, accessToken: string): Promise<{ ok: true } | { error: string }> {
  const url = `https://openapi.zalo.me/v2.0/oa/message?access_token=${encodeURIComponent(accessToken)}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      recipient: { user_id: userId },
      message: { text },
    }),
  })
  const json = (await res.json().catch(() => ({}))) as { error?: number; message?: string }
  if (!res.ok || json.error) {
    return { error: json.message || `Zalo API HTTP ${res.status}` }
  }
  return { ok: true }
}
