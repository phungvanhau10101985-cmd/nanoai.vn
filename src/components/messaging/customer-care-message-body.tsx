import type { Json } from '@/types/database.types'
import { aiProductCardsFromPayload, type PartnerAiProductCard } from '@/lib/messaging/partner-ai-product-cards'

type Row = { body: string; raw_payload: Json | null }

function imageUrlFromPayload(raw: Json | null): string | null {
  if (!raw || typeof raw !== 'object' || raw === null) return null
  const o = raw as Record<string, unknown>
  const gm = o.guest_media ?? o.partner_media
  if (!gm || typeof gm !== 'object' || gm === null) return null
  const m = gm as Record<string, unknown>
  if (m.kind !== 'image' || typeof m.url !== 'string') return null
  return m.url
}

export type CustomerCareMessageBodyTone = 'default' | 'onViolet'

export type CustomerCareMessageBodyLabels = {
  /** Nút / gợi ý dưới thẻ sản phẩm AI (a11y + hiển thị). */
  productCardOpenProduct: string
}

function AiProductCards({
  cards,
  onViolet,
  labels,
}: {
  cards: PartnerAiProductCard[]
  onViolet: boolean
  labels?: CustomerCareMessageBodyLabels
}) {
  if (!cards.length) return null
  const cta = labels?.productCardOpenProduct?.trim()
  return (
    <div className="grid max-w-sm gap-2 sm:grid-cols-2">
      {cards.map((p, idx) => {
        const aria = cta ? `${p.name}. ${cta}` : p.name
        return (
          <a
            key={`${idx}-${p.product_url}`}
            href={p.product_url}
            target="_blank"
            rel="noopener noreferrer"
            className={`block overflow-hidden rounded-lg border shadow-sm transition-opacity hover:opacity-95 ${
              onViolet ? 'border-white/25 bg-white/10' : 'border-border/60 bg-card'
            }`}
            aria-label={aria}
            title={cta || undefined}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={p.image_url}
              alt=""
              className={`h-28 w-full object-cover sm:h-32 ${onViolet ? 'opacity-95' : ''}`}
              loading="lazy"
            />
            <div className={`space-y-0.5 px-2 py-1.5 text-left ${onViolet ? 'text-white' : ''}`}>
              <p className="line-clamp-2 text-xs font-medium leading-snug">{p.name}</p>
              {p.price_hint ? (
                <p className={`text-[11px] tabular-nums ${onViolet ? 'text-white/85' : 'text-muted-foreground'}`}>
                  {p.price_hint}
                </p>
              ) : null}
              {cta ? (
                <p className={`text-[10px] font-medium ${onViolet ? 'text-white/90' : 'text-primary'}`}>{cta}</p>
              ) : null}
            </div>
          </a>
        )
      })}
    </div>
  )
}

/** Hiển thị nội dung tin (chữ + ảnh khách/shop widget nếu có). */
export function CustomerCareMessageBody({
  row,
  tone = 'default',
  labels,
}: {
  row: Row
  tone?: CustomerCareMessageBodyTone
  labels?: CustomerCareMessageBodyLabels
}) {
  const url = imageUrlFromPayload(row.raw_payload)
  const caption = row.body.replace(/^📷\s*/u, '').trim()
  const onViolet = tone === 'onViolet'
  const productCards = aiProductCardsFromPayload(row.raw_payload)

  return (
    <div className={`space-y-2 ${onViolet ? '[&_a]:text-white/90 [&_img]:border-white/25' : ''}`}>
      {url ? (
        <a href={url} target="_blank" rel="noopener noreferrer" className="block max-w-sm">
          <img
            src={url}
            alt=""
            className={`max-h-52 w-full rounded-lg border object-contain ${onViolet ? 'border-white/25 bg-white/10' : 'border-border/60 bg-muted/30'}`}
            loading="lazy"
          />
        </a>
      ) : null}
      {caption ? (
        <div className={`whitespace-pre-wrap break-words ${onViolet ? 'text-white' : ''}`}>{caption}</div>
      ) : null}
      <AiProductCards cards={productCards} onViolet={onViolet} labels={labels} />
      {!url && !caption && !productCards.length && row.body ? (
        <div className={`whitespace-pre-wrap break-words ${onViolet ? 'text-white' : ''}`}>{row.body}</div>
      ) : null}
    </div>
  )
}
