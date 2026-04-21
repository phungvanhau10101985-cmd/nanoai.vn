import { fetchHospitalityConversationBookingAnchorPg, fetchHospitalityRoomTypesPg } from '@/lib/db/hospitality-pg'

export type HospitalityAiContext = {
  room_types: Array<{
    id: string
    code: string
    name: string
    max_guests: number
    base_hourly_rate: number | null
    base_daily_rate: number | null
    currency: string
  }>
  booking_anchor: {
    booking_id: string
    status: string
    checkin_at: string
    checkout_at: string
  } | null
}

export async function buildHospitalityAiContext(params: {
  partner_id: string
  conversation_id: string
}): Promise<HospitalityAiContext> {
  const [roomTypes, bookingAnchor] = await Promise.all([
    fetchHospitalityRoomTypesPg(params.partner_id),
    fetchHospitalityConversationBookingAnchorPg(params.conversation_id),
  ])
  return {
    room_types: roomTypes.slice(0, 8).map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      max_guests: r.max_guests,
      base_hourly_rate: r.base_hourly_rate,
      base_daily_rate: r.base_daily_rate,
      currency: r.currency,
    })),
    booking_anchor: bookingAnchor,
  }
}
