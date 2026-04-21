/**
 * HTTP smoke test cho API Hospitality.
 * Yeu cau: server dev dang chay (mac dinh http://localhost:3001)
 */
import { existsSync, readFileSync } from 'fs'
import { config } from 'dotenv'
import { resolve } from 'path'
import { pgQueryOne } from '../src/lib/db/pg-query'

config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

const freshPath = resolve(process.cwd(), '.cache', 'DATABASE_URL_FRESH.txt')
if (!process.env.DATABASE_URL?.trim() && existsSync(freshPath)) {
  const line = readFileSync(freshPath, 'utf8').trim().split(/\r?\n/)[0]?.trim()
  if (line) process.env.DATABASE_URL = line
}

function tsOffset(hours: number): string {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString()
}

async function parseJsonSafe(res: Response): Promise<unknown> {
  try {
    return await res.json()
  } catch {
    return { parse_error: true }
  }
}

async function main() {
  const base = (process.env.HOSPITALITY_HTTP_BASE || 'http://localhost:3001').replace(/\/+$/, '')
  const partner = await pgQueryOne<{ id: string; slug: string }>(
    `select id::text, slug
     from public.messaging_partners
     where coalesce(industry_key, '') = 'hotel'
     order by updated_at desc
     limit 1`
  )
  if (!partner) {
    console.error('[hospitality-http-smoke] No hotel partner found')
    process.exit(1)
  }

  const checkinAt = tsOffset(3)
  const checkoutAt = tsOffset(11)
  const availabilityUrl = `${base}/api/hospitality/guest/${partner.slug}/availability?checkin_at=${encodeURIComponent(checkinAt)}&checkout_at=${encodeURIComponent(checkoutAt)}`

  const availabilityRes = await fetch(availabilityUrl)
  const availabilityData = (await parseJsonSafe(availabilityRes)) as {
    ok?: boolean
    items?: Array<{ room_type_id: string; available_rooms: number }>
  }
  if (!availabilityRes.ok || !Array.isArray(availabilityData.items)) {
    console.error('[hospitality-http-smoke] availability failed', availabilityRes.status, availabilityData)
    process.exit(1)
  }
  const firstAvailable = availabilityData.items.find((x) => Number(x.available_rooms) > 0)
  if (!firstAvailable) {
    console.error('[hospitality-http-smoke] no available room type', availabilityData)
    process.exit(1)
  }

  const holdRes = await fetch(`${base}/api/hospitality/guest/${partner.slug}/holds`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      room_type_id: firstAvailable.room_type_id,
      customer_name: 'HTTP Smoke Guest',
      customer_phone: '0911111111',
      guests: 1,
      checkin_at: checkinAt,
      checkout_at: checkoutAt,
      expires_minutes: 20,
    }),
  })
  const holdData = (await parseJsonSafe(holdRes)) as { hold?: { id: string } }
  if (!holdRes.ok || !holdData.hold?.id) {
    console.error('[hospitality-http-smoke] hold failed', holdRes.status, holdData)
    process.exit(1)
  }

  const bookingRes = await fetch(`${base}/api/hospitality/guest/${partner.slug}/bookings`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      hold_id: holdData.hold.id,
      customer_name: 'HTTP Smoke Guest',
      customer_phone: '0911111111',
      total_amount: 650000,
      currency: 'VND',
      pms_connector: 'other',
    }),
  })
  const bookingData = (await parseJsonSafe(bookingRes)) as { booking?: { id: string } }
  if (!bookingRes.ok || !bookingData.booking?.id) {
    console.error('[hospitality-http-smoke] booking failed', bookingRes.status, bookingData)
    process.exit(1)
  }

  const paymentRes = await fetch(`${base}/api/hospitality/guest/${partner.slug}/bookings/${bookingData.booking.id}/payments`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      provider: 'manual',
      amount: 650000,
      currency: 'VND',
      status: 'paid',
      provider_txn_id: `HTTP-SMOKE-${Date.now()}`,
    }),
  })
  const paymentData = await parseJsonSafe(paymentRes)
  if (!paymentRes.ok) {
    console.error('[hospitality-http-smoke] payment failed', paymentRes.status, paymentData)
    process.exit(1)
  }

  const guestBookingsRes = await fetch(`${base}/api/hospitality/guest/${partner.slug}/bookings`)
  const guestBookingsData = (await parseJsonSafe(guestBookingsRes)) as { bookings?: Array<{ id: string }> }
  if (!guestBookingsRes.ok || !Array.isArray(guestBookingsData.bookings)) {
    console.error('[hospitality-http-smoke] guest bookings fetch failed', guestBookingsRes.status, guestBookingsData)
    process.exit(1)
  }
  const existsInList = guestBookingsData.bookings.some((b) => b.id === bookingData.booking?.id)

  // Owner endpoint khong co auth cookie trong script => expected unauthorized.
  const ownerReportRes = await fetch(`${base}/api/hospitality/partners/${partner.id}/reports`)

  console.log(
    JSON.stringify(
      {
        ok: true,
        base,
        partner,
        hold_id: holdData.hold.id,
        booking_id: bookingData.booking.id,
        booking_visible_in_guest_list: existsInList,
        owner_report_status_without_auth: ownerReportRes.status,
      },
      null,
      2
    )
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
