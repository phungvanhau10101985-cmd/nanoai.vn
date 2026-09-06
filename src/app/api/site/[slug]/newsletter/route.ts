import { NextRequest, NextResponse } from 'next/server'
import { isSmtpConfigured } from '@/lib/email/smtp'
import {
  ensurePartnerEmailSendSettingsFromPg,
  upsertNewsletterSubscriberFromPg,
} from '@/lib/db/messaging-partner-email-management-pg'
import { isValidPartnerEmail } from '@/lib/messaging/partner-email-normalize'
import {
  resolvePartnerShopEmailContext,
  sendPartnerNewsletterWelcomeEmail,
} from '@/lib/messaging/partner-promo-email'
import { loadPartnerSiteShopContext } from '@/lib/partner-website/shop/load-partner-site-shop-context'

export const dynamic = 'force-dynamic'

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status })
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  const shop = await loadPartnerSiteShopContext(slug)
  if (!shop) return json({ ok: false, error: 'not_found' }, 404)

  const body = (await request.json().catch(() => null)) as { email?: unknown } | null
  const email = String(body?.email ?? '').trim()
  if (!isValidPartnerEmail(email)) return json({ ok: false, error: 'invalid_email' }, 400)

  const up = await upsertNewsletterSubscriberFromPg({
    partnerId: shop.partnerId,
    email,
    source: 'footer',
  })
  if ('error' in up) return json({ ok: false, error: up.error }, 400)

  if (up.created && isSmtpConfigured()) {
    const settings = await ensurePartnerEmailSendSettingsFromPg(shop.partnerId)
    if (!settings || settings.newsletter_welcome_email_enabled) {
      const emailCtx = await resolvePartnerShopEmailContext(shop.partnerId)
      if (emailCtx) {
        void sendPartnerNewsletterWelcomeEmail({
          ctx: emailCtx,
          toEmail: up.email,
          recipientKey: `email:${up.email}`,
        }).catch((e) => console.warn('[newsletter-welcome]', e))
      }
    }
  }

  return json({ ok: true, created: up.created, reactivated: up.reactivated })
}
