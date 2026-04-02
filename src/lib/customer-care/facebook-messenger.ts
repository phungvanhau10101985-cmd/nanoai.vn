import { createHmac, timingSafeEqual } from 'node:crypto'
import type { InboundNormalized } from '@/lib/customer-care/types'

export function verifyFacebookMessengerSignature(rawBody: string, signatureHeader: string | null, appSecret: string): boolean {
  if (!signatureHeader?.startsWith('sha256=')) return false
  const expected = `sha256=${createHmac('sha256', appSecret).update(rawBody, 'utf8').digest('hex')}`
  try {
    const a = Buffer.from(signatureHeader)
    const b = Buffer.from(expected)
    if (a.length !== b.length) return false
    return timingSafeEqual(a, b)
  } catch {
    return false
  }
}

/** Trích inbound text từ body webhook Messenger (POST). */
export function parseFacebookMessengerInbound(body: unknown): InboundNormalized[] {
  const out: InboundNormalized[] = []
  if (!body || typeof body !== 'object') return out
  const root = body as { object?: string; entry?: unknown[] }
  if (root.object !== 'page' || !Array.isArray(root.entry)) return out

  for (const ent of root.entry) {
    if (!ent || typeof ent !== 'object') continue
    const pageId = typeof (ent as { id?: string }).id === 'string' ? (ent as { id: string }).id : ''
    if (!pageId) continue
    const messaging = (ent as { messaging?: unknown[] }).messaging
    if (!Array.isArray(messaging)) continue
    for (const ev of messaging) {
      if (!ev || typeof ev !== 'object') continue
      const m = ev as {
        sender?: { id?: string }
        message?: { text?: string; mid?: string }
        postback?: { title?: string; payload?: string }
      }
      const psid = m.sender?.id
      if (!psid) continue
      let text = typeof m.message?.text === 'string' ? m.message.text.trim() : ''
      if (!text && m.postback?.title) text = String(m.postback.title).trim()
      if (!text && m.postback?.payload) text = String(m.postback.payload).trim()
      if (!text) continue
      out.push({
        channel: 'facebook',
        externalUserId: psid,
        text,
        customerName: null,
        raw: ev as Record<string, unknown>,
        facebookPageId: pageId,
      })
    }
  }
  return out
}

export async function sendFacebookMessengerText(psid: string, text: string, pageAccessToken: string): Promise<{ ok: true } | { error: string }> {
  const url = `https://graph.facebook.com/v21.0/me/messages?access_token=${encodeURIComponent(pageAccessToken)}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      recipient: { id: psid },
      messaging_type: 'RESPONSE',
      message: { text },
    }),
  })
  const json = (await res.json().catch(() => ({}))) as { error?: { message?: string } }
  if (!res.ok) {
    return { error: json?.error?.message || `Facebook API HTTP ${res.status}` }
  }
  return { ok: true }
}

/** Gửi ảnh qua URL công khai (HTTPS). Có thể gửi kèm tin chữ riêng bằng lần gọi sendFacebookMessengerText. */
export async function sendFacebookMessengerImageUrl(
  psid: string,
  imageUrl: string,
  pageAccessToken: string
): Promise<{ ok: true } | { error: string }> {
  const url = `https://graph.facebook.com/v21.0/me/messages?access_token=${encodeURIComponent(pageAccessToken)}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      recipient: { id: psid },
      messaging_type: 'RESPONSE',
      message: {
        attachment: {
          type: 'image',
          payload: { url: imageUrl },
        },
      },
    }),
  })
  const json = (await res.json().catch(() => ({}))) as { error?: { message?: string } }
  if (!res.ok) {
    return { error: json?.error?.message || `Facebook API HTTP ${res.status}` }
  }
  return { ok: true }
}
