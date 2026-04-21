/**
 * Smoke test Hospitality CRM flow trên DB thật:
 * - Tạo/chọn partner industry=hotel
 * - Tạo room type + room
 * - Check availability -> hold -> booking -> payment -> report
 * - Upsert/fetch AI settings
 * - Enqueue/fetch/update PMS sync job
 */
import { existsSync, readFileSync } from 'fs'
import { config } from 'dotenv'
import { resolve } from 'path'
import { checkPgConnection, pgQueryOne } from '../src/lib/db/pg-query'
import {
  createHospitalityBookingFromHoldPg,
  createHospitalityHoldPg,
  createHospitalityPaymentPg,
  createHospitalityRoomPg,
  createHospitalityRoomTypePg,
  enqueueHospitalityPmsSyncJobPg,
  fetchHospitalityAiSettingsPg,
  fetchHospitalityAvailabilityPg,
  fetchHospitalityOwnerReportPg,
  fetchPendingHospitalityPmsSyncJobsPg,
  upsertHospitalityAiSettingsPg,
  updateHospitalityPmsSyncJobStatusPg,
} from '../src/lib/db/hospitality-pg'

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

async function ensureHotelPartner() {
  const existing = await pgQueryOne<{ id: string; slug: string }>(
    `select id::text, slug
     from public.messaging_partners
     where coalesce(industry_key, '') = 'hotel'
     order by updated_at desc
     limit 1`
  )
  if (existing) return existing

  const owner = await pgQueryOne<{ owner_user_id: string }>(
    `select owner_user_id::text as owner_user_id
     from public.messaging_partners
     where owner_user_id is not null
     limit 1`
  )
  if (!owner?.owner_user_id) return null

  const stamp = Date.now().toString().slice(-8)
  const slug = `hotel-smoke-${stamp}`
  const inserted = await pgQueryOne<{ id: string; slug: string }>(
    `insert into public.messaging_partners (slug, display_name, owner_user_id, industry_key)
     values ($1, $2, $3::uuid, 'hotel')
     returning id::text, slug`,
    [slug, `Hotel Smoke ${stamp}`, owner.owner_user_id]
  )
  return inserted
}

async function main() {
  const ping = await checkPgConnection()
  if (!ping.ok) {
    console.error('[hospitality-smoke] DB not ready:', ping.error)
    process.exit(1)
  }

  const partner = await ensureHotelPartner()
  if (!partner) {
    console.error('[hospitality-smoke] Cannot find/create hotel partner')
    process.exit(1)
  }

  const roomType = await createHospitalityRoomTypePg({
    partner_id: partner.id,
    code: `STD-${Date.now().toString().slice(-6)}`,
    name: 'Standard Room Smoke',
    max_guests: 2,
    base_hourly_rate: 120000,
    base_daily_rate: 420000,
    currency: 'VND',
    amenities: ['wifi', 'aircon'],
  })
  if (!roomType) {
    console.error('[hospitality-smoke] create room type failed')
    process.exit(1)
  }

  const room = await createHospitalityRoomPg({
    partner_id: partner.id,
    room_type_id: roomType.id,
    room_code: `R-${Date.now().toString().slice(-5)}`,
    floor_label: '1',
  })
  if (!room) {
    console.error('[hospitality-smoke] create room failed')
    process.exit(1)
  }

  const checkinAt = tsOffset(2)
  const checkoutAt = tsOffset(10)
  const availability = await fetchHospitalityAvailabilityPg({
    partner_id: partner.id,
    checkin_at: checkinAt,
    checkout_at: checkoutAt,
  })
  const availableThisType = availability.find((x) => x.room_type_id === roomType.id)
  if (!availableThisType || availableThisType.available_rooms < 1) {
    console.error('[hospitality-smoke] availability failed', availability)
    process.exit(1)
  }

  const hold = await createHospitalityHoldPg({
    partner_id: partner.id,
    room_type_id: roomType.id,
    customer_name: 'Smoke Guest',
    customer_phone: '0900000000',
    guests: 1,
    checkin_at: checkinAt,
    checkout_at: checkoutAt,
    expires_minutes: 20,
  })
  if (!hold) {
    console.error('[hospitality-smoke] create hold failed')
    process.exit(1)
  }

  const booking = await createHospitalityBookingFromHoldPg({
    partner_id: partner.id,
    hold_id: hold.id,
    customer_name: 'Smoke Guest',
    customer_phone: '0900000000',
    total_amount: 500000,
    currency: 'VND',
    channel: 'widget',
  })
  if (!booking) {
    console.error('[hospitality-smoke] create booking failed')
    process.exit(1)
  }

  const paymentOk = await createHospitalityPaymentPg({
    partner_id: partner.id,
    booking_id: booking.id,
    provider: 'manual',
    amount: 500000,
    currency: 'VND',
    status: 'paid',
    provider_txn_id: `SMOKE-${Date.now()}`,
    raw_payload: { source: 'hospitality_smoke_script' },
  })
  if (!paymentOk) {
    console.error('[hospitality-smoke] payment failed')
    process.exit(1)
  }

  const aiUpsert = await upsertHospitalityAiSettingsPg({
    partner_id: partner.id,
    enabled: true,
    tone_instructions: 'Lich su, nhanh, uu tien chot booking',
    policy_text: 'Co the huy theo dieu kien khach san',
    default_locale: 'vi',
    auto_reply_enabled: true,
  })
  const aiSettings = await fetchHospitalityAiSettingsPg(partner.id)
  if (!aiUpsert || !aiSettings) {
    console.error('[hospitality-smoke] ai settings failed')
    process.exit(1)
  }

  const pmsQueued = await enqueueHospitalityPmsSyncJobPg({
    partner_id: partner.id,
    connector_key: 'other',
    direction: 'push',
    entity_type: 'booking',
    entity_id: booking.id,
    payload: { booking_id: booking.id, from: 'hospitality_smoke_script' },
  })
  if (!pmsQueued) {
    console.error('[hospitality-smoke] pms queue failed')
    process.exit(1)
  }

  const pending = await fetchPendingHospitalityPmsSyncJobsPg(20)
  const newest = pending.find((j) => j.partner_id === partner.id && j.entity_id === booking.id)
  if (!newest) {
    console.error('[hospitality-smoke] pms fetch pending failed')
    process.exit(1)
  }
  const pmsDone = await updateHospitalityPmsSyncJobStatusPg({ id: newest.id, status: 'done' })
  if (!pmsDone) {
    console.error('[hospitality-smoke] pms update status failed')
    process.exit(1)
  }

  const report = await fetchHospitalityOwnerReportPg(partner.id)
  console.log(
    JSON.stringify(
      {
        ok: true,
        partner,
        room_type_id: roomType.id,
        room_id: room.id,
        hold_id: hold.id,
        booking_id: booking.id,
        availability_room_count: availableThisType.available_rooms,
        ai_default_locale: aiSettings.default_locale,
        report,
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
