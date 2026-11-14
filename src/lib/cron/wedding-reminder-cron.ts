import { listWeddingRemindersDueToday, markWeddingReminderSent, purgeExpiredWeddingCardsFromPg } from '@/lib/db/wedding-cards-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { isSmtpConfigured } from '@/lib/email/smtp'
import { notifyWeddingCardExpired } from '@/lib/wedding/wedding-card-retention-notify'
import { sendWeddingReminderEmail } from '@/lib/wedding/wedding-reminder-email'
import { sendDueWeddingAttendanceDailyDigests } from '@/lib/wedding/wedding-rsvp-notify'
import { sendDueWeddingUnpaidPackReminders } from '@/lib/wedding/wedding-unpaid-pack-reminder'

export async function runWeddingReminderCron() {
  if (!isPgConfigured()) return { ok: false as const, error: 'Database not configured.' }
  const purged = await purgeExpiredWeddingCardsFromPg()
  let purgeNotified = 0
  for (const card of purged) {
    const sent = await notifyWeddingCardExpired({
      userId: card.userId,
      cardId: card.id,
      groomName: card.groomName,
      brideName: card.brideName,
      ceremonyIso: card.ceremonyIso,
    }).then(
      () => true,
      (error) => {
        console.error('[wedding-reminder-cron] purge notify', card.id, error)
        return false
      }
    )
    if (sent) purgeNotified += 1
  }
  if (!isSmtpConfigured()) {
    return {
      ok: true as const,
      purgedCards: purged.length,
      purgeNotified,
      reminder: 'skipped_smtp',
      unpaidPack: 'skipped_smtp',
    }
  }
  const due = await listWeddingRemindersDueToday()
  let sent = 0
  let failed = 0
  for (const row of due) {
    const result = await sendWeddingReminderEmail(row)
    if (result.ok) {
      await markWeddingReminderSent(row.id)
      sent += 1
    } else {
      failed += 1
      console.error('[wedding-reminder-cron]', row.id, result.error)
    }
  }
  const attendance = await sendDueWeddingAttendanceDailyDigests()
  let unpaidPack = { due: 0, sent: 0, failed: 0, skippedNoEmail: 0 }
  try {
    unpaidPack = await sendDueWeddingUnpaidPackReminders()
  } catch (error) {
    unpaidPack = { due: 0, sent: 0, failed: 1, skippedNoEmail: 0 }
    console.error('[wedding-reminder-cron] unpaid pack', error)
  }
  return {
    ok: true as const,
    purgedCards: purged.length,
    purgeNotified,
    dueCount: due.length,
    sent,
    failed,
    attendanceDailyDue: attendance.due,
    attendanceDailySent: attendance.sent,
    attendanceDailyFailed: attendance.failed,
    attendanceDailySkipped: attendance.skipped,
    unpaidPackDue: unpaidPack.due,
    unpaidPackSent: unpaidPack.sent,
    unpaidPackFailed: unpaidPack.failed,
    unpaidPackNoEmail: unpaidPack.skippedNoEmail,
  }
}
