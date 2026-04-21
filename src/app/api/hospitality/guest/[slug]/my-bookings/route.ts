import { NextRequest, NextResponse } from 'next/server'
import { resolveHospitalityPartnerBySlug } from '@/lib/hospitality/hospitality-partner-resolver'
import {
  applyHospitalityGuestIdentityToResponse,
  resolveHospitalityGuestIdentity,
  upsertHospitalityGuestAccountForGoogleIdentity,
} from '@/lib/hospitality/hospitality-guest-identity'
import { fetchHospitalityGuestConversationId } from '@/lib/hospitality/hospitality-conversation-service'
import { fetchHospitalityBookingsForConversationPg } from '@/lib/db/hospitality-pg'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  const partner = await resolveHospitalityPartnerBySlug(slug)
  if (!partner) {
    return NextResponse.json({ error: 'PARTNER_NOT_FOUND' }, { status: 404 })
  }

  const identity = await resolveHospitalityGuestIdentity(request)
  let effectiveExternalThreadId = identity.externalThreadId
  let effectiveGuestAccountId = identity.guestAccountId
  if (identity.user?.id) {
    const accountId = await upsertHospitalityGuestAccountForGoogleIdentity(partner.id, request, identity.user)
    if (accountId) {
      effectiveGuestAccountId = accountId
      effectiveExternalThreadId = accountId
    }
  }

  const convId = await fetchHospitalityGuestConversationId(partner.id, effectiveExternalThreadId)
  const bookings = convId ? await fetchHospitalityBookingsForConversationPg(partner.id, convId, 20) : []

  const res = NextResponse.json({ ok: true, bookings })
  applyHospitalityGuestIdentityToResponse(res, request, {
    newSessionId: identity.newSessionId,
    user: identity.user ?? null,
    effectiveExternalThreadId,
    effectiveGuestAccountId,
  })
  return res
}
