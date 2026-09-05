import type { NextRequest } from 'next/server'
import {
  listActivePartnerFeatureTestsFromPg,
  resolvePartnerStorefrontSaleCalendarFromPg,
} from '@/lib/db/messaging-partner-feature-test-pg'
import { isSiteSaleTestActive } from '@/lib/partner-website/promotions/partner-feature-test'
import type {
  PartnerSaleCalendarSettings,
  PartnerSaleCalendarState,
} from '@/lib/partner-website/promotions/partner-sale-calendar'
import { resolveSiteVisitorEmail } from '@/lib/partner-website/shop/partner-site-personalization'

export async function resolvePartnerStorefrontSaleCalendarForRequest(input: {
  request: NextRequest
  partnerId: string
  settings?: PartnerSaleCalendarSettings | null
  at?: Date
  visitorEmail?: string | null
}): Promise<PartnerSaleCalendarState> {
  const rows = await listActivePartnerFeatureTestsFromPg(input.partnerId)
  const visitorEmail =
    input.visitorEmail !== undefined
      ? input.visitorEmail
      : rows.some((row) => isSiteSaleTestActive(row))
        ? await resolveSiteVisitorEmail(input.request, input.partnerId)
        : null
  return resolvePartnerStorefrontSaleCalendarFromPg({
    partnerId: input.partnerId,
    visitorEmail,
    settings: input.settings,
    at: input.at,
  })
}
