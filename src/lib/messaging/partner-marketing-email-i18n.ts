import type { Json } from '@/types/database.types'
import { DEFAULT_WEB_LOCALE, type WebLocale, normalizeWebLocale } from '@/lib/i18n/config'
import type { MarketingInterestProduct } from '@/lib/messaging/partner-marketing-render'

function localeFromMetadata(metadata: Json | null | undefined): WebLocale {
  if (metadata !== null && typeof metadata === 'object' && !Array.isArray(metadata)) {
    const raw = (metadata as Record<string, unknown>).ui_locale
    if (typeof raw === 'string') {
      const n = normalizeWebLocale(raw)
      if (n) return n
    }
  }
  return DEFAULT_WEB_LOCALE
}

function esc(v: string): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function isHttpUrl(u: string | null | undefined): u is string {
  const t = String(u ?? '').trim()
  return /^https?:\/\//i.test(t)
}

type Copy = {
  subject: (shop: string) => string
  hello: (name: string) => string
  intro: (shop: string) => string
  interestLabel: string
  offerLine: (pct: number) => string
  lowStockBadge: string
  priceLabel: string
  cta: string
  linkHint: string
  signOff: (shop: string) => string
  optOutText: string
  footer: (shop: string) => string
}

const COPY: Record<WebLocale, Copy> = {
  vi: {
    subject: (s) => `${s} — sản phẩm bạn đang quan tâm`,
    hello: (n) => `Xin chào ${n},`,
    intro: (s) =>
      `${s} thấy bạn đang quan tâm một vài mẫu dưới đây. Nhắn lại với shop để được tư vấn và giữ mẫu nhé.`,
    interestLabel: 'Sản phẩm bạn quan tâm gần đây:',
    offerLine: (p) => `Đang có ưu đãi giảm ${p}% cho bạn.`,
    lowStockBadge: 'Sắp hết hàng',
    priceLabel: 'Giá',
    cta: 'Mở lại cuộc trò chuyện',
    linkHint: 'Hoặc sao chép liên kết:',
    signOff: (s) => `Trân trọng,\n${s}`,
    optOutText: 'Không muốn nhận email gợi ý từ shop? Hủy nhận tại đây',
    footer: (s) => `Bạn nhận email này vì đã từng nhắn tin với ${s}. Email tự động qua NanoAI.`,
  },
  en: {
    subject: (s) => `${s} — the items you were looking at`,
    hello: (n) => `Hi ${n},`,
    intro: (s) =>
      `${s} noticed you were interested in a few items below. Reply to the shop for advice or to hold your size.`,
    interestLabel: 'Products you recently viewed:',
    offerLine: (p) => `You have a ${p}% discount waiting.`,
    lowStockBadge: 'Low stock',
    priceLabel: 'Price',
    cta: 'Open the conversation',
    linkHint: 'Or copy this link:',
    signOff: (s) => `Best regards,\n${s}`,
    optOutText: 'Don’t want product emails from this shop? Unsubscribe here',
    footer: (s) => `You received this because you chatted with ${s}. Automated email via NanoAI.`,
  },
  zh: {
    subject: (s) => `${s} — 您关注的商品`,
    hello: (n) => `${n} 您好，`,
    intro: (s) => `${s} 注意到您对以下商品感兴趣。回复店铺即可获得咨询或为您留货。`,
    interestLabel: '您最近查看的商品：',
    offerLine: (p) => `为您准备了 ${p}% 的折扣。`,
    lowStockBadge: '库存不多',
    priceLabel: '价格',
    cta: '打开对话',
    linkHint: '或复制链接：',
    signOff: (s) => `此致\n${s}`,
    optOutText: '不想再收到本店铺的商品邮件？点此退订',
    footer: (s) => `您收到此邮件是因为曾与 ${s} 聊天。NanoAI 自动发送。`,
  },
  ja: {
    subject: (s) => `${s} — 気になっていた商品`,
    hello: (n) => `${n} 様`,
    intro: (s) => `${s} はお客様が以下の商品にご関心をお持ちと気づきました。ご相談やお取り置きはチャットへご返信ください。`,
    interestLabel: '最近ご覧になった商品：',
    offerLine: (p) => `${p}% の割引をご用意しています。`,
    lowStockBadge: '残りわずか',
    priceLabel: '価格',
    cta: '会話を開く',
    linkHint: 'またはリンクをコピー：',
    signOff: (s) => `よろしくお願いいたします。\n${s}`,
    optOutText: 'このショップからの商品メールを希望しない場合はこちらから配信停止',
    footer: (s) => `${s} とチャットされたため送信しています。NanoAI による自動送信です。`,
  },
  ko: {
    subject: (s) => `${s} — 관심 있게 보신 상품`,
    hello: (n) => `${n}님, 안녕하세요.`,
    intro: (s) => `${s}에서 아래 상품에 관심 있으신 것을 확인했어요. 상담이나 예약은 채팅으로 답장해 주세요.`,
    interestLabel: '최근에 보신 상품:',
    offerLine: (p) => `${p}% 할인 혜택이 준비되어 있어요.`,
    lowStockBadge: '재고 임박',
    priceLabel: '가격',
    cta: '대화 열기',
    linkHint: '또는 링크 복사:',
    signOff: (s) => `감사합니다.\n${s}`,
    optOutText: '이 상점의 상품 이메일을 원하지 않으세요? 여기서 수신 거부',
    footer: (s) => `${s}님과 채팅한 적이 있어 보내드립니다. NanoAI 자동 발송.`,
  },
}

export function formatMarketingCampaignEmailContent(input: {
  shopDisplayName: string
  customerName: string
  chatUrl: string
  optOutUrl: string
  products: MarketingInterestProduct[]
  offerPercent?: number | null
  emailIntro?: string | null
  metadata?: Json | null
}): { subject: string; text: string; html: string; listUnsubscribe: string } {
  const locale = localeFromMetadata(input.metadata ?? null)
  const c = COPY[locale] ?? COPY[DEFAULT_WEB_LOCALE]
  const shop = input.shopDisplayName.trim() || (locale === 'vi' ? 'Cửa hàng' : 'Shop')
  const name = input.customerName.trim() || (locale === 'vi' ? 'bạn' : 'there')
  const pct = input.offerPercent != null && input.offerPercent > 0 ? input.offerPercent : null
  const intro = input.emailIntro?.trim() || c.intro(shop)
  const products = input.products.slice(0, 4)

  const subject = c.subject(shop)

  // ----- text part -----
  const textLines: string[] = [c.hello(name), '', intro]
  if (pct) textLines.push('', c.offerLine(pct))
  if (products.length) {
    textLines.push('', c.interestLabel)
    for (const p of products) {
      const bits = [`• ${p.name}${p.sku ? ` (${p.sku})` : ''}`]
      if (p.priceHint) bits.push(`${c.priceLabel}: ${p.priceHint}`)
      if (p.lowStock) bits.push(c.lowStockBadge)
      textLines.push(bits.join(' — '))
      if (isHttpUrl(p.productUrl)) textLines.push(`  ${p.productUrl}`)
    }
  }
  textLines.push('', c.cta, input.chatUrl, '', c.signOff(shop), '', '—', c.footer(shop), input.optOutUrl)
  const text = textLines.join('\n')

  // ----- html part -----
  const safeChat = esc(input.chatUrl)
  const safeOptOut = esc(input.optOutUrl)

  const productCards = products
    .map((p) => {
      const link = isHttpUrl(p.productUrl) ? esc(p.productUrl) : safeChat
      const img = isHttpUrl(p.imageUrl)
        ? `<a href="${link}" style="text-decoration:none;"><img src="${esc(p.imageUrl)}" alt="${esc(p.name)}" width="120" style="width:120px;height:120px;object-fit:cover;border-radius:10px;display:block;border:1px solid #e5e7eb;" /></a>`
        : ''
      const price = p.priceHint
        ? `<div style="font-size:13px;color:#7c3aed;font-weight:600;margin-top:2px;">${esc(p.priceHint)}</div>`
        : ''
      const low = p.lowStock
        ? `<span style="display:inline-block;margin-top:4px;font-size:11px;color:#b91c1c;background:#fef2f2;border-radius:6px;padding:2px 8px;">${esc(c.lowStockBadge)}</span>`
        : ''
      return `<tr>
<td width="120" style="padding:0 12px 12px 0;vertical-align:top;">${img}</td>
<td style="padding:0 0 12px 0;vertical-align:top;">
<a href="${link}" style="font-size:15px;font-weight:600;color:#111827;text-decoration:none;">${esc(p.name)}</a>
${p.sku ? `<div style="font-size:12px;color:#9ca3af;">${esc(p.sku)}</div>` : ''}
${price}
${low}
</td>
</tr>`
    })
    .join('\n')

  const productsHtml = products.length
    ? `<p style="margin:18px 0 8px;font-size:14px;color:#374151;"><strong>${esc(c.interestLabel)}</strong></p>
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">${productCards}</table>`
    : ''

  const offerHtml = pct
    ? `<p style="margin:8px 0;padding:10px 14px;background:#f5f3ff;border-radius:8px;font-size:14px;color:#5b21b6;">${esc(c.offerLine(pct))}</p>`
    : ''

  const html = `<div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;font-size:15px;line-height:1.55;color:#111827;max-width:560px;">
<p>${esc(c.hello(name))}</p>
<p>${esc(intro)}</p>
${offerHtml}
${productsHtml}
<p style="margin:22px 0 12px;"><a href="${safeChat}" style="display:inline-block;padding:12px 22px;background:#7c3aed;color:#ffffff !important;text-decoration:none;border-radius:10px;font-weight:600;">${esc(c.cta)}</a></p>
<p style="font-size:12px;color:#6b7280;word-break:break-all;">${esc(c.linkHint)} <a href="${safeChat}">${safeChat}</a></p>
<p style="margin-top:24px;white-space:pre-line;">${esc(c.signOff(shop)).replace(/\n/g, '<br/>')}</p>
<hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;" />
<p style="font-size:12px;color:#9ca3af;">${esc(c.footer(shop))}</p>
<p style="font-size:12px;color:#9ca3af;"><a href="${safeOptOut}" style="color:#9ca3af;">${esc(c.optOutText)}</a></p>
</div>`

  const listUnsubscribe = `<${input.optOutUrl}>`

  return { subject, text, html, listUnsubscribe }
}
