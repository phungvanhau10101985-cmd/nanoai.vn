import { randomBytes } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import {
  fetchPartnerChannelStatusRowsFromPg,
  upsertFacebookMessengerChannelPg,
} from '@/lib/db/messaging-partner-channels-pg'

const SUBSCRIBED_FIELDS = 'messages,messaging_postbacks,message_reads,message_deliveries,messaging_referrals'

function revalidateMessagingDashboard() {
  revalidatePath('/dashboard/messaging')
  revalidatePath('/dashboard/messaging/settings')
  revalidatePath('/dashboard/messaging/orders')
  revalidatePath('/dashboard/api-integration')
}

export async function subscribeFacebookPageToApp(pageId: string, pageAccessToken: string): Promise<boolean> {
  const url = new URL(`https://graph.facebook.com/v21.0/${encodeURIComponent(pageId)}/subscribed_apps`)
  url.searchParams.set('subscribed_fields', SUBSCRIBED_FIELDS)
  url.searchParams.set('access_token', pageAccessToken)
  const res = await fetch(url.toString(), { method: 'POST', cache: 'no-store' })
  return res.ok
}

export async function unsubscribeFacebookPageFromApp(pageId: string, pageAccessToken: string): Promise<void> {
  const url = new URL(`https://graph.facebook.com/v21.0/${encodeURIComponent(pageId)}/subscribed_apps`)
  url.searchParams.set('access_token', pageAccessToken)
  await fetch(url.toString(), { method: 'DELETE', cache: 'no-store' }).catch(() => null)
}

export async function connectFacebookPagesForPartner(params: {
  partnerId: string
  pages: Array<{ id: string; accessToken: string }>
}): Promise<{ connected: string[]; warned: string[]; failed: Array<{ id: string; error: string }> }> {
  const existing = await fetchPartnerChannelStatusRowsFromPg(params.partnerId)
  const verifyByPage = new Map(
    (existing?.facebookPages ?? []).map((row) => [row.external_page_id, row.webhook_verify_token?.trim() || ''])
  )
  const connected: string[] = []
  const warned: string[] = []
  const failed: Array<{ id: string; error: string }> = []

  const queue = params.pages.filter((page) => page.id && page.accessToken)
  let cursor = 0
  async function worker() {
    while (cursor < queue.length) {
      const page = queue[cursor]
      cursor += 1
      if (!page) continue
      const verifyToken = verifyByPage.get(page.id) || `fbv_${randomBytes(12).toString('hex')}`
      const upsert = await upsertFacebookMessengerChannelPg({
        partnerId: params.partnerId,
        facebookPageId: page.id,
        pageAccessToken: page.accessToken,
        webhookVerifyToken: verifyToken,
      })
      if ('error' in upsert) {
        failed.push({ id: page.id, error: upsert.error })
        continue
      }
      const subscribed = await subscribeFacebookPageToApp(page.id, page.accessToken)
      if (subscribed) connected.push(page.id)
      else warned.push(page.id)
    }
  }

  const workers = Math.min(4, queue.length)
  if (workers > 0) {
    await Promise.all(Array.from({ length: workers }, () => worker()))
  }
  if (connected.length > 0 || warned.length > 0) revalidateMessagingDashboard()
  return { connected, warned, failed }
}
