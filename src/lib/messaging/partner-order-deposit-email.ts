import type { SmtpInlineAttachment } from '@/lib/email/smtp'
import {
  depositQrDownloadFilename,
  isAllowedDepositQrImageUrl,
} from '@/lib/messaging/deposit-qr-image'
import { fetchDepositQrImageBytes } from '@/lib/messaging/fetch-deposit-qr-image'
import { resolvePartnerShopEmailContext } from '@/lib/messaging/partner-shop-email-context'

export const DEPOSIT_QR_EMAIL_CID = 'deposit-qr'

export function orderNeedsCustomerDepositMail(input: {
  requiredAmount: number
  paidAmount?: number
}): boolean {
  const required = Math.max(0, Number(input.requiredAmount) || 0)
  const paid = Math.max(0, Number(input.paidAmount) || 0)
  return required > 0 && paid < required
}

export function joinPublicShopPath(shopUrl: string, path: string): string {
  const base = String(shopUrl || '').replace(/\/$/, '')
  const p = path.startsWith('/') ? path : `/${path}`
  return `${base}${p}`
}

export function customerDepositOrderUrl(input: {
  shopUrl: string
  siteSlug: string
  orderId: string
}): string | null {
  const slug = input.siteSlug.trim()
  const id = input.orderId.trim()
  if (!slug || !id || !input.shopUrl.trim()) return null
  return joinPublicShopPath(input.shopUrl, `/orders/${encodeURIComponent(id)}/deposit`)
}

export function customerOrderDetailUrl(input: {
  shopUrl: string
  siteSlug: string
  orderId: string
}): string | null {
  const slug = input.siteSlug.trim()
  const id = input.orderId.trim()
  if (!slug || !id || !input.shopUrl.trim()) return null
  return joinPublicShopPath(input.shopUrl, `/orders/${encodeURIComponent(id)}`)
}

export function escapeDepositEmailHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Ảnh QR trong mail khách — CID (đã nhúng) hoặc URL https công khai. */
export function buildCustomerDepositQrEmailBlock(input: {
  qrImageSrc: string
  amountLabel: string
  transferMemo?: string
}): { text: string; html: string } {
  const src = String(input.qrImageSrc || '').trim()
  if (!src) return { text: '', html: '' }
  const memo = String(input.transferMemo || '').trim()
  const amount = String(input.amountLabel || '').trim()
  const textLines = [`Quét mã QR để đặt cọc${amount ? ` ${amount}` : ''}.`]
  if (memo) textLines.push(`Nội dung CK: ${memo}`)
  if (!src.startsWith('cid:')) textLines.push(`Mã QR: ${src}`)
  const html = `<div style="margin:16px 0 8px;">
<p style="margin:0 0 10px;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;font-size:14px;font-weight:600;color:#111827;">Quét mã QR để đặt cọc${amount ? ` ${escapeDepositEmailHtml(amount)}` : ''}</p>
<img src="${escapeDepositEmailHtml(src)}" alt="Mã QR đặt cọc" width="240" height="240" style="display:block;max-width:240px;width:240px;height:auto;border:1px solid #e5e7eb;border-radius:12px;background:#ffffff;" />
${memo ? `<p style="margin:8px 0 0;font-size:13px;color:#374151;font-family:system-ui,sans-serif;">Nội dung CK: <strong>${escapeDepositEmailHtml(memo)}</strong></p>` : ''}
</div>`
  return { text: textLines.join('\n'), html }
}

export async function resolveDepositQrForEmail(input: {
  qrUrl: string
  orderCode?: string
}): Promise<{ htmlSrc: string; attachment?: SmtpInlineAttachment } | null> {
  const url = String(input.qrUrl || '').trim()
  if (!isAllowedDepositQrImageUrl(url)) return null
  try {
    const content = await fetchDepositQrImageBytes(url)
    return {
      htmlSrc: `cid:${DEPOSIT_QR_EMAIL_CID}`,
      attachment: {
        filename: depositQrDownloadFilename(input.orderCode || 'don'),
        content,
        cid: DEPOSIT_QR_EMAIL_CID,
        contentType: 'image/png',
        contentDisposition: 'inline',
      },
    }
  } catch (e) {
    console.warn('[resolveDepositQrForEmail] fetch', e)
    return { htmlSrc: url }
  }
}

export async function resolveCustomerOrderOpenUrl(input: {
  partnerId: string
  orderId: string
  needsDeposit: boolean
  chatFallback?: string | null
}): Promise<string | null> {
  const ctx = await resolvePartnerShopEmailContext(input.partnerId)
  const shopUrl = input.needsDeposit
    ? customerDepositOrderUrl({ shopUrl: ctx.shopUrl, siteSlug: ctx.siteSlug, orderId: input.orderId })
    : customerOrderDetailUrl({ shopUrl: ctx.shopUrl, siteSlug: ctx.siteSlug, orderId: input.orderId })
  return shopUrl || input.chatFallback?.trim() || null
}
