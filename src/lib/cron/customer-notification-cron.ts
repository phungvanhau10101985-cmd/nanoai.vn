import {
  deleteExpiredPartnerCustomerNotificationsFromPg,
  listPendingPartnerNotificationEmailsFromPg,
  listPendingPartnerNotificationPushesFromPg,
} from '@/lib/db/messaging-partner-customer-notifications-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { deliverPendingPartnerNotificationEmail } from '@/lib/messaging/partner-customer-notification-email'
import { deliverPendingPartnerNotificationPush } from '@/lib/messaging/partner-customer-notification-push'

export async function runCustomerNotificationCron() {
  if (!isPgConfigured()) return { skipped: 'no-db' as const }
  const expired = await deleteExpiredPartnerCustomerNotificationsFromPg()
  const pending = await listPendingPartnerNotificationEmailsFromPg({ limit: 40 })
  let sent = 0
  let skipped = 0
  let failed = 0
  for (const row of pending) {
    const status = await deliverPendingPartnerNotificationEmail(row)
    if (status === 'sent') sent += 1
    else if (status === 'skipped') skipped += 1
    else failed += 1
  }
  const pendingPush = await listPendingPartnerNotificationPushesFromPg({ limit: 40 })
  let pushSent = 0
  let pushSkipped = 0
  let pushFailed = 0
  for (const row of pendingPush) {
    const status = await deliverPendingPartnerNotificationPush(row)
    if (status === 'sent') pushSent += 1
    else if (status === 'skipped') pushSkipped += 1
    else pushFailed += 1
  }
  return {
    expired,
    pending: pending.length,
    sent,
    skipped,
    failed,
    pushPending: pendingPush.length,
    pushSent,
    pushSkipped,
    pushFailed,
  }
}
