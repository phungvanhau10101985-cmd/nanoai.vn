import { getPublicAppUrlForServer } from '@/lib/auth/public-app-url'
import {
  claimWeddingAttendanceDailySend,
  listWeddingAttendanceDailyDue,
  loadWeddingAttendanceSources,
  lowerWeddingAttendanceBaseline,
  releaseWeddingAttendanceDailyClaim,
  seedWeddingAttendanceBaseline,
  type WeddingRsvpNotifyRow,
} from '@/lib/db/wedding-cards-pg'
import { invitationEditorCopy, invitationOccasionShape } from '@/lib/wedding/invitation-occasion'
import {
  planDailyAttendanceMail,
  summarizeWeddingAttendanceSources,
  weddingNotifyRecipients,
  type WeddingAttendanceSummary,
} from '@/lib/wedding/wedding-attendance-summary'
import { sendWeddingAttendanceMail } from '@/lib/wedding/wedding-rsvp-notify-email'

function coupleLabel(row: Pick<WeddingRsvpNotifyRow, 'groomName' | 'brideName'>): string {
  return [row.groomName.trim(), row.brideName.trim()].filter(Boolean).join(' & ')
}

function sideLabels(occasionKey: string) {
  const copy = invitationEditorCopy(occasionKey)
  return { primaryLabel: copy.primaryFamily, secondaryLabel: copy.secondaryFamily }
}

async function summaryForCard(cardId: string): Promise<WeddingAttendanceSummary | null> {
  const sources = await loadWeddingAttendanceSources(cardId)
  if (!sources) return null
  return summarizeWeddingAttendanceSources(sources.guests, sources.rsvps)
}

function resultsUrl(cardId: string): string {
  const origin = getPublicAppUrlForServer().replace(/\/$/, '')
  return `${origin}/tao-thiep-moi-cuoi-ai/khach-moi?cardId=${encodeURIComponent(cardId)}`
}

/** Một thư mỗi ngày, chỉ khi số người đi đã tăng so với thư trước. */
export async function sendDueWeddingAttendanceDailyDigests(): Promise<{ due: number; sent: number; failed: number; skipped: number }> {
  const due = await listWeddingAttendanceDailyDue()
  let sent = 0
  let failed = 0
  let skipped = 0
  for (const row of due) {
    const recipients = weddingNotifyRecipients(row.groomEmail, row.brideEmail)
    const summary = await summaryForCard(row.cardId)
    if (!summary) {
      skipped += 1
      continue
    }
    const current = summary.total.peopleAttending
    const plan = planDailyAttendanceMail({
      enabled: row.daily || row.onIncrease,
      baselineSet: row.baselineSet,
      lastPeople: row.lastPeople,
      currentPeople: current,
      hasRecipient: recipients.length > 0,
      alreadySentToday: false,
    })
    if (plan.setBaseline) {
      await seedWeddingAttendanceBaseline(row.cardId, plan.nextBaseline)
      skipped += 1
      continue
    }
    if (plan.lowerBaseline) {
      await lowerWeddingAttendanceBaseline({
        cardId: row.cardId,
        expectedPeople: row.lastPeople,
        nextPeople: plan.nextBaseline,
      })
      skipped += 1
      continue
    }
    if (!plan.send) {
      skipped += 1
      continue
    }
    const claimed = await claimWeddingAttendanceDailySend({
      cardId: row.cardId,
      expectedPeople: row.lastPeople,
      nextPeople: plan.nextBaseline,
    })
    if (!claimed) {
      skipped += 1
      continue
    }
    const result = await sendWeddingAttendanceMail({
      kind: 'increase',
      couple: coupleLabel(row),
      summary,
      previousPeople: row.lastPeople,
      resultsUrl: resultsUrl(row.cardId),
      to: recipients,
      includeSecondary: invitationOccasionShape(row.occasionKey) === 'couple',
      ...sideLabels(row.occasionKey),
    })
    if (result.ok) sent += 1
    else {
      failed += 1
      await releaseWeddingAttendanceDailyClaim({
        cardId: row.cardId,
        restorePeople: row.lastPeople,
        claimedPeople: plan.nextBaseline,
      })
      console.error('[wedding-rsvp-notify-daily]', row.cardId, result.error)
    }
  }
  return { due: due.length, sent, failed, skipped }
}
