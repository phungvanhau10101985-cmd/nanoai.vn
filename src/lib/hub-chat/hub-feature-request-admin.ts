import { createHash } from 'node:crypto'

import { getAuthUserEmailFromPg } from '@/lib/db/auth-user-email-pg'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'
import { deliverUserNotificationPg } from '@/lib/notifications/deliver-user-notification-pg'

const TYPE = 'hub_feature_request'

/** Việc khách hỏi không nằm trong catalog thì gửi admin, kể cả khi model đoán công cụ gần. */
export function shouldAutoForwardMissingHubFeature(input: {
  activeDesign: boolean
  matchedFeature: boolean
  shortAffirmative?: boolean
}): boolean {
  if (input.activeDesign) return false
  if (input.matchedFeature) return false
  if (input.shortAffirmative) return false
  return true
}

function requestKey(userId: string, message: string): string {
  const normalized = message.trim().toLowerCase().replace(/\s+/g, ' ')
  const hash = createHash('sha256').update(`${userId}\n${normalized}`).digest('hex').slice(0, 24)
  return `hub-feature:${hash}`
}

/** Câu không khớp tính năng, hoặc góp ý chủ động, vào chuông admin. */
export async function notifyNanoAiAdminsHubFeatureRequest(input: {
  userId: string
  message: string
  kind: 'unmatched' | 'feedback'
}): Promise<boolean> {
  const text = input.message.replace(/\s+/g, ' ').trim().slice(0, 800)
  if (text.length < 2) return false
  try {
    const admins = await pgQuery<{ id: string }>(
      `select id::text as id from public.profiles where role = 'admin'`
    )
    if (!admins.length) return false
    const others = admins.filter((admin) => admin.id !== input.userId)
    const targets = others.length ? others : admins
    const profile = await pgQueryOne<{ full_name: string | null }>(
      `select full_name from public.profiles where id = $1::uuid limit 1`,
      [input.userId]
    )
    const email = await getAuthUserEmailFromPg(input.userId)
    const who = [profile?.full_name?.trim(), email].filter(Boolean).join(' · ') || input.userId
    const title =
      input.kind === 'feedback'
        ? 'Hub chat — góp ý tính năng còn thiếu'
        : 'Hub chat — câu chưa khớp tính năng'
    const body = `${who}: ${text}`
    const idempotencyKey = requestKey(input.userId, text)
    await Promise.all(
      targets.map((admin) =>
        deliverUserNotificationPg({
          user_id: admin.id,
          type: TYPE,
          title,
          body,
          meta: {
            push_url: '/',
            idempotency_key: idempotencyKey,
            hub_feature_kind: input.kind,
            from_user_id: input.userId,
          },
        })
      )
    )
    return true
  } catch (error) {
    console.warn('[notifyNanoAiAdminsHubFeatureRequest]', error)
    return false
  }
}
