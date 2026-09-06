import { sendPartnerBirthdayPromoEmail } from '@/lib/messaging/partner-promo-email'
import { resolvePartnerShopEmailContext } from '@/lib/messaging/partner-shop-email-context'

/** Wrapper tương thích feature-test / cron cũ — CTA web shop, không chat NanoAI. */
export async function emailCustomerBirthdayPromo(input: {
  toEmail: string
  shopDisplayName: string
  chatUrl: string
  discountPercent: number
  nextBirthdayLabel: string
  partnerId?: string
  customerName?: string | null
  recipientKey?: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (input.partnerId) {
    const ctx = await resolvePartnerShopEmailContext(input.partnerId)
    return sendPartnerBirthdayPromoEmail({
      ctx: { ...ctx, shopDisplayName: input.shopDisplayName.trim() || ctx.shopDisplayName },
      toEmail: input.toEmail,
      recipientKey: input.recipientKey || `email:${input.toEmail.trim().toLowerCase()}`,
      customerName: input.customerName,
      discountPercent: input.discountPercent,
      nextBirthdayLabel: input.nextBirthdayLabel,
      skipWarmup: true,
      skipOptOut: true,
    })
  }
  const ctx = {
    partnerId: '',
    shopDisplayName: input.shopDisplayName.trim() || 'Shop',
    siteSlug: '',
    locale: 'vi' as const,
    shopUrl: input.chatUrl,
    cartUrl: input.chatUrl,
    walletUrl: input.chatUrl,
    buyButtonColor: '#111827',
  }
  return sendPartnerBirthdayPromoEmail({
    ctx,
    toEmail: input.toEmail,
    recipientKey: `email:${input.toEmail.trim().toLowerCase()}`,
    customerName: input.customerName,
    discountPercent: input.discountPercent,
    nextBirthdayLabel: input.nextBirthdayLabel,
    skipWarmup: true,
    skipOptOut: true,
  })
}
