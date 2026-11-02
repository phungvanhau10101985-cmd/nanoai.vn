import { fetchCustomerCareMessageByIdPg, mergeCustomerCareMessageRawPayloadPatchPg } from '@/lib/db/customer-care-pg'
import { fetchPartnerPaymentSettingsFromPg } from '@/lib/db/messaging-partner-orders-pg'
import {
  fetchMessagingPartnerOwnerUserIdFromPg,
  fetchMessagingPartnersByIdsFromPg,
  listMessagingPartnerNotifyUserIdsFromPg,
} from '@/lib/db/messaging-partners-pg'
import { getAuthUserEmailFromPg } from '@/lib/db/auth-user-email-pg'
import { getPublicAppUrlForServer } from '@/lib/auth/public-app-url'
import { isSmtpConfigured, sendSmtpMail } from '@/lib/email/smtp'
import { partnerShopEmailBrandName, shopEmailSubject } from '@/lib/messaging/partner-shop-email-brand'
import { normalizeCustomerMessageForInventorySearch } from '@/lib/messaging/partner-inventory-message-normalize'

const VN_MOBILE_RE = /(?:\+?84|0)(?:3|5|7|8|9)(?:[\s.\-()]*\d){8,10}/g
const MAILBOX_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i

function toLocalMobile(digits: string): string | null {
  const local = digits.startsWith('84') && digits.length === 11 ? `0${digits.slice(2)}` : digits
  return /^0(?:3|5|7|8|9)\d{8}$/.test(local) ? local : null
}

/** Mọi số di động Việt Nam trong tin. Không lấy mã mẫu, mã đơn. */
export function extractCustomerVnMobiles(raw: string): string[] {
  const text = normalizeCustomerMessageForInventorySearch(raw)
  if (!text) return []
  const found: string[] = []
  const re = new RegExp(VN_MOBILE_RE.source, 'g')
  let match: RegExpExecArray | null
  while ((match = re.exec(text))) {
    const local = toLocalMobile(match[0].replace(/\D+/g, ''))
    if (!local || found.includes(local)) continue
    found.push(local)
    if (found.length >= 3) break
  }
  return found
}

/** Số Zalo shop ghi trong ngữ cảnh hướng dẫn. Không lấy hotline hay SĐT khách. */
export function zaloContactFromShopGuidance(raw: string | null | undefined): { dial: string | null; href: string | null } {
  const text = String(raw ?? '')
  if (!text.trim()) return { dial: null, href: null }
  const re = /zalo/gi
  let match: RegExpExecArray | null
  while ((match = re.exec(text))) {
    const after = text.slice(match.index, Math.min(text.length, match.index + 96))
    const url = after.match(/https?:\/\/(?:www\.)?zalo\.me\/[^\s)\]>,]+/i)?.[0] ?? null
    const fromUrl = url
      ? toLocalMobile((url.match(/zalo\.me\/(\+?\d{8,15})/i)?.[1] ?? '').replace(/\D+/g, ''))
      : null
    const dial = fromUrl || extractCustomerVnMobiles(after)[0] || null
    if (dial || url) {
      return {
        dial,
        href: url || (dial ? `https://zalo.me/${dial.replace(/^0/, '84')}` : null),
      }
    }
    const before = text.slice(Math.max(0, match.index - 48), match.index)
    const earlier = extractCustomerVnMobiles(before)[0] || null
    if (earlier) return { dial: earlier, href: `https://zalo.me/${earlier.replace(/^0/, '84')}` }
  }
  return { dial: null, href: null }
}

/**
 * Tin có SĐT nhưng đang tra đơn, hỏi chính sách hoặc chốt mua thì không đổi câu trả lời.
 * Chỉ nhánh làm rõ mới nhận tin Zalo ngay.
 */
export function phoneLeadShouldTakeConsultReply(input: {
  hasPhone: boolean
  orderStatusAsk: boolean
  policyAsk: boolean
  purchaseAsk: boolean
  clarifyOnly: boolean
}): boolean {
  return (
    input.hasPhone &&
    input.clarifyOnly &&
    !input.orderStatusAsk &&
    !input.policyAsk &&
    !input.purchaseAsk
  )
}

function zaloSentence(dial: string | null, href: string | null, locale: string): string {
  if (locale.startsWith('en')) {
    if (dial) return `If you need a faster reply, message the shop on Zalo at ${dial}.`
    if (href) return `If you need a faster reply, message the shop on Zalo: ${href}.`
    return ''
  }
  if (locale.startsWith('zh')) {
    if (dial) return `如果比较急，请发 Zalo 到 ${dial}，这样最快。`
    if (href) return `如果比较急，请通过 Zalo 联系店铺：${href}。`
    return ''
  }
  if (locale.startsWith('ja')) {
    if (dial) return `お急ぎなら Zalo の ${dial} へメッセージください。いちばん早くご案内できます。`
    if (href) return `お急ぎならショップの Zalo へどうぞ：${href}`
    return ''
  }
  if (locale.startsWith('ko')) {
    if (dial) return `급하시면 Zalo ${dial} 로 메시지 주세요. 거기서 가장 빨리 안내해 드려요.`
    if (href) return `급하시면 샵 Zalo로 연락 주세요: ${href}`
    return ''
  }
  if (dial) return `Nếu anh/chị cần gấp thì nhắn Zalo số ${dial} để được tư vấn nhanh nhất nhé.`
  if (href) return `Nếu anh/chị cần gấp thì nhắn Zalo shop tại ${href} để được tư vấn nhanh nhất nhé.`
  return ''
}

/** Xác nhận số, chỉ đường Zalo khi gấp, và hỏi đang cần tư vấn gì — không menu loại hàng. */
export function formatCustomerPhoneLeadReply(input: {
  phone: string
  zaloDial?: string | null
  zaloHref?: string | null
  sku?: string | null
  locale?: string | null
}): string {
  const loc = String(input.locale ?? '').trim().toLowerCase().slice(0, 8)
  const phone = input.phone.trim()
  const sku = input.sku?.trim() || ''
  const zalo = zaloSentence(input.zaloDial?.trim() || null, input.zaloHref?.trim() || null, loc)
  const gap = zalo ? ` ${zalo}` : ''
  if (loc.startsWith('en')) {
    if (sku) {
      return `I've noted ${phone}. I'm holding style ${sku} for you.${gap} Would you like the size, color, or price of this piece?`
    }
    return `I've noted ${phone}.${gap} If it's not urgent, tell me what you'd like advice on — a product code or a photo works too.`
  }
  if (loc.startsWith('zh')) {
    if (sku) {
      return `已记下号码 ${phone}。款号 ${sku} 我先帮您留着。${gap}您想先了解这款的尺码、颜色还是价格？`
    }
    return `已记下号码 ${phone}。${gap}不急的话，告诉我您想咨询哪一款，发商品编码或照片都可以。`
  }
  if (loc.startsWith('ja')) {
    if (sku) {
      return `${phone} を承りました。品番 ${sku} は押さえておきます。${gap}サイズ、色、価格のどれからご案内しましょうか。`
    }
    return `${phone} を承りました。${gap}急ぎでなければ、見たい商品を教えてください。品番か写真でも大丈夫です。`
  }
  if (loc.startsWith('ko')) {
    if (sku) {
      return `${phone} 번호 확인했습니다. ${sku} 상품은 제가 잡아 둘게요.${gap}사이즈, 색상, 가격 중 어떤 걸 먼저 볼까요?`
    }
    return `${phone} 번호 확인했습니다.${gap}급하지 않으시면 어떤 상품을 보고 싶으신지 알려 주세요. 상품 코드나 사진도 좋습니다.`
  }
  if (sku) {
    return `Dạ em nhận số ${phone} rồi ạ. Mẫu ${sku} em đang giữ giúp anh/chị.${gap} Về mẫu này, anh/chị muốn hỏi size, màu hay giá ạ?`
  }
  if (zalo) {
    return `Dạ em nhận số ${phone} rồi ạ.${gap} Còn không gấp, anh/chị đang muốn xem món gì cứ nói em, gửi mã hoặc ảnh cũng được ạ.`
  }
  return `Dạ em nhận số ${phone} rồi ạ. Anh/chị đang muốn xem món gì cứ nói em, gửi mã hoặc ảnh cũng được ạ.`
}

export function formatPhoneLeadPromptNote(input: {
  phone: string
  zaloDial?: string | null
  zaloHref?: string | null
}): string {
  const phone = input.phone.trim()
  const dial = input.zaloDial?.trim() || ''
  const href = input.zaloHref?.trim() || ''
  if (!dial && !href) return ''
  const where = dial ? `số ${dial}` : href
  return `

[Bắt buộc] Khách vừa để lại số ${phone}. Thêm đúng một câu tự nhiên: nếu cần gấp thì nhắn Zalo ${where} để được tư vấn nhanh nhất. Sau đó trả lời đúng ý khách đang hỏi. Không hỏi lại loại áo quần. Không biến cả tin thành xin số.`
}

type PhoneLeadRaw = {
  customer_phone?: unknown
  zalo_dial?: unknown
  zalo_href?: unknown
}

export function phoneLeadZaloFromRaw(raw: unknown): {
  customerPhone: string
  zaloDial: string | null
  zaloHref: string | null
} | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const block = (raw as { phone_lead_zalo?: unknown }).phone_lead_zalo
  if (!block || typeof block !== 'object' || Array.isArray(block)) return null
  const row = block as PhoneLeadRaw
  const customerPhone = typeof row.customer_phone === 'string' ? row.customer_phone.trim() : ''
  if (!toLocalMobile(customerPhone)) return null
  const zaloDial = typeof row.zalo_dial === 'string' && row.zalo_dial.trim() ? row.zalo_dial.trim() : null
  const zaloHref = typeof row.zalo_href === 'string' && row.zalo_href.trim() ? row.zalo_href.trim() : null
  return { customerPhone, zaloDial, zaloHref }
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

async function listShopAdminEmails(partnerId: string): Promise<string[]> {
  const ids = await listMessagingPartnerNotifyUserIdsFromPg(partnerId)
  const ownerId = await fetchMessagingPartnerOwnerUserIdFromPg(partnerId)
  const userIds = [...new Set([...(ownerId ? [ownerId] : []), ...ids])]
  const emails: string[] = []
  for (const userId of userIds) {
    const email = (await getAuthUserEmailFromPg(userId))?.trim().toLowerCase() || ''
    if (MAILBOX_RE.test(email)) emails.push(email)
  }
  try {
    const settings = await fetchPartnerPaymentSettingsFromPg(partnerId)
    const notify = String(settings?.notify_email || '').trim().toLowerCase()
    if (MAILBOX_RE.test(notify)) emails.push(notify)
  } catch (e) {
    console.warn('[phone-lead] notify email', e instanceof Error ? e.message : e)
  }
  return [...new Set(emails)]
}

/** Gửi nội dung khách hỏi và SĐT tới mọi email quản trị của shop. Không đổi nhánh trả lời. */
export async function emailShopAdminsCustomerPhoneLead(input: {
  partnerId: string
  conversationId: string
  messageId: string
  customerText: string
  phones: string[]
}): Promise<void> {
  const phones = input.phones.map((p) => p.trim()).filter((p) => toLocalMobile(p))
  if (!phones.length || !isSmtpConfigured()) return
  try {
    const existing = await fetchCustomerCareMessageByIdPg(input.messageId)
    const raw = existing?.raw_payload
    if (raw && typeof raw === 'object' && !Array.isArray(raw) && (raw as { phone_lead_emailed?: unknown }).phone_lead_emailed === true) {
      return
    }
    await mergeCustomerCareMessageRawPayloadPatchPg(input.messageId, { phone_lead_emailed: true })
    const recipients = await listShopAdminEmails(input.partnerId)
    if (!recipients.length) return
    const partners = await fetchMessagingPartnersByIdsFromPg([input.partnerId])
    const shopName = partnerShopEmailBrandName(partners?.[0])
    const origin = getPublicAppUrlForServer().replace(/\/$/, '')
    const inbox = `${origin}/dashboard/messaging/inbox?partner=${encodeURIComponent(input.partnerId)}&conversation=${encodeURIComponent(input.conversationId)}`
    const asked = input.customerText.trim().slice(0, 1500) || '(không có chữ)'
    const subject = shopEmailSubject(shopName, 'Khách để lại số điện thoại')
    const text = [
      'Khách vừa nhắn trong chat và để lại số điện thoại.',
      '',
      `Số: ${phones.join(', ')}`,
      '',
      'Nội dung khách hỏi:',
      asked,
      '',
      `Mở hội thoại: ${inbox}`,
      '',
      `— ${shopName}`,
    ].join('\n')
    const html = `<p>Khách vừa nhắn trong chat và để lại số điện thoại.</p><p><b>Số:</b> ${escapeHtml(phones.join(', '))}</p><p><b>Nội dung khách hỏi:</b><br>${escapeHtml(asked).replace(/\n/g, '<br>')}</p><p><a href="${escapeHtml(inbox)}">Mở hội thoại</a></p><p>— ${escapeHtml(shopName)}</p>`
    await Promise.all(
      recipients.map((to) =>
        sendSmtpMail({ to, subject, text, html, fromName: shopName }).then((res) => {
          if (!res.ok) console.warn('[phone-lead] smtp', res.error)
        })
      )
    )
  } catch (e) {
    console.warn('[phone-lead] admin email', e instanceof Error ? e.message : e)
  }
}

