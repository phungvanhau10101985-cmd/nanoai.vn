'use client'

import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import { Copy, Loader2, Play } from 'lucide-react'
import type { Json } from '@/types/database.types'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { MessageImagePreviewDialog } from '@/components/messaging/message-image-preview-dialog'
import { MessageVideoFullscreenDialog } from '@/components/messaging/message-video-fullscreen-dialog'
import { normalizeProductUrlKey } from '@/lib/messaging/normalize-product-url-key'
import { isProductConsultedInScopeSet } from '@/lib/messaging/consult-product-scope-key'
import { aiProductCardsFromPayload, type PartnerAiProductCard } from '@/lib/messaging/partner-ai-product-cards'
import { youtubeThumbnailUrl } from '@/lib/messaging/guest-product-video'
import { enrichPaymentDisplayFromQrUrl } from '@/lib/messaging/payment-qr-display-enrich'
import { isSepayStyleOrderPayment } from '@/lib/messaging/sepay-order-ui'
import { sepayQrUrlForDownload } from '@/lib/sepay-qr'
import { MessageTextWithLinks } from '@/components/messaging/message-text-with-links'

/** Gỡ hậu tố «(BIN …)» còn sót từ bản cũ. */
function displayBankName(raw: string): string {
  return raw.replace(/\s*\(BIN\s+\d+\)\s*$/i, '').trim() || raw.trim()
}

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

export type OrderPaymentProofSlot = {
  /** Đơn vừa checkout (gợi ý dưới ô nhập) — không ẩn nút gửi biên lai trên tin cũ. */
  highlightOrderId: string | null
  busyOrderId: string | null
  onPickProof: (orderId: string) => void
  /** Đơn đã đặt cọc / đang đối chiếu (tin SePay, OCR biên lai, …) — ẩn QR trên tin checkout cũ. */
  paidDepositOrderIds?: ReadonlySet<string>
  /** Chỉ tin webhook SePay — dùng cho nội dung gợi ý riêng SePay. */
  sepayWebhookOrderIds?: ReadonlySet<string>
  /** Trang «Đơn hàng của tôi» — `/messaging/my-orders?order=…` (khi không dùng `onViewOrderDetail`). */
  buildOrderDetailHref?: (orderId: string) => string
  /** Ưu tiên: mở chi tiết trong app (vd. modal trong khung nhúng), không cần đăng nhập NanoAI. */
  onViewOrderDetail?: (orderId: string) => void
}

/** Một dòng: nhãn ngắn | giá trị | copy — gọn, ít chiều cao. */
function CompactPaymentField({
  label,
  value,
  copyText,
  monospace,
  onViolet,
}: {
  label: string
  value: ReactNode
  copyText: string
  monospace?: boolean
  onViolet: boolean
}) {
  const { toast } = useToast()
  const copy = async () => {
    const t = copyText.trim()
    if (!t) return
    try {
      await navigator.clipboard.writeText(t)
      toast({ title: 'Đã sao chép' })
    } catch {
      toast({ title: 'Không sao chép được', variant: 'destructive' })
    }
  }
  return (
    <div
      className={`grid grid-cols-[minmax(3.5rem,4.5rem)_minmax(0,1fr)_2rem] items-center gap-x-1.5 border-b py-1 last:border-b-0 sm:grid-cols-[5rem_1fr_2rem] ${
        onViolet ? 'border-white/10 text-white' : 'border-border/50 text-foreground'
      }`}
    >
      <span className={`text-[11px] leading-none sm:text-xs ${onViolet ? 'text-white/70' : 'text-muted-foreground'}`}>
        {label}
      </span>
      <span
        className={`min-w-0 break-words text-sm font-semibold leading-tight sm:text-[15px] ${
          monospace ? 'font-mono tabular-nums' : ''
        }`}
      >
        {value}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={`h-7 w-8 shrink-0 sm:h-8 sm:w-9 ${
          onViolet
            ? 'text-white/90 hover:bg-white/15 hover:text-white'
            : 'text-muted-foreground hover:text-foreground'
        }`}
        onClick={() => void copy()}
        aria-label={`Sao chép ${label}`}
        title="Sao chép"
      >
        <Copy className="h-3.5 w-3.5" aria-hidden />
      </Button>
    </div>
  )
}

/** Tin checkout cũ vẫn `awaiting_payment` — cần `paidInThread` từ tin hệ thống mới hơn. */
function chatOrderDepositResolved(orderStatus: string, paidInThread: boolean): boolean {
  if (paidInThread) return true
  const s = orderStatus.trim()
  if (!s || s === 'awaiting_payment') return false
  return true
}

function depositResolvedMessage(
  orderStatus: string,
  paidInThread: boolean,
  sepayWebhookOnly: boolean,
  shopBrand: string
): string {
  if (!paidInThread) return ''
  const brand = shopBrand.trim() || 'Shop'
  if (sepayWebhookOnly) {
    return `Đơn đã đặt cọc — ${brand} đã nhận xác nhận thanh toán tự động. Quét lại QR trên app ngân hàng có thể báo đã thanh toán; không cần chuyển thêm.`
  }
  switch (orderStatus.trim()) {
    case 'paid_verified':
      return 'Đơn đã đặt cọc — shop đã xác nhận thanh toán.'
    case 'pending_manual_review':
      return 'Đơn đã đặt cọc — shop đang kiểm tra giao dịch.'
    case 'payment_checking':
      return 'Đơn đang được đối chiếu thanh toán.'
    default:
      return 'Đơn đã đặt cọc — cảm ơn bạn! Shop đã nhận hoặc đang đối chiếu chuyển khoản.'
  }
}

/** Tin hệ thống sau checkout: QR + STK (raw_payload từ guest-chat-ordering). */
function OrderPaymentPanel({
  raw,
  onViolet,
  orderPaymentProof,
  shopDisplayName = '',
}: {
  raw: Json | null
  onViolet: boolean
  orderPaymentProof?: OrderPaymentProofSlot | null
  /** Tên thương hiệu shop (không dùng tên nhà cung cấp thanh toán). */
  shopDisplayName?: string
}) {
  if (!raw || typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null
  const o = raw as Record<string, unknown>
  if (o.source !== 'system_order' || o.order_payment_timing !== 'pay_now') return null
  const qrUrl = typeof o.order_payment_qr_url === 'string' ? o.order_payment_qr_url.trim() : ''
  if (!qrUrl || !/^https?:\/\//i.test(qrUrl)) return null

  const ref = typeof o.order_payment_reference === 'string' ? o.order_payment_reference.trim() : ''
  const bankRaw = typeof o.order_bank_name === 'string' ? o.order_bank_name.trim() : ''
  const accRaw = typeof o.order_bank_account === 'string' ? o.order_bank_account.trim() : ''
  const holderRaw = typeof o.order_bank_holder === 'string' ? o.order_bank_holder.trim() : ''
  const enriched = enrichPaymentDisplayFromQrUrl(qrUrl, {
    bank_name: bankRaw,
    account_number: accRaw,
    account_holder: holderRaw,
  })
  const bank = displayBankName(enriched.bank_name)
  const acc = enriched.account_number
  const holder = enriched.account_holder
  const reqRaw = o.order_required_amount
  const amount = typeof reqRaw === 'number' && Number.isFinite(reqRaw) ? Math.max(0, Math.round(reqRaw)) : 0
  const orderId = typeof o.order_id === 'string' ? o.order_id.trim() : ''
  const orderStatus = typeof o.order_status === 'string' ? o.order_status.trim() : ''
  const paidInThread = Boolean(orderId && orderPaymentProof?.paidDepositOrderIds?.has(orderId))
  const sepayWebhookOnly = Boolean(orderId && orderPaymentProof?.sepayWebhookOrderIds?.has(orderId))
  const depositDone = chatOrderDepositResolved(orderStatus, paidInThread)
  const isSepay = isSepayStyleOrderPayment({ payment_qr_url: qrUrl, payment_reference: ref })
  const shopBrand = shopDisplayName.trim() || 'Shop'
  const showProofCta =
    orderPaymentProof &&
    orderId &&
    orderStatus === 'awaiting_payment' &&
    !paidInThread &&
    !isSepay
  const showSepayDownloadCta =
    orderPaymentProof &&
    orderId &&
    orderStatus === 'awaiting_payment' &&
    !paidInThread &&
    isSepay
  const busyThis = showProofCta && orderPaymentProof.busyOrderId === orderId
  const viewInEmbed = Boolean(orderId && orderPaymentProof && typeof orderPaymentProof.onViewOrderDetail === 'function')
  const detailHref =
    !viewInEmbed && orderPaymentProof?.buildOrderDetailHref && orderId
      ? orderPaymentProof.buildOrderDetailHref(orderId)
      : ''
  const showOrderDetailCta = Boolean(
    orderPaymentProof &&
      orderId &&
      orderStatus === 'awaiting_payment' &&
      (viewInEmbed || Boolean(detailHref))
  )
  const showPaymentActionRow = Boolean(showProofCta || showSepayDownloadCta || showOrderDetailCta)

  return (
    <div
      className={`mt-2 max-w-full rounded-lg border p-2.5 sm:p-3 ${
        depositDone
          ? onViolet
            ? 'border-emerald-400/40 bg-emerald-950/35'
            : 'border-emerald-300/70 bg-emerald-50/90 dark:border-emerald-800/60 dark:bg-emerald-950/30'
          : onViolet
            ? 'border-white/25 bg-white/10'
            : 'border-border/60 bg-muted/25'
      }`}
    >
      <p className={`text-sm font-semibold sm:text-base ${onViolet ? 'text-white' : 'text-foreground'}`}>
        {depositDone ? 'Đã đặt cọc' : 'Thanh toán chuyển khoản'}
      </p>
      {depositDone ? (
        <p
          className={`mt-1.5 text-sm leading-snug ${
            onViolet ? 'text-emerald-100' : 'text-emerald-900 dark:text-emerald-100'
          }`}
        >
          {depositResolvedMessage(orderStatus, paidInThread, sepayWebhookOnly, shopBrand)}
        </p>
      ) : null}
      {!depositDone ? (
        <>
      <div
        className={`mt-1.5 space-y-0 overflow-hidden rounded-md border px-1 sm:px-1.5 ${
          onViolet ? 'border-white/15 bg-black/10' : 'border-border/60 bg-background/50'
        }`}
      >
        {bank ? <CompactPaymentField label="Ngân hàng" value={bank} copyText={bank} onViolet={onViolet} /> : null}
        {acc ? (
          <CompactPaymentField label="STK" value={acc} copyText={acc} monospace onViolet={onViolet} />
        ) : null}
        {holder ? (
          <CompactPaymentField label="Chủ TK" value={holder} copyText={holder} onViolet={onViolet} />
        ) : null}
        {amount > 0 ? (
          <CompactPaymentField
            label="Số tiền"
            value={<>{new Intl.NumberFormat('vi-VN').format(amount)}đ</>}
            copyText={String(amount)}
            monospace
            onViolet={onViolet}
          />
        ) : null}
        {ref ? (
          <CompactPaymentField
            label="Nội dung CK"
            value={<span className="font-mono">{ref}</span>}
            copyText={ref}
            monospace
            onViolet={onViolet}
          />
        ) : null}
      </div>
      <p className={`mt-1.5 text-[10px] leading-snug sm:text-[11px] ${onViolet ? 'text-white/75' : 'text-muted-foreground'}`}>
        {isSepay ? (
          <>
            «Nội dung CK» là memo trên app — nhập đúng chuỗi bên trên (hoặc quét QR). {shopBrand} nhận xác nhận tự động —{' '}
            <strong className={onViolet ? 'text-white' : 'text-foreground'}>không cần gửi ảnh biên lai</strong>.
          </>
        ) : (
          <>«Nội dung CK» chính là nội dung chuyển khoản (memo) trên app — nhập đúng chuỗi bên trên. Có thể quét QR để điền sẵn.</>
        )}
      </p>
      <div className="mt-2 flex justify-center px-0.5">
        {/* eslint-disable-next-line @next/next/no-img-element -- URL VietQR ngoài, domain động */}
        <img
          src={qrUrl}
          alt="Mã QR chuyển khoản thanh toán đơn hàng"
          width={280}
          height={280}
          className={`h-auto w-full max-w-[280px] rounded-md border object-contain ${
            onViolet ? 'border-white/30 bg-white' : 'border-border/60 bg-white'
          }`}
          loading="lazy"
        />
      </div>
        </>
      ) : null}
      {depositDone && orderId && orderPaymentProof?.onViewOrderDetail ? (
        <div className="mt-2">
          <Button
            type="button"
            size="sm"
            className={`h-10 w-full text-sm font-medium ${
              onViolet ? 'border-white/35 bg-white/10 text-white hover:bg-white/18' : ''
            }`}
            variant={onViolet ? 'outline' : 'secondary'}
            onClick={() => orderPaymentProof.onViewOrderDetail!(orderId)}
          >
            Xem chi tiết đơn hàng
          </Button>
        </div>
      ) : depositDone && orderId && detailHref ? (
        <div className="mt-2">
          <Button
            type="button"
            size="sm"
            className={`h-10 w-full text-sm font-medium ${
              onViolet ? 'border-white/35 bg-white/10 text-white hover:bg-white/18' : ''
            }`}
            variant={onViolet ? 'outline' : 'secondary'}
            asChild
          >
            <Link
              href={detailHref}
              target="_blank"
              rel="noopener noreferrer"
              title="Mở tab mới để giữ phiên đăng nhập NanoAI"
            >
              Xem chi tiết đơn hàng
            </Link>
          </Button>
        </div>
      ) : null}
      {showPaymentActionRow && orderPaymentProof && !depositDone ? (
        <div className="mt-2 space-y-2">
          <div
            className={`grid gap-1.5 ${
              (showProofCta || showSepayDownloadCta) && showOrderDetailCta ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'
            }`}
          >
            {showSepayDownloadCta ? (
              <Button
                type="button"
                size="sm"
                className={`h-10 w-full text-sm font-medium ${
                  onViolet
                    ? 'border border-white/35 bg-white/15 text-white hover:bg-white/25'
                    : ''
                }`}
                variant={onViolet ? 'outline' : 'default'}
                asChild
              >
                <a
                  href={sepayQrUrlForDownload(qrUrl)}
                  target="_blank"
                  rel="noopener noreferrer"
                  download
                >
                  Tải mã QR đơn hàng
                </a>
              </Button>
            ) : showProofCta ? (
              <Button
                type="button"
                size="sm"
                className={`h-10 w-full gap-1.5 text-sm font-medium ${
                  onViolet
                    ? 'border border-white/35 bg-white/15 text-white hover:bg-white/25'
                    : ''
                }`}
                variant={onViolet ? 'outline' : 'default'}
                disabled={Boolean(orderPaymentProof.busyOrderId)}
                onClick={() => orderPaymentProof.onPickProof(orderId)}
              >
                {busyThis ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
                    Đang tải ảnh và đối chiếu…
                  </>
                ) : (
                  <>Gửi ảnh giao dịch{ref ? ` · ${ref}` : ''}</>
                )}
              </Button>
            ) : null}
            {showOrderDetailCta && viewInEmbed && orderPaymentProof?.onViewOrderDetail ? (
              <Button
                type="button"
                size="sm"
                className={`h-10 w-full text-sm font-medium ${
                  onViolet ? 'border-white/35 bg-white/10 text-white hover:bg-white/18' : ''
                }`}
                variant={onViolet ? 'outline' : 'secondary'}
                onClick={() => orderPaymentProof.onViewOrderDetail!(orderId)}
              >
                Xem chi tiết đơn hàng
              </Button>
            ) : showOrderDetailCta && detailHref ? (
              <Button
                type="button"
                size="sm"
                className={`h-10 w-full text-sm font-medium ${
                  onViolet ? 'border-white/35 bg-white/10 text-white hover:bg-white/18' : ''
                }`}
                variant={onViolet ? 'outline' : 'secondary'}
                asChild
              >
                <Link
                  href={detailHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Mở tab mới để giữ phiên đăng nhập NanoAI"
                >
                  Xem chi tiết đơn hàng
                </Link>
              </Button>
            ) : null}
          </div>
          {showProofCta ? (
            <p className={`text-center text-xs leading-snug sm:text-[13px] ${onViolet ? 'text-white/75' : 'text-muted-foreground'}`}>
              Chỉ dùng nút gửi ảnh cho biên lai đúng mã đơn; không gửi qua ô đính ảnh chat.
            </p>
          ) : showSepayDownloadCta ? (
            <p className={`text-center text-[10px] leading-snug sm:text-[11px] ${onViolet ? 'text-white/75' : 'text-muted-foreground'}`}>
              Tải ảnh QR về máy khi cần — chuyển khoản đúng «Nội dung CK»; {shopBrand} nhận xác nhận tự động.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
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
  orderPaymentProof,
  shopDisplayName = '',
}: {
  row: Row
  tone?: CustomerCareMessageBodyTone
  labels?: CustomerCareMessageBodyLabels
  onProductCardPick?: (card: PartnerAiProductCard) => void
  /** Trang guest: nút gửi biên lai gắn với đơn trong khối QR. */
  orderPaymentProof?: OrderPaymentProofSlot | null
  /** Tên hiển thị của shop (widget khách). */
  shopDisplayName?: string
}) {
  const url = imageUrlFromPayload(row.raw_payload)
  const caption = row.body.replace(/^📷\s*/u, '').trim()
  const onViolet = tone === 'onViolet'
  const productCards = aiProductCardsFromPayload(row.raw_payload)
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)
  const [videoLightboxSrc, setVideoLightboxSrc] = useState<string | null>(null)

  return (
    <div
      className={`min-w-0 max-w-full space-y-2 break-words [overflow-wrap:anywhere] ${onViolet ? '[&_a]:text-white/90 [&_img]:border-white/25' : ''}`}
    >
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
        <MessageTextWithLinks
          text={caption}
          className={`whitespace-pre-wrap break-words ${onViolet ? 'text-white' : ''}`}
          linkClassName={
            onViolet
              ? 'break-all text-white/90 underline underline-offset-2 hover:text-white'
              : 'break-all text-primary underline underline-offset-2 hover:text-primary/90'
          }
        />
      ) : null}
      <OrderPaymentPanel
        raw={row.raw_payload}
        onViolet={onViolet}
        orderPaymentProof={orderPaymentProof}
        shopDisplayName={shopDisplayName}
      />
      <AiProductCards
        cards={productCards}
        onViolet={onViolet}
        labels={labels}
        onProductCardPick={onProductCardPick}
        onPreviewImage={setLightboxSrc}
        onPreviewVideo={setVideoLightboxSrc}
      />
      {!url && !caption && !productCards.length && row.body ? (
        <MessageTextWithLinks
          text={row.body}
          className={`whitespace-pre-wrap break-words ${onViolet ? 'text-white' : ''}`}
          linkClassName={
            onViolet
              ? 'break-all text-white/90 underline underline-offset-2 hover:text-white'
              : 'break-all text-primary underline underline-offset-2 hover:text-primary/90'
          }
        />
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
