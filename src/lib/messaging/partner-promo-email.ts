import { getPublicAppUrlForServer } from '@/lib/auth/public-app-url'
import { isSmtpConfigured, sendSmtpMail } from '@/lib/email/smtp'
import { hasMarketingOptOutFromPg } from '@/lib/db/messaging-partner-marketing-campaigns-pg'
import { buildMarketingOptOutUrl } from '@/lib/messaging/marketing-opt-out-token'
import {
  fillPromoTemplate,
  partnerPromoEmailCopy,
  type PartnerPromoEmailKind,
} from '@/lib/messaging/partner-promo-email-i18n'
import {
  escapePromoHtml,
  formatPromoVnd,
  resolvePartnerShopEmailContext,
  type PartnerShopEmailContext,
} from '@/lib/messaging/partner-shop-email-context'
import {
  insertPartnerEmailSendLogFromPg,
  resolveCustomerEmailForIdentityFromPg,
  tryConsumePartnerEmailSendSlotFromPg,
  type PartnerEmailSendChannel,
} from '@/lib/db/messaging-partner-email-management-pg'

function displayName(name?: string | null): string {
  const t = String(name || '').trim()
  return t || 'bạn'
}

function shellHtml(input: {
  inner: string
  shop: string
  ctaLabel: string
  ctaUrl: string
  buyColor: string
  footerNote: string
  unsubscribeHtml: string
  orCopy: string
}): string {
  const color = escapePromoHtml(input.buyColor)
  const cta = escapePromoHtml(input.ctaUrl)
  return `<div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;font-size:15px;line-height:1.55;color:#111827;max-width:560px;">
${input.inner}
<p style="margin:20px 0 12px;"><a href="${cta}" style="display:inline-block;padding:12px 22px;background:${color};color:#ffffff !important;text-decoration:none;border-radius:10px;font-weight:600;">${escapePromoHtml(input.ctaLabel)}</a></p>
<p style="font-size:12px;color:#6b7280;word-break:break-all;">${escapePromoHtml(input.orCopy)} <a href="${cta}">${escapePromoHtml(input.ctaUrl)}</a></p>
<p style="margin-top:24px;">${escapePromoHtml(input.footerNote.split('\n')[0] || '')}<br/>${escapePromoHtml(input.shop)}</p>
<hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;" />
<p style="font-size:12px;color:#9ca3af;">${escapePromoHtml(input.footerNote)}</p>
${input.unsubscribeHtml}
</div>`
}

function unsubscribeBits(input: {
  ctx: PartnerShopEmailContext
  toEmail: string
  recipientKey: string
  include: boolean
}): { text: string; html: string; listUnsubscribe?: string } {
  if (!input.include || !input.ctx.siteSlug) return { text: '', html: '' }
  const copy = partnerPromoEmailCopy(input.ctx.locale)
  const optOutUrl = buildMarketingOptOutUrl({
    appOrigin: getPublicAppUrlForServer().replace(/\/$/, ''),
    slug: input.ctx.siteSlug,
    payload: {
      partnerId: input.ctx.partnerId,
      recipientKey: input.recipientKey,
      email: input.toEmail,
    },
  })
  return {
    text: `\n${copy.unsubscribe} ${copy.unsubscribeCta}: ${optOutUrl}\n`,
    html: `<p style="font-size:12px;color:#9ca3af;margin-top:12px;">${escapePromoHtml(copy.unsubscribe)} <a href="${escapePromoHtml(optOutUrl)}" style="color:#6b7280;text-decoration:underline;">${escapePromoHtml(copy.unsubscribeCta)}</a></p>`,
    listUnsubscribe: optOutUrl,
  }
}

async function deliverPromoMail(input: {
  ctx: PartnerShopEmailContext
  toEmail: string
  recipientKey: string
  channel: PartnerEmailSendChannel
  kind: PartnerPromoEmailKind
  subject: string
  text: string
  html: string
  listUnsubscribe?: string
  skipOptOut?: boolean
  skipWarmup?: boolean
  campaignKey?: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isSmtpConfigured()) return { ok: false, error: 'smtp_not_configured' }
  const email = input.toEmail.trim().toLowerCase()
  if (!email) return { ok: false, error: 'no_email' }

  if (!input.skipOptOut) {
    const optedOut = await hasMarketingOptOutFromPg({
      partnerId: input.ctx.partnerId,
      recipientKey: input.recipientKey,
      email,
    })
    if (optedOut) return { ok: false, error: 'opt_out' }
  }

  if (!input.skipWarmup) {
    const slot = await tryConsumePartnerEmailSendSlotFromPg({
      partnerId: input.ctx.partnerId,
      channel: input.channel,
    })
    if (!slot) return { ok: false, error: 'warmup_quota' }
  }

  const sent = await sendSmtpMail({
    to: email,
    subject: input.subject,
    text: input.text,
    html: input.html,
    fromName: input.ctx.shopDisplayName,
    listUnsubscribe: input.listUnsubscribe,
  })
  await insertPartnerEmailSendLogFromPg({
    partnerId: input.ctx.partnerId,
    channel: input.channel,
    recipientEmail: email,
    recipientKey: input.recipientKey,
    campaignKey: input.campaignKey ?? null,
    subject: input.subject,
    status: sent.ok ? 'sent' : 'failed',
    error: sent.ok ? null : sent.error,
  })
  if (!sent.ok) return sent
  return { ok: true }
}

export async function sendPartnerBirthdayPromoEmail(input: {
  ctx: PartnerShopEmailContext
  toEmail: string
  recipientKey: string
  customerName?: string | null
  discountPercent: number
  nextBirthdayLabel: string
  skipWarmup?: boolean
  skipOptOut?: boolean
  campaignKey?: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const copy = partnerPromoEmailCopy(input.ctx.locale)
  const name = displayName(input.customerName)
  const shop = input.ctx.shopDisplayName
  const pct = Math.max(0, Math.min(100, Math.floor(input.discountPercent || 0)))
  const vars = { shop, name, percent: pct, date: input.nextBirthdayLabel }
  const unsub = unsubscribeBits({
    ctx: input.ctx,
    toEmail: input.toEmail,
    recipientKey: input.recipientKey,
    include: true,
  })
  const subject = fillPromoTemplate(copy.birthday.subject, vars)
  const hello = fillPromoTemplate(copy.hello, { name })
  const body = fillPromoTemplate(copy.birthday.body, vars)
  const next = fillPromoTemplate(copy.birthday.nextLabel, vars)
  const text = [
    hello.replace(/<[^>]+>/g, ''),
    '',
    body,
    next,
    '',
    `${copy.birthday.cta}: ${input.ctx.shopUrl}`,
    '',
    `${copy.regards}`,
    shop,
    `--`,
    fillPromoTemplate(copy.autoFooter, { shop }),
    unsub.text,
  ].join('\n')
  const inner = `<p>${escapePromoHtml(hello)}</p>
<p>${escapePromoHtml(body)}</p>
<p style="color:#4b5563;font-size:14px;">${escapePromoHtml(next)}</p>`
  const html = shellHtml({
    inner,
    shop,
    ctaLabel: fillPromoTemplate(copy.birthday.cta, vars),
    ctaUrl: input.ctx.shopUrl,
    buyColor: input.ctx.buyButtonColor,
    footerNote: fillPromoTemplate(copy.autoFooter, { shop }),
    unsubscribeHtml: unsub.html,
    orCopy: copy.orCopyLink,
  })
  return deliverPromoMail({
    ctx: input.ctx,
    toEmail: input.toEmail,
    recipientKey: input.recipientKey,
    channel: 'birthday',
    kind: 'birthday',
    subject,
    text,
    html,
    listUnsubscribe: unsub.listUnsubscribe,
    skipWarmup: input.skipWarmup,
    skipOptOut: input.skipOptOut,
    campaignKey: input.campaignKey,
  })
}

export function cartItemSummaryLines(
  items: unknown,
  extraLabel?: (n: number) => string,
  maxItems = 5
): string[] {
  if (!Array.isArray(items)) return []
  const extraFn = extraLabel || ((n: number) => `... và ${n} sản phẩm khác`)
  const lines: string[] = []
  for (const raw of items.slice(0, maxItems)) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue
    const o = raw as Record<string, unknown>
    const card = o.card && typeof o.card === 'object' && !Array.isArray(o.card) ? (o.card as Record<string, unknown>) : null
    const name =
      (typeof card?.name === 'string' && card.name.trim()) ||
      (typeof o.name === 'string' && o.name.trim()) ||
      (typeof o.product_name === 'string' && o.product_name.trim()) ||
      (typeof o.title === 'string' && o.title.trim()) ||
      'Sản phẩm'
    const qty = Math.max(1, Math.floor(Number(o.quantity) || 1))
    lines.push(`${name} × ${qty}`)
  }
  const extra = items.length - maxItems
  if (extra > 0) lines.push(extraFn(extra))
  return lines
}

export async function sendPartnerCartAbandonEmail(input: {
  ctx: PartnerShopEmailContext
  toEmail: string
  recipientKey: string
  customerName?: string | null
  promoCode: string
  discountPercent: number
  maxDiscountAmount: number
  validDays: number
  cartItems?: unknown
  skipWarmup?: boolean
  skipOptOut?: boolean
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const copy = partnerPromoEmailCopy(input.ctx.locale)
  const name = displayName(input.customerName)
  const shop = input.ctx.shopDisplayName
  const pct = Math.max(0, Math.min(100, Math.floor(input.discountPercent || 0)))
  const maxLabel = formatPromoVnd(input.maxDiscountAmount)
  const days = Math.max(1, Math.floor(input.validDays || 1))
  const vars = { shop, name, percent: pct, code: input.promoCode, max: maxLabel, days }
  const itemLines = cartItemSummaryLines(input.cartItems, (n) => fillPromoTemplate(copy.cart.extraItems, { n }))
  const unsub = unsubscribeBits({
    ctx: input.ctx,
    toEmail: input.toEmail,
    recipientKey: input.recipientKey,
    include: true,
  })
  const subject = fillPromoTemplate(copy.cart.subject, vars)
  const hello = fillPromoTemplate(copy.hello, { name })
  const codeLine = fillPromoTemplate(copy.cart.codeLine, vars)
  const itemsText = itemLines.length ? itemLines.map((l) => `  • ${l}`).join('\n') : '  •'
  const text = [
    hello,
    '',
    copy.cart.intro,
    '',
    itemsText,
    '',
    codeLine,
    '',
    `${copy.cart.cta}: ${input.ctx.cartUrl}`,
    `${copy.cart.wallet}: ${input.ctx.walletUrl}`,
    '',
    copy.regards,
    shop,
    `--`,
    fillPromoTemplate(copy.autoFooter, { shop }),
    unsub.text,
  ].join('\n')
  const itemsHtml = itemLines.length
    ? `<ul style="margin:12px 0;padding-left:20px;color:#374151;">${itemLines.map((l) => `<li style="margin:4px 0;">${escapePromoHtml(l)}</li>`).join('')}</ul>`
    : ''
  const inner = `<p>${escapePromoHtml(hello)}</p>
<p>${escapePromoHtml(copy.cart.intro)}</p>
${itemsHtml}
<p>${escapePromoHtml(codeLine)} <a href="${escapePromoHtml(input.ctx.walletUrl)}">${escapePromoHtml(copy.cart.wallet)}</a></p>`
  const html = shellHtml({
    inner,
    shop,
    ctaLabel: fillPromoTemplate(copy.cart.cta, vars),
    ctaUrl: input.ctx.cartUrl,
    buyColor: input.ctx.buyButtonColor,
    footerNote: fillPromoTemplate(copy.autoFooter, { shop }),
    unsubscribeHtml: unsub.html,
    orCopy: copy.orCopyLink,
  })
  return deliverPromoMail({
    ctx: input.ctx,
    toEmail: input.toEmail,
    recipientKey: input.recipientKey,
    channel: 'cart_abandon',
    kind: 'cart_abandon',
    subject,
    text,
    html,
    listUnsubscribe: unsub.listUnsubscribe,
    skipWarmup: input.skipWarmup,
    skipOptOut: input.skipOptOut,
  })
}

export async function sendPartnerComebackEmail(input: {
  ctx: PartnerShopEmailContext
  toEmail: string
  recipientKey: string
  customerName?: string | null
  promoCode: string
  discountPercent: number
  maxDiscountAmount: number
  validDays: number
  skipWarmup?: boolean
  skipOptOut?: boolean
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const copy = partnerPromoEmailCopy(input.ctx.locale)
  const name = displayName(input.customerName)
  const shop = input.ctx.shopDisplayName
  const pct = Math.max(0, Math.min(100, Math.floor(input.discountPercent || 0)))
  const maxLabel = formatPromoVnd(input.maxDiscountAmount)
  const days = Math.max(1, Math.floor(input.validDays || 1))
  const vars = { shop, name, percent: pct, code: input.promoCode, max: maxLabel, days }
  const unsub = unsubscribeBits({
    ctx: input.ctx,
    toEmail: input.toEmail,
    recipientKey: input.recipientKey,
    include: true,
  })
  const subject = fillPromoTemplate(copy.comeback.subject, vars)
  const hello = fillPromoTemplate(copy.hello, { name })
  const intro = fillPromoTemplate(copy.comeback.intro, vars)
  const codeLine = fillPromoTemplate(copy.comeback.codeLine, vars)
  const text = [
    hello,
    '',
    intro,
    '',
    codeLine,
    '',
    `${copy.comeback.cta}: ${input.ctx.shopUrl}`,
    `${copy.comeback.wallet}: ${input.ctx.walletUrl}`,
    '',
    copy.regards,
    shop,
    `--`,
    fillPromoTemplate(copy.autoFooter, { shop }),
    unsub.text,
  ].join('\n')
  const inner = `<p>${escapePromoHtml(hello)}</p>
<p>${escapePromoHtml(intro)}</p>
<p>${escapePromoHtml(codeLine)} <a href="${escapePromoHtml(input.ctx.walletUrl)}">${escapePromoHtml(copy.comeback.wallet)}</a></p>`
  const html = shellHtml({
    inner,
    shop,
    ctaLabel: fillPromoTemplate(copy.comeback.cta, vars),
    ctaUrl: input.ctx.shopUrl,
    buyColor: input.ctx.buyButtonColor,
    footerNote: fillPromoTemplate(copy.autoFooter, { shop }),
    unsubscribeHtml: unsub.html,
    orCopy: copy.orCopyLink,
  })
  return deliverPromoMail({
    ctx: input.ctx,
    toEmail: input.toEmail,
    recipientKey: input.recipientKey,
    channel: 'comeback',
    kind: 'comeback',
    subject,
    text,
    html,
    listUnsubscribe: unsub.listUnsubscribe,
    skipWarmup: input.skipWarmup,
    skipOptOut: input.skipOptOut,
  })
}

export async function sendPartnerNewsletterWelcomeEmail(input: {
  ctx: PartnerShopEmailContext
  toEmail: string
  recipientKey: string
  skipWarmup?: boolean
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const copy = partnerPromoEmailCopy(input.ctx.locale)
  const shop = input.ctx.shopDisplayName
  const vars = { shop, name: 'bạn' }
  const subject = fillPromoTemplate(copy.newsletter.subject, vars)
  const body = fillPromoTemplate(copy.newsletter.body, vars)
  const hello = fillPromoTemplate(copy.hello, { name: 'bạn' })
  const text = [
    hello,
    '',
    body,
    '',
    `${copy.newsletter.cta}: ${input.ctx.shopUrl}`,
    '',
    copy.regards,
    shop,
  ].join('\n')
  const inner = `<p>${escapePromoHtml(hello)}</p>
<p>${escapePromoHtml(body)}</p>`
  const html = shellHtml({
    inner,
    shop,
    ctaLabel: fillPromoTemplate(copy.newsletter.cta, vars),
    ctaUrl: input.ctx.shopUrl,
    buyColor: input.ctx.buyButtonColor,
    footerNote: fillPromoTemplate(copy.autoFooter, { shop }),
    unsubscribeHtml: '',
    orCopy: copy.orCopyLink,
  })
  return deliverPromoMail({
    ctx: input.ctx,
    toEmail: input.toEmail,
    recipientKey: input.recipientKey,
    channel: 'newsletter',
    kind: 'newsletter_welcome',
    subject,
    text,
    html,
    skipOptOut: true,
    skipWarmup: input.skipWarmup,
  })
}

export async function sendPartnerNewsletterCampaignEmail(input: {
  ctx: PartnerShopEmailContext
  toEmail: string
  recipientKey: string
  subject: string
  message: string
  skipWarmup?: boolean
  skipOptOut?: boolean
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const copy = partnerPromoEmailCopy(input.ctx.locale)
  const shop = input.ctx.shopDisplayName
  const unsub = unsubscribeBits({
    ctx: input.ctx,
    toEmail: input.toEmail,
    recipientKey: input.recipientKey,
    include: true,
  })
  const subject = input.subject.trim() || shop
  const body = input.message.trim()
  const text = [
    body,
    '',
    `${copy.campaign.cta}: ${input.ctx.shopUrl}`,
    '',
    copy.regards,
    shop,
    unsub.text,
  ].join('\n')
  const inner = `<p style="white-space:pre-wrap;">${escapePromoHtml(body).replace(/\n/g, '<br/>')}</p>`
  const html = shellHtml({
    inner,
    shop,
    ctaLabel: fillPromoTemplate(copy.campaign.cta, { shop }),
    ctaUrl: input.ctx.shopUrl,
    buyColor: input.ctx.buyButtonColor,
    footerNote: fillPromoTemplate(copy.campaign.receivedBecause, { shop }),
    unsubscribeHtml: unsub.html,
    orCopy: copy.orCopyLink,
  })
  return deliverPromoMail({
    ctx: input.ctx,
    toEmail: input.toEmail,
    recipientKey: input.recipientKey,
    channel: 'marketing',
    kind: 'campaign',
    subject,
    text,
    html,
    listUnsubscribe: unsub.listUnsubscribe,
    skipWarmup: input.skipWarmup,
    skipOptOut: input.skipOptOut,
  })
}

export const sendPartnerBroadcastEmail = sendPartnerNewsletterCampaignEmail

export { resolvePartnerShopEmailContext }

export async function resolvePartnerCustomerEmail(input: {
  partnerId: string
  guestAccountId?: string | null
  linkedUserId?: string | null
  emailNormalized?: string | null
}): Promise<{ email: string; name: string } | null> {
  return resolveCustomerEmailForIdentityFromPg(input)
}
