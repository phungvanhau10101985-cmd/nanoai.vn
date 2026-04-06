import type { Json } from '@/types/database.types'
import { aiProductCardsFromPayload, type PartnerAiProductCard } from '@/lib/messaging/partner-ai-product-cards'

type Row = { body: string; raw_payload: Json | null }

function formatVndPrice(priceHint: string | undefined): string | null {
  const raw = (priceHint ?? '').trim()
  if (!raw) return null
  const digits = raw.replace(/[^\d]/g, '')
  if (digits.length < 3) return raw
  const n = Number.parseInt(digits, 10)
  if (!Number.isFinite(n)) return raw
  return `${new Intl.NumberFormat('vi-VN').format(n)}đ`
}

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
  onProductCardPick,
}: {
  cards: PartnerAiProductCard[]
  onViolet: boolean
  labels?: CustomerCareMessageBodyLabels
  onProductCardPick?: (card: PartnerAiProductCard) => void
}) {
  if (!cards.length) return null
  const cta = labels?.productCardOpenProduct?.trim()
  return (
    <div className="-mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]">
      {cards.map((p, idx) => {
        const aria = cta ? `${p.name}. ${cta}` : p.name
        const priceLabel = formatVndPrice(p.price_hint)
        const pickable = typeof onProductCardPick === 'function'
        return (
          <div
            key={`${idx}-${p.product_url}`}
            className={`w-36 shrink-0 snap-start overflow-hidden rounded-lg border shadow-sm transition-opacity hover:opacity-95 ${
              onViolet ? 'border-white/25 bg-white/10' : 'border-border/60 bg-card'
            } ${pickable ? 'cursor-pointer' : ''}`}
            aria-label={aria}
            title={cta || undefined}
            role={pickable ? 'button' : undefined}
            tabIndex={pickable ? 0 : undefined}
            onClick={() => {
              if (pickable) onProductCardPick?.(p)
            }}
            onKeyDown={(ev) => {
              if (!pickable) return
              if (ev.key === 'Enter' || ev.key === ' ') {
                ev.preventDefault()
                onProductCardPick?.(p)
              }
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={p.image_url}
              alt=""
              className={`h-28 w-full object-contain ${onViolet ? 'bg-white/10 opacity-95' : 'bg-muted/30'}`}
              loading="lazy"
            />
            <div className={`px-2 py-1.5 text-left ${onViolet ? 'text-white' : ''}`}>
              <div className="flex items-center justify-between gap-2">
                <p
                  className={`min-w-0 flex-1 truncate text-[11px] tabular-nums ${onViolet ? 'text-white/85' : 'text-muted-foreground'}`}
                >
                  {priceLabel ?? ''}
                </p>
                {cta ? (
                  <a
                    href={p.product_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-md px-2 py-1 text-[10px] font-semibold leading-none ${
                      onViolet
                        ? 'bg-white/20 text-white hover:bg-white/30'
                        : 'bg-primary/10 text-primary hover:bg-primary/15'
                    }`}
                    onClick={(ev) => ev.stopPropagation()}
                  >
                    {cta}
                  </a>
                ) : null}
              </div>
            </div>
          </div>
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
  onProductCardPick,
}: {
  row: Row
  tone?: CustomerCareMessageBodyTone
  labels?: CustomerCareMessageBodyLabels
  onProductCardPick?: (card: PartnerAiProductCard) => void
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
      <AiProductCards cards={productCards} onViolet={onViolet} labels={labels} onProductCardPick={onProductCardPick} />
      {!url && !caption && !productCards.length && row.body ? (
        <div className={`whitespace-pre-wrap break-words ${onViolet ? 'text-white' : ''}`}>{row.body}</div>
      ) : null}
    </div>
  )
}
