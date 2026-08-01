import { createHmac, randomUUID } from 'node:crypto'
import { fetchPartnerOutboundWebhookFromPg } from '@/lib/db/messaging-partner-outbound-webhooks-pg'
import type { PartnerOutboundWebhookAnyEvent } from '@/lib/messaging/partner-outbound-webhook-types'

const DISPATCH_TIMEOUT_MS = 12_000

function signPayload(secret: string, timestamp: string, body: string): string {
  const mac = createHmac('sha256', secret).update(`${timestamp}.${body}`, 'utf8').digest('hex')
  return `sha256=${mac}`
}

function isHttpsWebhookUrl(url: string): boolean {
  try {
    const u = new URL(url)
    return u.protocol === 'https:' && Boolean(u.hostname)
  } catch {
    return false
  }
}

export async function dispatchPartnerOutboundWebhook(input: {
  partnerId: string
  event: PartnerOutboundWebhookAnyEvent
  data: Record<string, unknown>
  force?: boolean
}): Promise<{ ok: boolean; status?: number; error?: string }> {
  const cfg = await fetchPartnerOutboundWebhookFromPg(input.partnerId)
  if (!cfg?.isEnabled) return { ok: false, error: 'webhook_disabled' }
  const url = cfg.webhookUrl.trim()
  if (!isHttpsWebhookUrl(url)) return { ok: false, error: 'webhook_url_invalid' }

  const isTest = input.event === 'webhook.test'
  if (!isTest && !input.force && !(cfg.events as readonly string[]).includes(input.event)) {
    return { ok: false, error: 'event_not_subscribed' }
  }

  const deliveryId = randomUUID()
  const createdAt = new Date().toISOString()
  const envelope = {
    id: deliveryId,
    event: input.event,
    created_at: createdAt,
    partner_id: input.partnerId,
    data: input.data,
  }
  const body = JSON.stringify(envelope)
  const timestamp = String(Math.floor(Date.now() / 1000))
  const secret = cfg.webhookSecret.trim()

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'NanoAI-Outbound-Webhook/1.0',
    'X-NanoAI-Event': input.event,
    'X-NanoAI-Delivery-Id': deliveryId,
    'X-NanoAI-Timestamp': timestamp,
  }
  if (secret) {
    headers['X-NanoAI-Signature'] = signPayload(secret, timestamp, body)
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), DISPATCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body,
      signal: controller.signal,
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return { ok: false, status: res.status, error: text.slice(0, 500) || `HTTP ${res.status}` }
    }
    return { ok: true, status: res.status }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, error: msg.slice(0, 500) }
  } finally {
    clearTimeout(timer)
  }
}

/** Fire-and-forget — không chặn checkout/lead. */
export function queuePartnerOutboundWebhook(
  partnerId: string,
  event: PartnerOutboundWebhookAnyEvent,
  data: Record<string, unknown>
): void {
  void dispatchPartnerOutboundWebhook({ partnerId, event, data }).catch((e) => {
    console.warn('[queuePartnerOutboundWebhook]', partnerId, event, e)
  })
}
