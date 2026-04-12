'use client'

import { useState } from 'react'
import { Play } from 'lucide-react'
import type { Json } from '@/types/database.types'
import { MessageImagePreviewDialog } from '@/components/messaging/message-image-preview-dialog'
import { MessageVideoFullscreenDialog } from '@/components/messaging/message-video-fullscreen-dialog'
import { normalizeProductUrlKey } from '@/lib/messaging/normalize-product-url-key'
import { isProductConsultedInScopeSet } from '@/lib/messaging/consult-product-scope-key'
import { aiProductCardsFromPayload, type PartnerAiProductCard } from '@/lib/messaging/partner-ai-product-cards'
import { youtubeThumbnailUrl } from '@/lib/messaging/guest-product-video'

type Row = { id?: string; body: string; raw_payload: Json | null }

/** Thumbnail ô video: khung đầu từ file MP4/WebM (YouTube dùng ảnh ytimg riêng). */
function DirectVideoStripThumbnail({
  src,
  onViolet,
}: {
  src: string
  onViolet: boolean
}) {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return (
      <div
        className={`flex h-full w-full items-center justify-center ${onViolet ? 'bg-white/10' : 'bg-muted/50'}`}
        aria-hidden
      />
    )
  }

  return (
    <video
      src={src}
      muted
      playsInline
      preload="metadata"
      className="pointer-events-none h-full w-full object-cover"
      onLoadedMetadata={(e) => {
        const el = e.currentTarget
        try {
          const d = el.duration
          const seek =
            Number.isFinite(d) && d > 0 ? Math.min(0.08, Math.max(0.02, d * 0.02)) : 0.05
          el.currentTime = seek
        } catch {
          /* ignore */
        }
      }}
      onError={() => setFailed(true)}
      aria-hidden
    />
  )
}

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
  /** Mở trang sản phẩm (luôn phía trên nút tư vấn/mua khi có link). */
  productCardViewDetails?: string
  /** Ô video cạnh ảnh (khi có `product_video_url`). */
  productCardViewVideo?: string
  /** a11y nút đóng dialog video. */
  productCardCloseVideo?: string
  /** Sau khi đã «tư vấn» lần đầu (cùng URL SP trong phiên). */
  productCardBuyProduct?: string
  consultedProductKeys?: ReadonlySet<string> | null
}

function AiProductCards({
  cards,
  onViolet,
  labels,
  onProductCardPick,
  onPreviewImage,
  onPreviewVideo,
}: {
  cards: PartnerAiProductCard[]
  onViolet: boolean
  labels?: CustomerCareMessageBodyLabels
  onProductCardPick?: (card: PartnerAiProductCard) => void
  onPreviewImage: (imageUrl: string) => void
  onPreviewVideo: (videoUrl: string) => void
}) {
  if (!cards.length) return null
  const consultLabel = labels?.productCardOpenProduct?.trim()
  const buyLabel = labels?.productCardBuyProduct?.trim()
  const viewDetailsLabel = labels?.productCardViewDetails?.trim() || 'Xem chi tiết'
  const viewVideoLabel = labels?.productCardViewVideo?.trim() || 'Xem video'
  return (
    <div className="-mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]">
      {cards.map((p, idx) => {
        const priceLabel = formatVndPrice(p.price_hint)
        const pickable = typeof onProductCardPick === 'function'
        const productHref =
          typeof p.product_url === 'string' && /^https?:\/\//i.test(p.product_url.trim()) ? p.product_url.trim() : ''
        const urlKey = normalizeProductUrlKey(productHref)
        const showBuy = Boolean(
          buyLabel && urlKey && isProductConsultedInScopeSet(labels?.consultedProductKeys, urlKey)
        )
        const cta = showBuy ? buyLabel : consultLabel
        const ctaAria = cta ? `${p.name}. ${cta}` : p.name
        const detailAria = `${p.name}. ${viewDetailsLabel}`
        const showDetailRow = Boolean(productHref && viewDetailsLabel)
        const rawVideo = (p.product_video_url ?? '').trim()
        const videoUrl = rawVideo && /^https?:\/\//i.test(rawVideo) ? rawVideo : ''
        const ytThumb = videoUrl ? youtubeThumbnailUrl(videoUrl) : null
        return (
          <div
            key={`${idx}-${p.product_url}`}
            className={`${videoUrl ? 'w-[13.25rem]' : 'w-36'} shrink-0 snap-start overflow-hidden rounded-lg border shadow-sm transition-opacity hover:opacity-95 ${
              onViolet ? 'border-white/25 bg-white/10' : 'border-border/60 bg-card'
            }`}
            aria-label={pickable ? undefined : showDetailRow ? detailAria : ctaAria}
          >
            <div className="flex gap-1">
              <div className="min-w-0 flex-1">
                {p.image_url ? (
                  <button
                    type="button"
                    className={`block w-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                      onViolet ? 'focus-visible:ring-offset-violet-700' : ''
                    }`}
                    onClick={(ev) => {
                      ev.stopPropagation()
                      onPreviewImage(p.image_url)
                    }}
                    aria-label={`Xem ảnh lớn: ${p.name}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.image_url}
                      alt=""
                      className={`h-28 w-full object-contain ${onViolet ? 'bg-white/10 opacity-95' : 'bg-muted/30'}`}
                      loading="lazy"
                    />
                  </button>
                ) : (
                  <div className={`h-28 w-full ${onViolet ? 'bg-white/10' : 'bg-muted/30'}`} />
                )}
              </div>
              {videoUrl ? (
                <button
                  type="button"
                  className={`relative h-28 w-[4.25rem] shrink-0 overflow-hidden rounded-md border text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                    onViolet
                      ? 'border-white/25 bg-black/20 focus-visible:ring-offset-violet-700'
                      : 'border-border/60 bg-muted/40 focus-visible:ring-offset-background'
                  }`}
                  onClick={(ev) => {
                    ev.stopPropagation()
                    onPreviewVideo(videoUrl)
                  }}
                  aria-label={`${viewVideoLabel}: ${p.name}`}
                >
                  {ytThumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={ytThumb} alt="" className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <DirectVideoStripThumbnail src={videoUrl} onViolet={onViolet} />
                  )}
                  <span className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <Play className="h-7 w-7 text-white drop-shadow-md" strokeWidth={1.75} aria-hidden />
                  </span>
                </button>
              ) : null}
            </div>
            <div className={`flex flex-col gap-1 px-1.5 py-1.5 text-left ${onViolet ? 'text-white' : ''}`}>
              <p
                className={`w-full min-w-0 truncate text-[11px] tabular-nums leading-none ${onViolet ? 'text-white/85' : 'text-muted-foreground'}`}
                title={priceLabel ?? undefined}
              >
                {priceLabel ?? '\u00a0'}
              </p>
              {showDetailRow ? (
                <a
                  href={productHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex h-7 w-full min-w-0 items-center justify-center rounded-md border px-1 text-[9px] font-semibold leading-none sm:text-[10px] ${
                    onViolet
                      ? 'border-white/35 bg-white/10 text-white hover:bg-white/16'
                      : 'border-border/80 bg-background text-foreground hover:bg-muted/60'
                  }`}
                  onClick={(ev) => ev.stopPropagation()}
                  aria-label={detailAria}
                >
                  <span className="block max-w-full truncate text-center">{viewDetailsLabel}</span>
                </a>
              ) : null}
              {cta && pickable ? (
                <button
                  type="button"
                  className={`flex h-7 w-full min-w-0 items-center justify-center rounded-md px-1 text-[9px] font-semibold leading-none sm:text-[10px] ${
                    onViolet
                      ? 'bg-white/20 text-white hover:bg-white/30'
                      : 'bg-primary/10 text-primary hover:bg-primary/15'
                  }`}
                  onClick={(ev) => {
                    ev.stopPropagation()
                    onProductCardPick?.(p)
                  }}
                  aria-label={ctaAria}
                >
                  <span className="block max-w-full truncate text-center">{cta}</span>
                </button>
              ) : null}
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
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)
  const [videoLightboxSrc, setVideoLightboxSrc] = useState<string | null>(null)

  return (
    <div className={`space-y-2 ${onViolet ? '[&_a]:text-white/90 [&_img]:border-white/25' : ''}`}>
      {url ? (
        <button
          type="button"
          className="block max-w-sm cursor-zoom-in text-left"
          onClick={() => setLightboxSrc(url)}
          aria-label="Xem ảnh lớn"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt=""
            className={`max-h-52 w-full rounded-lg border object-contain ${onViolet ? 'border-white/25 bg-white/10' : 'border-border/60 bg-muted/30'}`}
            loading="lazy"
          />
        </button>
      ) : null}
      {caption ? (
        <div className={`whitespace-pre-wrap break-words ${onViolet ? 'text-white' : ''}`}>{caption}</div>
      ) : null}
      <AiProductCards
        cards={productCards}
        onViolet={onViolet}
        labels={labels}
        onProductCardPick={onProductCardPick}
        onPreviewImage={setLightboxSrc}
        onPreviewVideo={setVideoLightboxSrc}
      />
      {!url && !caption && !productCards.length && row.body ? (
        <div className={`whitespace-pre-wrap break-words ${onViolet ? 'text-white' : ''}`}>{row.body}</div>
      ) : null}
      <MessageImagePreviewDialog src={lightboxSrc} onOpenChange={(open) => !open && setLightboxSrc(null)} />
      <MessageVideoFullscreenDialog
        src={videoLightboxSrc}
        onOpenChange={(open) => !open && setVideoLightboxSrc(null)}
        closeLabel={labels?.productCardCloseVideo?.trim() || 'Đóng video'}
      />
    </div>
  )
}
