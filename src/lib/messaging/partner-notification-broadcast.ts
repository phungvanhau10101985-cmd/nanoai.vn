import {
  findPartnerNotificationRecipientFromPg,
  insertPartnerCustomerNotificationFromPg,
  insertPartnerNotificationBroadcastFromPg,
  listAllPartnerNotificationRecipientsFromPg,
  updatePartnerNotificationBroadcastStatsFromPg,
  type PartnerNotificationRecipient,
} from '@/lib/db/messaging-partner-customer-notifications-pg'
import { deliverPendingPartnerNotificationEmail } from '@/lib/messaging/partner-customer-notification-email'
import {
  deliverPendingPartnerNotificationPush,
  partnerShopImmediatePushCap,
} from '@/lib/messaging/partner-customer-notification-push'
import { partnerSiteAccountTabPath } from '@/lib/partner-website/shop/partner-site-shop-paths'
import { fetchPartnerWebsiteByPartnerIdPg } from '@/lib/db/messaging-partner-websites-pg'
import type { PartnerNotificationImportRow } from '@/lib/messaging/partner-notification-import'

const EXPIRE_DAYS = 15
const IMMEDIATE_EMAIL_CAP = 40

export type PartnerNotificationBroadcastResult = {
  broadcastId: string
  totalProcessed: number
  successCount: number
  errorCount: number
  emailSentCount: number
  errors: string[]
}

async function notificationHref(partnerId: string): Promise<string> {
  const website = await fetchPartnerWebsiteByPartnerIdPg(partnerId)
  const siteSlug = website?.siteSlug?.trim() ?? ''
  return siteSlug ? partnerSiteAccountTabPath(siteSlug, 'notifications') : ''
}

function expiresFrom(scheduledAt: Date): Date {
  return new Date(scheduledAt.getTime() + EXPIRE_DAYS * 24 * 60 * 60 * 1000)
}

export async function createPartnerNotificationBroadcastForRecipients(input: {
  partnerId: string
  createdBy?: string | null
  title: string
  body: string
  scheduledAt: Date
  sendEmail: boolean
  audience: 'import' | 'all_customers'
  source: 'compose' | 'import'
  recipients: PartnerNotificationRecipient[]
}): Promise<PartnerNotificationBroadcastResult | { error: string }> {
  const title = input.title.trim()
  const body = input.body.trim()
  if (!title || !body) return { error: 'missing_content' }

  const broadcast = await insertPartnerNotificationBroadcastFromPg({
    partnerId: input.partnerId,
    title,
    body,
    type: 'system',
    scheduledAt: input.scheduledAt,
    expiresAt: expiresFrom(input.scheduledAt),
    sendEmail: input.sendEmail,
    audience: input.audience,
    source: input.source,
    createdBy: input.createdBy,
  })
  if (!broadcast) return { error: 'insert_broadcast_failed' }

  const href = await notificationHref(input.partnerId)
  const seen = new Set<string>()
  let successCount = 0
  let errorCount = 0
  let emailSentCount = 0
  let immediateEmails = 0
  let immediatePushes = 0
  const errors: string[] = []
  const due = input.scheduledAt.getTime() <= Date.now()
  const pushCap = partnerShopImmediatePushCap()

  for (const recipient of input.recipients) {
    if (seen.has(recipient.guestAccountId)) continue
    seen.add(recipient.guestAccountId)

    const row = await insertPartnerCustomerNotificationFromPg({
      partnerId: input.partnerId,
      guestAccountId: recipient.guestAccountId,
      type: 'system',
      title,
      body,
      href,
      scheduledAt: input.scheduledAt,
      expiresAt: expiresFrom(input.scheduledAt),
      emailStatus: input.sendEmail ? 'pending' : 'none',
      broadcastId: broadcast.id,
    })
    if (!row) {
      errorCount += 1
      errors.push(`${recipient.phone || recipient.email || recipient.guestAccountId}: insert failed`)
      continue
    }
    successCount += 1

    if (input.sendEmail && due && immediateEmails < IMMEDIATE_EMAIL_CAP) {
      immediateEmails += 1
      const status = await deliverPendingPartnerNotificationEmail(row)
      if (status === 'sent') emailSentCount += 1
    }
    if (due && immediatePushes < pushCap) {
      immediatePushes += 1
      await deliverPendingPartnerNotificationPush(row)
    }
  }

  await updatePartnerNotificationBroadcastStatsFromPg({
    broadcastId: broadcast.id,
    totalProcessed: seen.size,
    successCount,
    errorCount,
    emailSentCount,
  })

  return {
    broadcastId: broadcast.id,
    totalProcessed: seen.size,
    successCount,
    errorCount,
    emailSentCount,
    errors: errors.slice(0, 80),
  }
}

export async function importPartnerNotificationRows(input: {
  partnerId: string
  createdBy?: string | null
  sendEmail: boolean
  rows: PartnerNotificationImportRow[]
}): Promise<PartnerNotificationBroadcastResult | { error: string }> {
  const firstValid = input.rows.find((r) => r.title.trim() && r.content.trim() && !Number.isNaN(r.scheduledAt.getTime()))
  const broadcast = await insertPartnerNotificationBroadcastFromPg({
    partnerId: input.partnerId,
    title: firstValid?.title.trim() || 'Import thông báo',
    body: firstValid?.content.trim() || '',
    type: 'system',
    scheduledAt: firstValid?.scheduledAt ?? new Date(),
    expiresAt: firstValid ? expiresFrom(firstValid.scheduledAt) : expiresFrom(new Date()),
    sendEmail: input.sendEmail,
    audience: 'import',
    source: 'import',
    createdBy: input.createdBy,
  })
  if (!broadcast) return { error: 'insert_broadcast_failed' }

  const href = await notificationHref(input.partnerId)
  let successCount = 0
  let errorCount = 0
  let emailSentCount = 0
  let immediateEmails = 0
  let immediatePushes = 0
  const errors: string[] = []
  const seen = new Set<string>()
  const pushCap = partnerShopImmediatePushCap()

  for (const row of input.rows) {
    const title = row.title.trim()
    const body = row.content.trim()
    if (!title || !body) {
      errorCount += 1
      errors.push(`Row ${row.rowNumber}: missing title or content`)
      continue
    }
    if (Number.isNaN(row.scheduledAt.getTime())) {
      errorCount += 1
      errors.push(`Row ${row.rowNumber}: Invalid date format`)
      continue
    }

    const recipient = await findPartnerNotificationRecipientFromPg({
      partnerId: input.partnerId,
      phone: row.phone,
      email: row.email,
    })
    if (!recipient) {
      errorCount += 1
      errors.push(
        `Row ${row.rowNumber}: User with phone ${row.phone || row.email || '(empty)'} not found`
      )
      continue
    }
    const dedupeKey = `${recipient.guestAccountId}:${title}:${row.scheduledAt.toISOString()}`
    if (seen.has(dedupeKey)) continue
    seen.add(dedupeKey)

    const inserted = await insertPartnerCustomerNotificationFromPg({
      partnerId: input.partnerId,
      guestAccountId: recipient.guestAccountId,
      type: 'system',
      title,
      body,
      href,
      scheduledAt: row.scheduledAt,
      expiresAt: expiresFrom(row.scheduledAt),
      emailStatus: input.sendEmail ? 'pending' : 'none',
      broadcastId: broadcast.id,
    })
    if (!inserted) {
      errorCount += 1
      errors.push(`Row ${row.rowNumber}: insert failed`)
      continue
    }
    successCount += 1

    const due = row.scheduledAt.getTime() <= Date.now()
    if (input.sendEmail && due && immediateEmails < IMMEDIATE_EMAIL_CAP) {
      immediateEmails += 1
      const status = await deliverPendingPartnerNotificationEmail(inserted)
      if (status === 'sent') emailSentCount += 1
    }
    if (due && immediatePushes < pushCap) {
      immediatePushes += 1
      await deliverPendingPartnerNotificationPush(inserted)
    }
  }

  await updatePartnerNotificationBroadcastStatsFromPg({
    broadcastId: broadcast.id,
    totalProcessed: input.rows.length,
    successCount,
    errorCount,
    emailSentCount,
  })

  return {
    broadcastId: broadcast.id,
    totalProcessed: input.rows.length,
    successCount,
    errorCount,
    emailSentCount,
    errors: errors.slice(0, 80),
  }
}

export async function listShopCustomersForNotificationBroadcast(partnerId: string) {
  return listAllPartnerNotificationRecipientsFromPg({ partnerId })
}
