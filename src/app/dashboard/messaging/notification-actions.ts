'use server'

import { revalidatePath } from 'next/cache'
import { getUserForCreditAction } from '@/lib/auth'
import { assertPartnerStaffGate } from '@/lib/messaging/partner-dashboard-access'
import { isPgConfigured } from '@/lib/db/pool'
import { isValidUuidString } from '@/lib/validate-uuid'
import { listPartnerNotificationBroadcastsFromPg } from '@/lib/db/messaging-partner-customer-notifications-pg'
import {
  createPartnerNotificationBroadcastForRecipients,
  importPartnerNotificationRows,
  listShopCustomersForNotificationBroadcast,
} from '@/lib/messaging/partner-notification-broadcast'
import {
  buildPartnerNotificationImportTemplateBuffer,
  parsePartnerNotificationImportFile,
} from '@/lib/messaging/partner-notification-import'
import { isSmtpConfigured } from '@/lib/email/smtp'

async function requireUser() {
  const result = await getUserForCreditAction()
  if ('error' in result) return { error: result.error }
  return { user: result.user }
}

async function gateNotifications(userId: string, partnerId: string) {
  if (!isValidUuidString(partnerId)) return { error: 'Forbidden.' }
  const website = await assertPartnerStaffGate(userId, partnerId, 'website')
  if (!('error' in website)) return { ok: true as const }
  const marketing = await assertPartnerStaffGate(userId, partnerId, 'marketing_campaigns')
  if (!('error' in marketing)) return { ok: true as const }
  return website
}

function revalidateNotificationPaths() {
  revalidatePath('/dashboard/messaging/notifications')
}

export async function listPartnerNotificationBroadcastsAction(partnerId: string) {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error }
  const gate = await gateNotifications(auth.user.id, partnerId)
  if ('error' in gate) return { error: gate.error }
  if (!isPgConfigured()) return { error: 'DATABASE_URL is not set.' }
  const rows = await listPartnerNotificationBroadcastsFromPg({ partnerId })
  return { rows }
}

export async function countPartnerNotificationAudienceAction(partnerId: string) {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error }
  const gate = await gateNotifications(auth.user.id, partnerId)
  if ('error' in gate) return { error: gate.error }
  if (!isPgConfigured()) return { error: 'DATABASE_URL is not set.' }
  const recipients = await listShopCustomersForNotificationBroadcast(partnerId)
  return { count: recipients.length, smtpConfigured: isSmtpConfigured() }
}

export async function createPartnerNotificationComposeAction(input: {
  partnerId: string
  title: string
  body: string
  scheduledAt: string
  sendEmail: boolean
}) {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error }
  const gate = await gateNotifications(auth.user.id, input.partnerId)
  if ('error' in gate) return { error: gate.error }
  if (!isPgConfigured()) return { error: 'DATABASE_URL is not set.' }

  const scheduledAt = new Date(input.scheduledAt)
  if (Number.isNaN(scheduledAt.getTime())) return { error: 'invalid_schedule' }

  const recipients = await listShopCustomersForNotificationBroadcast(input.partnerId)
  if (recipients.length === 0) return { error: 'no_recipients' }

  const result = await createPartnerNotificationBroadcastForRecipients({
    partnerId: input.partnerId,
    createdBy: auth.user.id,
    title: input.title,
    body: input.body,
    scheduledAt,
    sendEmail: Boolean(input.sendEmail),
    audience: 'all_customers',
    source: 'compose',
    recipients,
  })
  if ('error' in result) return result
  revalidateNotificationPaths()
  return result
}

export async function importPartnerNotificationsAction(partnerId: string, formData: FormData) {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error }
  const gate = await gateNotifications(auth.user.id, partnerId)
  if ('error' in gate) return { error: gate.error }
  if (!isPgConfigured()) return { error: 'DATABASE_URL is not set.' }

  const file = formData.get('file')
  if (!(file instanceof File) || file.size < 1) return { error: 'missing_file' }
  const sendEmail = String(formData.get('sendEmail') ?? '1') !== '0'
  const buffer = Buffer.from(await file.arrayBuffer())
  const parsed = parsePartnerNotificationImportFile({ filename: file.name, buffer })
  if (parsed.error) return { error: parsed.error }
  if (parsed.rows.length === 0) return { error: 'empty_sheet' }

  const result = await importPartnerNotificationRows({
    partnerId,
    createdBy: auth.user.id,
    sendEmail,
    rows: parsed.rows,
  })
  if ('error' in result) return result
  revalidateNotificationPaths()
  return result
}

export async function downloadPartnerNotificationTemplateAction() {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error }
  const buffer = buildPartnerNotificationImportTemplateBuffer()
  return {
    filename: 'shop-notifications-template.xlsx',
    base64: buffer.toString('base64'),
  }
}
