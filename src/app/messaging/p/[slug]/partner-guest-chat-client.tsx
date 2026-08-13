'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from 'react'
import { createPortal } from 'react-dom'
import type { ChangeEvent, ClipboardEvent, RefObject } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  CustomerCareMessageBody,
  type OrderPaymentProofSlot,
} from '@/components/messaging/customer-care-message-body'
import type { MetaViewContentClientPayload } from '@/lib/tracking/meta-view-content'
import { fireMetaBuyNowPixelEvents } from './meta-buy-now-pixel-fire'
import { fireMetaConsultViewContentPixelEvent } from './meta-view-content-consult-click-pixel-fire'
import { fireMetaPurchasePixelEvents } from './meta-purchase-pixel-fire'
import { MetaPixelViewContentTracker } from './meta-pixel-view-content-tracker'
import {
  guestCardToTrackingProduct,
  trackPartnerSiteAddToCart,
  trackPartnerSiteBeginCheckout,
  trackPartnerSitePurchase,
  trackPartnerSiteViewItem,
  trackingProductFromGa4Input,
  trackingProductFromMetaViewContent,
} from '@/lib/partner-website/shop/partner-site-shop-tracking'
import type { PartnerSiteShopTrackingConfig } from '@/lib/partner-website/shop/partner-site-shop-tracking-types'
import type { ShopGa4ProductInput } from './shop-ga4-ecommerce'
import { GuestWidgetOrderDetailDialog } from '@/components/messaging/guest-widget-order-detail-dialog'
import { GuestWidgetMyOrdersDialog } from '@/components/messaging/guest-widget-my-orders-dialog'
import {
  isOpenMyOrdersMessage,
  isWidgetTryOnPanelMessage,
  NANOAI_WIDGET_MSG_SOURCE,
} from '@/lib/messaging/widget-parent-bridge'
import { MessageImagePreviewDialog } from '@/components/messaging/message-image-preview-dialog'
import { collectGuestOrderDepositConfirmationSplit } from '@/lib/messaging/order-sepay-message-helpers'
import { normalizeProductUrlKey } from '@/lib/messaging/normalize-product-url-key'
import { findPaletteColorByImageUrl } from '@/lib/messaging/palette-color-match'
import { useToast } from '@/hooks/use-toast'
import {
  useVisualViewportBottomInset,
  useVisualViewportShellHeightPx,
} from '@/hooks/use-visual-viewport-bottom-inset'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import { CREATION_SIDEBAR_POPULAR_LINKS } from '@/lib/creation-tool-sidebar-config'
import {
  LOCALE_COOKIE_NAME,
  LOCALE_COOKIE_NAME_LEGACY,
  WEB_LOCALES,
  type WebLocale,
} from '@/lib/i18n/config'
import type { Json } from '@/types/database.types'
import {
  Camera,
  ArrowLeft,
  LayoutGrid,
  ShoppingCart,
  CheckCircle,
  ChevronDown,
  ImagePlus,
  Image as LucideImage,
  Loader2,
  Search,
  MessageSquareText,
  Package,
  Send,
  Sparkles,
  Store,
  X,
} from 'lucide-react'
import { aiProductCardsFromPayload } from '@/lib/messaging/partner-ai-product-cards'
import type { PartnerAiProductCard } from '@/lib/messaging/partner-ai-product-cards'
import { isLikelyVideoOrStreamUrl } from '@/lib/messaging/is-likely-video-url'
import { buildSePayQrImgUrl } from '@/lib/sepay-qr'
import { openGuestProductDetailUrl } from '@/lib/messaging/open-guest-product-url'
import { isSepayStyleOrderPayment } from '@/lib/messaging/sepay-order-ui'
import { CREDIT_UNIT_PRICE_VND } from '@/lib/credit-unit-price'
import { fireMetaStandardEvent } from '@/lib/tracking/meta-standard-events-client'
import { buildNanoAiCreditMetaCustomData } from '@/lib/catalog/nanoai-facebook-catalog'
import {
  MESSAGING_GUEST_SESSION_STORAGE_KEY,
  MESSAGING_GUEST_SESSION_STORAGE_KEY_LEGACY,
  MESSAGING_GUEST_SESSION_SYNC_COOKIE,
} from '@/lib/messaging/guest-auth-session'
import {
  MESSAGING_GUEST_ACCOUNT_STORAGE_KEY,
  MESSAGING_GUEST_ACCOUNT_STORAGE_KEY_LEGACY,
  MESSAGING_GUEST_ACCOUNT_SYNC_COOKIE,
} from '@/lib/messaging/guest-account-session'
import { getStableEmailTrustedBrowserId } from '@/lib/auth/email-trusted-browser-client'
import {
  readGuestAuthRememberDevicePreference,
  writeGuestAuthRememberDevicePreference,
} from '@/lib/auth/guest-auth-remember-device-client'
import {
  guestPurchaseInputFromProductCard,
  guestPurchaseOpensExternalUrl,
  resolveGuestPurchaseButtonUrl,
  type GuestPurchaseFlow,
} from '@/lib/messaging/guest-purchase-flow'
import { inboundTextLooksLikePurchasePickListIntent } from '@/lib/messaging/partner-ai-purchase-intent'
import { resolveExternalImageDisplayUrl } from '@/lib/fetch-image-1688'
import { PARTNER_SITE_CUSTOMER_TOKEN_QUERY_KEY } from '@/lib/messaging/partner-site-customer-auth-constants'

const INVENTORY_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function msgImgSrc(url: string): string {
  return resolveExternalImageDisplayUrl(url)
}

/** Khoảng cách tới đáy (px) để coi như user đang xem cuối thread — cho phép auto-scroll theo tin/typing mới. */
const GUEST_CHAT_STICK_TO_BOTTOM_PX = 120
const EMBED_GUEST_SESSION_QUERY_KEY = 'guest_session_id'
const EMBED_GUEST_ACCOUNT_QUERY_KEY = 'guest_account_id'
const UUID_STRING_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * `open_try_on` chỉ có trên URL lần đầu; effect strip query → React Strict Mode (dev) remount
 * mất param. Cache theo `slug` chỉ cho phiên thử đồ — không áp dụng khi `ctx_gateway=consult`.
 */
let guestChatTryOnUrlFlagCache: { slug: string; value: boolean } | null = null

function readGuestEmbedGatewayFromUrl(): string {
  if (typeof window === 'undefined') return ''
  return (new URLSearchParams(window.location.search).get('ctx_gateway') || '').trim().toLowerCase()
}

function readOpenTryOnFlagFromUrl(): boolean {
  if (typeof window === 'undefined') return false
  const f = (new URLSearchParams(window.location.search).get('open_try_on') || '').trim().toLowerCase()
  return f === '1' || f === 'true' || f === 'yes'
}

function setGuestTryOnUrlFlagCache(slug: string, value: boolean) {
  guestChatTryOnUrlFlagCache = { slug, value }
}

function initialTryOnOpenFromGuestUrl(slug: string): boolean {
  if (typeof window === 'undefined') return false
  const q = new URLSearchParams(window.location.search)
  const gateway = (q.get('ctx_gateway') || '').trim().toLowerCase()
  if (gateway === 'consult') {
    setGuestTryOnUrlFlagCache(slug, false)
    return false
  }
  const fromUrl = readOpenTryOnFlagFromUrl() || gateway === 'try_on'
  if (fromUrl) {
    setGuestTryOnUrlFlagCache(slug, true)
    return true
  }
  /** Cổng tư vấn / FAB: có ctx SP nhưng không phải try_on — không khôi phục panel từ cache phiên trước. */
  const hasWidgetCtx =
    Boolean(q.get('ctx_sku')?.trim()) ||
    Boolean(q.get('ctx_image')?.trim()) ||
    Boolean(q.get('ctx_image_2')?.trim()) ||
    Boolean(q.get('ctx_inventory')?.trim())
  if (hasWidgetCtx && gateway !== 'try_on') {
    setGuestTryOnUrlFlagCache(slug, false)
    return false
  }
  if (guestChatTryOnUrlFlagCache?.slug === slug && guestChatTryOnUrlFlagCache.value) {
    return true
  }
  setGuestTryOnUrlFlagCache(slug, false)
  return false
}

/** Ghép ngày sinh từ ba dropdown — trả ISO `YYYY-MM-DD` hoặc null. */
function buildIsoDateFromBirthParts(day: string, month: string, year: string): string | null {
  const d = Number.parseInt(day, 10)
  const m = Number.parseInt(month, 10)
  const y = Number.parseInt(year, 10)
  if (!Number.isFinite(d) || !Number.isFinite(m) || !Number.isFinite(y)) return null
  if (y < 1900 || y > 2100) return null
  const dt = new Date(y, m - 1, d)
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null
  const today = new Date()
  const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  if (dt > endOfToday) return null
  return `${y.toString().padStart(4, '0')}-${m.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`
}

/** Select (Radix) portal ra ngoài `DialogContent` — cần nhận diện để không chặn click / đóng dialog nhầm. */
function isRadixSelectOutsideDialog(node: EventTarget | null): boolean {
  if (!(node instanceof Element)) return false
  return Boolean(
    node.closest('[data-radix-select-viewport]') ||
      node.closest('[role="listbox"]') ||
      node.closest('[role="option"]')
  )
}

function readDocumentCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const prefixed = `; ${document.cookie}`
  const key = `; ${name}=`
  const idx = prefixed.indexOf(key)
  if (idx === -1) return null
  const start = idx + key.length
  const end = prefixed.indexOf(';', start)
  const raw = (end === -1 ? prefixed.slice(start) : prefixed.slice(start, end)).trim()
  return raw ? decodeURIComponent(raw) : null
}

type GuestChatKeyboardUaProfile = {
  isFacebookInApp: boolean
  isZaloInApp: boolean
  isLikelyProblematicInApp: boolean
  minFocusLiftPx: number
  maxFocusLiftPx: number
  focusLiftRatio: number
  screenOverlapWeight: number
  fallbackTriggerPx: number
  transformCapVh: number
}

function isFacebookInAppRuntime(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = (navigator.userAgent || '').toLowerCase()
  if (/fban|fbav|fb_iab|fb4a|fbios|messenger/.test(ua)) return true
  if (typeof document !== 'undefined') {
    const ref = (document.referrer || '').toLowerCase()
    if (/(^|:\/\/|\.)(facebook|messenger)\.com/.test(ref)) return true
    if (/lm\.facebook\.com|l\.facebook\.com/.test(ref)) return true
  }
  return false
}

/** Nhận diện UA để tinh chỉnh mức đẩy composer trên mobile/in-app WebView. */
function detectGuestChatKeyboardUaProfile(): GuestChatKeyboardUaProfile {
  if (typeof navigator === 'undefined') {
    return {
      isFacebookInApp: false,
      isZaloInApp: false,
      isLikelyProblematicInApp: false,
      minFocusLiftPx: 0,
      maxFocusLiftPx: 0,
      focusLiftRatio: 0,
      screenOverlapWeight: 1,
      fallbackTriggerPx: 0,
      transformCapVh: 55,
    }
  }
  const ua = (navigator.userAgent || '').toLowerCase()
  const isFacebookInApp = isFacebookInAppRuntime()
  const isZaloInApp = /\bzalo\b/.test(ua)
  const isLikelyProblematicInApp =
    isFacebookInApp || (!isZaloInApp && (/; wv\)/.test(ua) || /\bversion\/\d+\.\d+/.test(ua)))
  if (isFacebookInApp) {
    return {
      isFacebookInApp: true,
      isZaloInApp,
      isLikelyProblematicInApp,
      minFocusLiftPx: 360,
      maxFocusLiftPx: 700,
      focusLiftRatio: 0.62,
      screenOverlapWeight: 1.28,
      fallbackTriggerPx: 72,
      transformCapVh: 72,
    }
  }
  return {
    isFacebookInApp: false,
    isZaloInApp,
    isLikelyProblematicInApp,
    minFocusLiftPx: 0,
    maxFocusLiftPx: 0,
    focusLiftRatio: 0,
    screenOverlapWeight: 1,
    fallbackTriggerPx: 0,
    transformCapVh: 56,
  }
}

type GuestMsg = {
  id: string
  direction: 'inbound' | 'outbound'
  body: string
  created_at: string
  raw_payload?: Json | null
  /** URL trang khi gửi tin (widget) — nguồn traffic / export feed. */
  landing_source_url?: string | null
}

/** Baseline để tắt «shop đang soạn tin»: so `(created_at, id)` — tránh kẹt khi cửa sổ fetch trượt mà đếm outbound trong batch không đổi. */
type GuestShopOutboundCursor = { at: number; id: string }

function latestOutboundCursor(msgs: GuestMsg[]): GuestShopOutboundCursor | null {
  let best: GuestMsg | null = null
  for (const m of msgs) {
    if (m.direction !== 'outbound') continue
    if (!best) {
      best = m
      continue
    }
    const ta = Date.parse(m.created_at)
    const tb = Date.parse(best.created_at)
    if (!Number.isFinite(ta)) continue
    if (!Number.isFinite(tb)) {
      best = m
      continue
    }
    if (ta > tb || (ta === tb && m.id > best.id)) best = m
  }
  if (!best) return null
  const at = Date.parse(best.created_at)
  if (!Number.isFinite(at)) return null
  return { at, id: best.id }
}

function readUuidQueryParam(params: URLSearchParams, key: string): string {
  const value = (params.get(key) || '').trim()
  return UUID_STRING_RE.test(value) ? value : ''
}

/** Có tin outbound **mới hơn** baseline (lúc bật chờ shop trả lời). */
function hasNewOutboundSinceTypingBaseline(
  latest: GuestShopOutboundCursor | null,
  baseline: GuestShopOutboundCursor | null
): boolean {
  if (!latest) return false
  if (!baseline) return true
  if (latest.at > baseline.at) return true
  if (latest.at < baseline.at) return false
  return latest.id > baseline.id
}

type GuestVisionCandidate = {
  inventoryId: string
  name: string
  sku: string | null
  image_url: string
  product_url?: string
  price_hint?: string
  score?: number
}

type BuyProductOption = {
  name: string
  image_url: string
  product_url: string
  price_hint?: string
  sku?: string | null
  /** UUID kho — Meta ViewContent + AddToCart khi chọn «mua luôn». */
  inventory_id?: string
}

type PurchaseOptionsPayload = {
  sku: string | null
  name: string
  image_url: string
  product_url: string
  price_hint: string
  sizes: string[]
  colors: Array<{ name: string; img: string }>
  deposit_policy?: {
    mode?: 'none' | 'percent' | 'fixed_amount'
    percent?: number
    fixed_amount?: number
  }
}

type GuestCartItem = {
  id: string
  card: PartnerAiProductCard
  quantity: number
  color: string
  size: string
  note: string
  variantLineImages?: string[]
}

type GuestOrderGa4Snapshot = {
  id?: string
  product_inventory_id?: string | null
  product_name?: string | null
  product_url?: string | null
  unit_price?: number | null
  quantity?: number | null
  subtotal_amount?: number | null
  amount_after_discount?: number | null
  required_amount?: number | null
}

type CurrentOrderPickedLine = {
  color: string
  size: string
  quantity: number
  variantLineImages?: string[]
}

function collectRecentSuggestedCardsFromMessages(
  messages: GuestMsg[],
  limit = 60,
  anchorInboundId?: string
): PartnerAiProductCard[] {
  const out: PartnerAiProductCard[] = []
  const seen = new Set<string>()
  const pushCard = (card: PartnerAiProductCard) => {
    const productUrl = card.product_url.trim()
    const imageUrl = card.image_url.trim()
    if (!/^https?:\/\//i.test(productUrl) || !/^https?:\/\//i.test(imageUrl)) return false
    const key = productUrl.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    out.push(card)
    return out.length >= limit
  }
  const anchorIdx =
    anchorInboundId
      ? messages.findIndex((m) => m.id === anchorInboundId && m.direction === 'inbound')
      : -1
  const startIdx = anchorIdx >= 0 ? anchorIdx - 1 : messages.length - 1
  const minIdx = Math.max(0, startIdx - 24)
  for (let i = startIdx; i >= minIdx; i -= 1) {
    const msg = messages[i]
    const raw = msg.raw_payload ?? null
    if (msg.direction === 'outbound') {
      const cards = aiProductCardsFromPayload(raw)
      for (const c of cards) {
        if (pushCard(c)) return out
      }
    }
    // Include image-search suggestions (vision candidates) from inbound turns too.
    const vision = getVisionPickState(raw)
    if (vision.candidates.length > 0) {
      for (const c of vision.candidates) {
        const productUrl = typeof c.product_url === 'string' ? c.product_url.trim() : ''
        if (!productUrl) continue
        const card: PartnerAiProductCard = {
          name: c.name || 'San pham',
          image_url: c.image_url || '',
          product_url: productUrl,
          ...(c.price_hint ? { price_hint: c.price_hint } : {}),
          ...(c.sku && c.sku.trim() ? { sku: c.sku.trim().slice(0, 128) } : {}),
        }
        if (pushCard(card)) return out
      }
    }
  }
  return out
}

type RecentProductWithSource = { card: PartnerAiProductCard; sourceMessageId: string }

const PRODUCT_SHELF_MAX = 500
/** Số ô render ban đầu + mỗi lần cuộn tới sentinel (tránh treo DOM khi danh sách dài). */
const PRODUCT_SHELF_LAZY_INITIAL = 36
const PRODUCT_SHELF_LAZY_STEP = 36
/** Sheet portal: thử gắn IntersectionObserver sau khi ref sẵn sàng. */
const PRODUCT_SHELF_IO_ATTACH_MAX_FRAMES = 48

function shuffleInPlace<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const a = arr[i]!
    arr[i] = arr[j]!
    arr[j] = a
  }
}

/**
 * Mọi SP khách đã thấy trong hội thoại (thẻ AI + gợi ý ảnh), mỗi URL một dòng — gắn tin nguồn **mới nhất**.
 */
function collectAllSuggestedProductsWithSource(messages: GuestMsg[]): RecentProductWithSource[] {
  const byUrl = new Map<string, RecentProductWithSource>()
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]
    const raw = msg.raw_payload ?? null
    if (msg.direction === 'outbound') {
      const cards = aiProductCardsFromPayload(raw)
      for (const c of cards) {
        const productUrl = c.product_url.trim()
        const imageUrl = c.image_url.trim()
        if (!/^https?:\/\//i.test(productUrl) || !/^https?:\/\//i.test(imageUrl)) continue
        const key = productUrl.toLowerCase()
        if (!byUrl.has(key)) {
          byUrl.set(key, { card: c, sourceMessageId: msg.id })
        }
      }
    }
    const vision = getVisionPickState(raw)
    for (const c of vision.candidates) {
      const productUrl = typeof c.product_url === 'string' ? c.product_url.trim() : ''
      if (!productUrl) continue
      const imageUrl = (c.image_url ?? '').trim()
      if (!/^https?:\/\//i.test(imageUrl)) continue
      const key = productUrl.toLowerCase()
      if (!byUrl.has(key)) {
        const card: PartnerAiProductCard = {
          name: c.name || 'San pham',
          image_url: imageUrl,
          product_url: productUrl,
          ...(c.price_hint ? { price_hint: c.price_hint } : {}),
          ...(c.sku && c.sku.trim() ? { sku: c.sku.trim().slice(0, 128) } : {}),
        }
        byUrl.set(key, { card, sourceMessageId: msg.id })
      }
    }
  }
  const list = Array.from(byUrl.values())
  return list.length > PRODUCT_SHELF_MAX ? list.slice(0, PRODUCT_SHELF_MAX) : list
}

/** Tin hệ thống đơn hàng (tóm tắt / thanh toán) — hiển thị bubble khác tin chat thường. */
function isSystemOrderMessage(raw: Json | null | undefined): boolean {
  const o = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null
  return o?.source === 'system_order'
}

/** Chỉ báo đang chờ tin shop — một dòng ở cuối luồng, ẩn khi đã có tin mới (không xen vào lịch sử giữa các bubble). */
function GuestShopTypingPill({ label }: { label: string }) {
  return (
    <div
      className="mr-auto flex max-w-[92%] items-center gap-2 rounded-2xl rounded-bl-md border border-border/60 bg-card px-3.5 py-2.5 text-[17px] text-muted-foreground shadow-sm sm:text-lg"
      role="status"
      aria-live="polite"
    >
      <span className="tabular-nums">{label}</span>
      <span className="inline-flex gap-0.5" aria-hidden>
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/70 [animation-delay:0ms]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/70 [animation-delay:150ms]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/70 [animation-delay:300ms]" />
      </span>
    </div>
  )
}

/** Ngữ cảnh SP từ query `?ctx_sku=&ctx_image=&ctx_image_2=&ctx_product_url=&ctx_inventory=` — gửi kèm tin đầu / tự động tư vấn. */
type WidgetPageContextSeed = {
  sku?: string
  imageUrl?: string
  /** Ảnh thứ 2 trong gallery (embed/widget). */
  imageUrl2?: string
  productUrl?: string
  inventoryId?: string
  /** Chỉ khi bấm «Tư vấn» trên thẻ SP trong chat — gửi kèm productUrl cho cache. */
  source?: string
}

function hasWidgetPageContextSeed(pc: WidgetPageContextSeed | null | undefined): boolean {
  if (!pc) return false
  /** Chip / ngữ cảnh SP: cần sku, ảnh hoặc UUID kho — không chỉ URL trang (trang không phải chi tiết SP). */
  return Boolean(
    (pc.sku && pc.sku.trim()) ||
      (pc.imageUrl && pc.imageUrl.trim()) ||
      (pc.imageUrl2 && pc.imageUrl2.trim()) ||
      (pc.inventoryId && pc.inventoryId.trim())
  )
}

/** Trang shop đôi khi gửi URL .mp4 trong ctx_image (ô video lấy nhầm data-src) — chỉ giữ URL ảnh hợp lệ. */
function sanitizeWidgetPageContextSeed(raw: WidgetPageContextSeed): WidgetPageContextSeed {
  const sku = raw.sku?.trim() ? raw.sku.trim().slice(0, 128) : undefined
  let imageUrl = (raw.imageUrl ?? '').trim()
  let imageUrl2 = (raw.imageUrl2 ?? '').trim()
  if (imageUrl && isLikelyVideoOrStreamUrl(imageUrl)) imageUrl = ''
  if (imageUrl2 && isLikelyVideoOrStreamUrl(imageUrl2)) imageUrl2 = ''
  if (!imageUrl && imageUrl2) {
    imageUrl = imageUrl2
    imageUrl2 = ''
  }
  const productUrl = (raw.productUrl ?? '').trim() || undefined
  const inventoryId = (raw.inventoryId ?? '').trim() || undefined
  const source = raw.source
  const out: WidgetPageContextSeed = {}
  if (sku) out.sku = sku
  if (imageUrl) out.imageUrl = imageUrl
  if (imageUrl2) out.imageUrl2 = imageUrl2
  if (productUrl) out.productUrl = productUrl
  if (inventoryId) out.inventoryId = inventoryId
  if (source) out.source = source
  return out
}

/** Tin chữ kèm ngữ cảnh SP từ link `?ctx_*=` / tu-van — cùng giọng với «Tư vấn» trên thẻ; không lộ UUID kho trong bubble. */
function buildWidgetPageContextInboundText(
  pc: WidgetPageContextSeed,
  t: Dictionary['partnerGuestChat']
): string {
  const sku = pc.sku?.trim()
  if (sku) {
    return t.productConsultAskDetailFromSku.replace('{sku}', sku)
  }
  if (pc.inventoryId?.trim()) {
    return t.pageContextInboundConsultNoSku
  }
  if (pc.imageUrl?.trim()) {
    return t.pageContextInboundImageOnlyNote
  }
  return ''
}

function getVisionPickState(raw: Json | null | undefined): {
  required: boolean
  candidates: GuestVisionCandidate[]
  selectedInventoryId: string | null
} {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : null
  if (!o || !Array.isArray(o.vision_candidates)) {
    return { required: false, candidates: [], selectedInventoryId: null }
  }
  const out: GuestVisionCandidate[] = []
  for (const x of o.vision_candidates) {
    if (!x || typeof x !== 'object') continue
    const r = x as Record<string, unknown>
    const inventoryId = typeof r.inventoryId === 'string' ? r.inventoryId : ''
    const name = typeof r.name === 'string' ? r.name : ''
    if (!inventoryId || !name) continue
    const pu = typeof r.product_url === 'string' ? r.product_url.trim() : ''
    out.push({
      inventoryId,
      name,
      sku: typeof r.sku === 'string' ? r.sku : null,
      image_url: typeof r.image_url === 'string' ? r.image_url : '',
      ...(pu && /^https?:\/\//i.test(pu) ? { product_url: pu } : {}),
      ...(typeof r.price_hint === 'string' && r.price_hint.trim() ? { price_hint: r.price_hint.trim() } : {}),
      score: typeof r.score === 'number' ? r.score : undefined,
    })
  }
  const selectedInventoryId =
    typeof o.vision_selected_inventory_id === 'string' && o.vision_selected_inventory_id.trim()
      ? o.vision_selected_inventory_id.trim()
      : null
  return { required: o.vision_pick_required === true, candidates: out, selectedInventoryId }
}

/**
 * Tin khách kèm ngữ cảnh trang/thẻ tư vấn — carousel `vision_candidates` nằm cùng bubble kiểu shop (trái), không dùng bubble tím kèm thẻ.
 * `widget_page`: `/tu-van`, `?ctx_*`; `product_card_consult`: bấm «Tư vấn» trên thẻ SP.
 */
function isConsultPageContextInbound(raw: Json | null | undefined): boolean {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : null
  if (!o) return false
  const pc = o.page_context
  if (!pc || typeof pc !== 'object') return false
  const src = String((pc as Record<string, unknown>).source ?? '').trim()
  return src === 'widget_page' || src === 'product_card_consult'
}

function isGuestVisionPickReminderPayload(raw: Json | null | undefined): boolean {
  const o = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null
  const s = typeof o?.source === 'string' ? o.source.trim() : ''
  return s === 'guest_vision_pick_reminder' || s === 'guest_vision_pick_purchase_intent_reminder'
}

/** Tin tự động hiển thị trong chat khi khách đủ điều kiện ưu đãi sinh nhật (không lưu server). */
function isBirthdayPromoGreetingPayload(raw: Json | null | undefined): boolean {
  const o = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null
  return o?.source === 'birthday_promo_greeting'
}

function isGuestWidgetAutoOpeningMessage(raw: Json | null | undefined): boolean {
  const o = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null
  return o?.widget_auto_opening === true
}

/** Một số tin hệ thống do shop phát ra nhưng có thể đi qua luồng inbound: luôn render phía shop (trái). */
function isForcedShopSideMessage(raw: Json | null | undefined): boolean {
  if (isGuestVisionPickReminderPayload(raw)) return true
  return isGuestWidgetAutoOpeningMessage(raw)
}

function buyPromptDismissStorageKey(slug: string, messageId: string): string {
  return `nanoai_buy_prompt_dismiss_v1:${encodeURIComponent(slug)}:${messageId}`
}

function isBuyPromptDismissed(slug: string, messageId: string): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.sessionStorage.getItem(buyPromptDismissStorageKey(slug, messageId)) === '1'
  } catch {
    return false
  }
}

function rememberBuyPromptHandled(slug: string, messageId: string) {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(buyPromptDismissStorageKey(slug, messageId), '1')
  } catch {
    /* ignore */
  }
}

function visionReminderTriggerMessageId(raw: Json | null | undefined): string | null {
  const o = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null
  if (!o || !isGuestVisionPickReminderPayload(raw)) return null
  const v = typeof o.trigger_message_id === 'string' ? o.trigger_message_id.trim() : ''
  return v || null
}

/** Xóa query ngữ cảnh SP khỏi URL sau khi đã gửi (tránh lần sau vào lại tự gắn). */
function stripWidgetPageContextParamsFromBrowserUrl() {
  if (typeof window === 'undefined') return
  try {
    const u = new URL(window.location.href)
    const keys = [
      'ctx_sku',
      'ctx_image',
      'ctx_image_2',
      'ctx_product_url',
      'ctx_inventory',
      'open_try_on',
      'auto_consult',
      'interested_inv',
      'bday_discount',
    ]
    let changed = false
    for (const k of keys) {
      if (u.searchParams.has(k)) {
        u.searchParams.delete(k)
        changed = true
      }
    }
    if (changed) window.history.replaceState({}, '', `${u.pathname}${u.search}${u.hash}`)
  } catch {
    /* ignore */
  }
}

/**
 * SP từ URL đã xuất hiện trong thread gần đây (thẻ shop / gợi ý ảnh / tin khách) — không cần chip gửi lại.
 */
function isPageContextRedundantWithRecentThread(
  pc: WidgetPageContextSeed,
  messages: GuestMsg[],
  maxScan = 80
): boolean {
  const sku = pc.sku?.trim().toLowerCase() ?? ''
  const inv = pc.inventoryId?.trim().toLowerCase() ?? ''
  const puKey = normalizeProductUrlKey(pc.productUrl ?? '')
  const start = Math.max(0, messages.length - maxScan)
  for (let i = messages.length - 1; i >= start; i--) {
    const m = messages[i]!
    const raw = m.raw_payload ?? null
    if (m.direction === 'inbound') {
      const body = (m.body ?? '').toLowerCase()
      if (sku && (body.includes(`mã sản phẩm: ${sku}`) || body.includes(`sku: ${sku}`))) return true
      const vision = getVisionPickState(raw)
      for (const c of vision.candidates) {
        if (inv && c.inventoryId.toLowerCase() === inv) return true
        if (sku && (c.sku ?? '').trim().toLowerCase() === sku) return true
        const cPu = normalizeProductUrlKey(c.product_url ?? '')
        if (puKey && cPu && cPu === puKey) return true
      }
    } else {
      for (const c of aiProductCardsFromPayload(raw)) {
        if (inv && (c.inventory_id ?? '').trim().toLowerCase() === inv) return true
        if (sku && (c.sku ?? '').trim().toLowerCase() === sku) return true
        if (puKey && normalizeProductUrlKey(c.product_url) === puKey) return true
      }
    }
  }
  return false
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

function parseVndFromHint(priceHint: string | undefined): number {
  const raw = (priceHint ?? '').trim()
  if (!raw) return 0
  const digits = raw.replace(/[^\d]/g, '')
  if (!digits) return 0
  const n = Number.parseInt(digits, 10)
  return Number.isFinite(n) ? Math.max(0, n) : 0
}

function trackGuestPurchaseFromOrderSnapshot(
  adsTracking: PartnerSiteShopTrackingConfig,
  order: GuestOrderGa4Snapshot | null | undefined,
  options?: { skipMeta?: boolean }
): void {
  const orderId = String(order?.id ?? '').trim()
  if (!orderId) return
  const qty = Math.max(1, Math.floor(Number(order?.quantity) || 1))
  const value = Math.max(
    0,
    Math.round(Number(order?.amount_after_discount ?? order?.subtotal_amount ?? order?.required_amount) || 0)
  )
  trackPartnerSitePurchase(
    adsTracking,
    {
      transactionId: orderId,
      value,
      lines: [
        {
          itemId: order?.product_inventory_id || order?.product_url || orderId,
          itemName: order?.product_name || order?.product_inventory_id || orderId,
          value: Math.max(0, Math.round(Number(order?.unit_price) || 0)),
          quantity: qty,
        },
      ],
    },
    options
  )
}

function discountVndNumberForBirthday(amount: number, pct: number | null): number {
  if (pct == null || pct <= 0 || amount <= 0) return amount
  const p = Math.max(0, Math.min(100, Math.floor(pct)))
  return Math.max(0, Math.round((amount * (100 - p)) / 100))
}

/** Giá kệ: giảm CMSN khi shop bật chương trình và khách đang trong cửa sổ ưu đãi (không cần mã). */
function formatVndPriceWithBirthday(priceHint: string | undefined, pct: number | null): string | null {
  const base = formatVndPrice(priceHint)
  if (base == null || pct == null || pct <= 0) return base
  const n = parseVndFromHint(priceHint)
  if (n <= 0) return base
  return `${new Intl.NumberFormat('vi-VN').format(discountVndNumberForBirthday(n, pct))}đ`
}

function normalizeIntentText(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function classifyOrderIntent(raw: string): 'purchase' | 'shipping_policy' | 'consult' {
  const t = normalizeIntentText(raw)
  if (!t) return 'consult'

  const shippingHints = [
    'van chuyen',
    'giao hang',
    'phi ship',
    'ship',
    'bao gio hang ve',
    'khi nao nhan duoc',
    'thoi gian giao',
    'cod',
    'doi tra',
    'bao hanh',
    'chinh sach giao',
  ]
  if (shippingHints.some((k) => t.includes(k))) return 'shipping_policy'

  const purchaseStrongHints = [
    'cho minh dat',
    'mua mau nay',
    'muon mua mau nay',
    'minh muon mua',
    'dat mau nay',
    'dat hang',
    'chot don',
    'len don',
    'mua luon',
    'lay doi nay',
    'chot mau nay',
    'tao don',
  ]
  if (purchaseStrongHints.some((k) => t.includes(k))) return 'purchase'
  return 'consult'
}

type T = Dictionary['partnerGuestChat']
const TRY_ON_COST_2K = 1
const MAX_TRY_ON_GARMENTS = 4
/** Lưu ảnh người thử đồ trên domain NanoAI (iframe) — widget mở `open_try_on=1` sẽ khôi phục. */
const TRY_ON_USER_PORTRAIT_STORAGE_MAX_BYTES = 900 * 1024
function tryOnUserPortraitStorageKey(partnerSlug: string): string {
  return `nanoai_try_on_user_portrait_v1:${encodeURIComponent(partnerSlug)}`
}
const MESSAGING_AUTH_SYNC_EVENT_KEY = 'nanoai_messaging_auth_sync'
const FALLBACK_SHOP_TYPING_WAIT_MS = 75_000
const ORDER_PROFILE_STORAGE_PREFIX = 'nanoai_order_profile_v1'
const GUEST_IMAGE_MAX_BYTES = 10 * 1024 * 1024

/** Tổng số cái từ các dòng màu (mỗi dòng tối đa 99), tổng tối đa 99 theo DB đơn. */
function sumPaletteLineUnits(imgs: string[], qtyByImg: Record<string, string>): number {
  let s = 0
  for (const img of imgs) {
    s += Math.max(0, Math.min(99, Math.floor(Number(qtyByImg[img]) || 0)))
  }
  return Math.min(99, s)
}

type SelectedImage = {
  file: File | null
  previewUrl: string
  sourceUrl?: string
  sourceLabel?: string
  revokeObjectUrl?: boolean
}

type ChatRailItem = {
  conversationId: string
  shopName: string
  slug: string
  lastMessageAt: string | null
  lastMessagePreview: string | null
}

type OrderProfileDraft = {
  customerName: string
  customerPhone: string
  shippingAddress: string
}

type TopUpPaymentConfig = {
  id: string
  bank_account: string
  bank_id: string
  bank_name: string
  qr_template_url?: string
}

type TopUpPayment = {
  id: string
  amount: number
  credits_added: number
  qr_url: string
  transaction_content?: string
  bank_account?: string
  bank_name?: string
  status?: string
}

type GuestLoyaltyStatus = {
  enabled: boolean
  tierCode: string
  tierName: string
  discountPercent: number
  totalSpent: number
  nextTierCode: string
  amountToNextTier: number
}

function formatCredits(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

const GUEST_CHAT_LOCALE_SHORT: Record<WebLocale, string> = {
  vi: 'VI',
  en: 'EN',
  zh: '中文',
  ja: '日本語',
  ko: '한국어',
}

/** Ước độ rộng ô select (px) theo nhãn — tránh lần paint đầu bị browser giãn theo option dài nhất. */
function initialEmbedLocaleSelectWidthPx(locale: WebLocale): number {
  const label = GUEST_CHAT_LOCALE_SHORT[locale]
  let textPx = 0
  for (const ch of label) {
    const cp = ch.codePointAt(0) ?? 0
    textPx += cp > 0xff ? 13 : 8
  }
  const chromePx = 40
  return Math.max(48, Math.min(200, Math.ceil(textPx + chromePx)))
}

/** Đổi cookie locale, đồng bộ `metadata.ui_locale` hội thoại (tin hệ thống/AI đúng ngôn ngữ), rồi refresh. */
function GuestChatLocaleSwitches({
  currentLocale,
  slug,
  variant = 'buttons',
  embedTouchSheet = false,
  languageSelectAriaLabel,
}: {
  currentLocale: WebLocale
  slug: string
  /** `select`: gọn cho khung nhúng (iframe). */
  variant?: 'buttons' | 'select'
  /**
   * Nhúng (`embed=1`): trên cảm ứng / iframe hẹp, `<select>` trong iframe thường không mở được (iOS Safari).
   * Khi bật: dùng nút + bottom sheet thay cho native select.
   */
  embedTouchSheet?: boolean
  /** Nhãn a11y chọn ngôn ngữ (theo locale trang). */
  languageSelectAriaLabel: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [embedLocaleSheetOpen, setEmbedLocaleSheetOpen] = useState(false)
  const [embedLocalePortalReady, setEmbedLocalePortalReady] = useState(false)
  /** Nhúng: mặc định ưu tiên sheet (tránh <select> iframe iOS); layout effect có thể chuyển sang native select nếu khung rất rộng + chuột. */
  const [useEmbedLocaleSheet, setUseEmbedLocaleSheet] = useState(() => embedTouchSheet)
  /** Đo độ rộng nhãn đang chọn — native <select> mặc định rộng theo option dài nhất nếu không ép width. */
  const localeLabelMeasureRef = useRef<HTMLSpanElement>(null)
  const [embedSelectWidthPx, setEmbedSelectWidthPx] = useState(() => initialEmbedLocaleSelectWidthPx(currentLocale))

  useEffect(() => {
    setEmbedLocalePortalReady(true)
  }, [])

  useEffect(() => {
    if (variant !== 'select' || !embedTouchSheet || !useEmbedLocaleSheet || !embedLocaleSheetOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [variant, embedTouchSheet, useEmbedLocaleSheet, embedLocaleSheetOpen])

  useLayoutEffect(() => {
    if (variant !== 'select' || !embedTouchSheet) return
    const pick = () => {
      if (typeof window === 'undefined') return true
      const w = window.innerWidth
      const coarse = window.matchMedia('(pointer: coarse)').matches
      const touch = (navigator.maxTouchPoints ?? 0) > 0
      return w <= 900 || coarse || touch
    }
    setUseEmbedLocaleSheet(pick())
    const onResize = () => setUseEmbedLocaleSheet(pick())
    window.addEventListener('resize', onResize, { passive: true })
    return () => window.removeEventListener('resize', onResize)
  }, [variant, embedTouchSheet])

  useLayoutEffect(() => {
    if (variant !== 'select' || embedTouchSheet) return
    const measure = () => {
      const el = localeLabelMeasureRef.current
      if (!el) {
        setEmbedSelectWidthPx(initialEmbedLocaleSelectWidthPx(currentLocale))
        return
      }
      const textW = el.getBoundingClientRect().width
      const raw = Math.ceil(textW + 38)
      const maxPx = Math.min(12 * 16, Math.floor(window.innerWidth * 0.34))
      setEmbedSelectWidthPx(Math.min(Math.max(raw, 48), maxPx))
    }
    measure()
    window.addEventListener('resize', measure, { passive: true })
    return () => window.removeEventListener('resize', measure)
  }, [variant, embedTouchSheet, currentLocale])

  const setLocale = (locale: WebLocale) => {
    if (locale === currentLocale) return
    const maxAge = 31536000
    const tail = `; path=/; max-age=${maxAge}; samesite=lax`
    document.cookie = `${LOCALE_COOKIE_NAME}=${locale}${tail}`
    document.cookie = `${LOCALE_COOKIE_NAME_LEGACY}=${locale}${tail}`
    void (async () => {
      try {
        await fetch(`/api/messaging/guest/${encodeURIComponent(slug)}/ui-locale`, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uiLocale: locale }),
        })
      } catch {
        // Cookie vẫn đổi — UI refresh; metadata có thể cập nhật ở tin sau
      }
      startTransition(() => {
        if (typeof window !== 'undefined') {
          const u = new URL(window.location.href)
          u.searchParams.set('ui_locale', locale)
          router.replace(`${u.pathname}${u.search}${u.hash}`)
        } else {
          router.refresh()
        }
      })
    })()
  }

  if (variant === 'select' && embedTouchSheet && useEmbedLocaleSheet) {
    const embedLocaleLayer =
      embedLocalePortalReady && embedLocaleSheetOpen ? (
        createPortal(
          <>
            <div
              aria-hidden
              className="fixed inset-0 z-[540] cursor-pointer bg-black/50"
              style={{ WebkitTapHighlightColor: 'transparent', touchAction: 'auto' }}
              onClick={() => setEmbedLocaleSheetOpen(false)}
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-label={languageSelectAriaLabel}
              className="fixed inset-x-0 bottom-0 z-[550] max-h-[min(78dvh,480px)] overflow-y-auto overscroll-contain rounded-t-2xl border border-border/80 bg-background px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_32px_rgba(0,0,0,0.2)]"
              style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <p className="mb-3 text-center text-sm font-semibold text-foreground">{languageSelectAriaLabel}</p>
              <div className="grid gap-2 pb-2">
                {WEB_LOCALES.map((locale) => (
                  <button
                    key={locale}
                    type="button"
                    disabled={pending}
                    className={`min-h-[48px] w-full rounded-lg border px-3 py-3 text-base font-semibold transition-colors active:opacity-90 ${
                      locale === currentLocale
                        ? 'border-violet-500 bg-violet-600 text-white'
                        : 'border-border/80 bg-muted/40 text-foreground hover:bg-muted/70'
                    } disabled:opacity-50`}
                    style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
                    onClick={() => {
                      setEmbedLocaleSheetOpen(false)
                      setLocale(locale)
                    }}
                  >
                    {GUEST_CHAT_LOCALE_SHORT[locale]}
                  </button>
                ))}
              </div>
            </div>
          </>,
          document.body
        )
      ) : null

    return (
      <>
        <button
          type="button"
          disabled={pending}
          className="relative z-[100] inline-flex h-10 min-h-[44px] min-w-[44px] shrink-0 items-center gap-1 rounded-md border border-input bg-background px-2.5 font-sans text-xs font-semibold text-foreground shadow-sm outline-none ring-offset-background hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
          style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
          aria-label={languageSelectAriaLabel}
          aria-haspopup="dialog"
          aria-expanded={embedLocaleSheetOpen}
          onClick={() => setEmbedLocaleSheetOpen(true)}
        >
          <span className="max-w-[6.5rem] truncate">{GUEST_CHAT_LOCALE_SHORT[currentLocale]}</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden />
        </button>
        {embedLocaleLayer}
      </>
    )
  }

  if (variant === 'select') {
    // Desktop / chuột: native <select> gọn; trong iframe hẹp + cảm ứng dùng nhánh sheet ở trên.
    return (
      <div className="relative z-[100] inline-block w-fit max-w-[min(100%,12rem)] shrink-0 pointer-events-auto touch-manipulation">
        <span
          ref={localeLabelMeasureRef}
          className="pointer-events-none absolute left-0 top-0 whitespace-nowrap font-sans text-xs font-semibold leading-none [visibility:hidden]"
          aria-hidden
        >
          {GUEST_CHAT_LOCALE_SHORT[currentLocale]}
        </span>
        <select
          className="box-border h-8 min-w-0 max-w-full cursor-pointer appearance-none rounded-md border border-input bg-background py-1 pl-2 pr-7 font-sans text-xs font-semibold leading-none shadow-sm ring-offset-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          style={{
            width: embedSelectWidthPx,
            maxWidth: 'min(100%, 12rem)',
          }}
          value={currentLocale}
          disabled={pending}
          onChange={(e) => setLocale(e.target.value as WebLocale)}
          aria-label={languageSelectAriaLabel}
        >
          {WEB_LOCALES.map((locale) => (
            <option key={locale} value={locale}>
              {GUEST_CHAT_LOCALE_SHORT[locale]}
            </option>
          ))}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 opacity-50"
          aria-hidden
        />
      </div>
    )
  }

  return (
    <div
      className="relative z-[1] flex flex-wrap items-center justify-end gap-0.5 rounded-md border border-border/50 bg-background/80 p-0.5 pointer-events-auto"
      role="group"
      aria-label={languageSelectAriaLabel}
    >
      {WEB_LOCALES.map((locale) => (
        <Button
          key={locale}
          type="button"
          variant={locale === currentLocale ? 'default' : 'ghost'}
          size="sm"
          disabled={pending}
          onClick={() => setLocale(locale)}
          className="h-7 min-w-[1.75rem] px-1.5 text-[10px] font-semibold"
        >
          {GUEST_CHAT_LOCALE_SHORT[locale]}
        </Button>
      ))}
    </div>
  )
}

type GuestChatDraftComposerProps = {
  submitGuestMessage: (text: string) => Promise<boolean>
  enqueueGuestSend: (run: () => Promise<void>) => void
  attachmentCount: number
  uploading: boolean
  sending: boolean
  tryOnBusy: boolean
  onDraftPaste: (e: ClipboardEvent<HTMLTextAreaElement>) => void
  onToggleTryOn: () => void
  galleryInputRef: RefObject<HTMLInputElement | null>
  cameraInputRef: RefObject<HTMLInputElement | null>
  showCameraButton: boolean
  onOpenProductShelf?: () => void
  productShelfButtonLabel?: string
  /** Đơn hàng / giỏ — cùng hàng với «Sản phẩm» (embed & widget iframe). */
  showCommerceShortcuts?: boolean
  onOpenMyOrders?: () => void
  onOpenCart?: () => void
  cartItemCount?: number
  ordersShortcutLabel?: string
  cartShortcutLabel?: string
  onComposerFocusChange?: (focused: boolean) => void
  labels: {
    placeholder: string
    sendKeyboardHint: string
    tryOnOpen: string
    guestAttachPhoto: string
    guestTakePhoto: string
    send: string
    guestUploading: string
  }
}

/** State draft cục bộ — gõ không re-render toàn bộ PartnerGuestChatClient (tránh lag ô nhập). */
const GuestChatDraftComposer = memo(function GuestChatDraftComposer({
  submitGuestMessage,
  enqueueGuestSend,
  attachmentCount,
  uploading,
  sending,
  tryOnBusy,
  onDraftPaste,
  onToggleTryOn,
  galleryInputRef,
  cameraInputRef,
  showCameraButton,
  onOpenProductShelf,
  productShelfButtonLabel,
  showCommerceShortcuts,
  onOpenMyOrders,
  onOpenCart,
  cartItemCount = 0,
  ordersShortcutLabel,
  cartShortcutLabel,
  onComposerFocusChange,
  labels,
}: GuestChatDraftComposerProps) {
  const [draft, setDraft] = useState('')
  const draftTextareaRef = useRef<HTMLTextAreaElement>(null)
  const draftRef = useRef(draft)
  draftRef.current = draft

  const autoResizeDraft = useCallback(() => {
    const el = draftTextareaRef.current
    if (!el) return
    el.style.height = '0px'
    const minHeight = 22
    const maxHeight = 72
    const next = Math.min(Math.max(el.scrollHeight, minHeight), maxHeight)
    el.style.height = `${next}px`
    el.style.overflowY = el.scrollHeight > maxHeight ? 'auto' : 'hidden'
  }, [])

  useLayoutEffect(() => {
    autoResizeDraft()
  }, [draft, autoResizeDraft])

  const canSend = Boolean((draft.trim() || attachmentCount > 0) && !uploading)

  const send = useCallback(() => {
    enqueueGuestSend(async () => {
      const text = draftRef.current.trim()
      const ok = await submitGuestMessage(text)
      if (ok) setDraft('')
    })
  }, [enqueueGuestSend, submitGuestMessage])

  return (
    <div className="space-y-1.5">
      <div className="relative">
        <Textarea
          ref={draftTextareaRef}
          data-guest-composer-input="1"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onInput={autoResizeDraft}
          onPaste={onDraftPaste}
          onFocus={(e) => {
            onComposerFocusChange?.(true)
            const el = e.currentTarget
            const scroll = () =>
              el.scrollIntoView({ block: 'end', inline: 'nearest', behavior: 'auto' })
            scroll()
            window.requestAnimationFrame(() => {
              scroll()
              window.requestAnimationFrame(scroll)
            })
            /** Bàn phím ảo mở chậm (iOS / Facebook in-app) — kéo lại sau khi viewport đổi. */
            window.setTimeout(scroll, 80)
            window.setTimeout(scroll, 280)
          }}
          onBlur={() => onComposerFocusChange?.(false)}
          placeholder={labels.placeholder}
          rows={1}
          className="resize-none border-0 bg-transparent px-0 pb-[4.25rem] pt-1 pr-12 text-[17px] leading-snug shadow-none focus-visible:ring-0 sm:pb-[4.5rem] sm:text-lg"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              if (canSend && !sending) void send()
            }
          }}
        />
        <Button
          type="button"
          className="absolute right-0 top-0.5 h-9 w-9 min-w-0 shrink-0 px-0 sm:h-10 sm:w-10"
          onClick={() => void send()}
          disabled={!canSend || sending}
          aria-label={labels.send}
        >
          {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
        </Button>
        <div className="absolute bottom-0 left-0 z-10 flex max-w-[calc(100%-3rem)] items-end gap-1.5 overflow-x-auto pr-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="flex h-auto min-h-[2.75rem] shrink-0 flex-col items-center justify-center gap-0.5 px-2 py-1.5 sm:min-h-[3rem]"
            disabled={uploading || sending || tryOnBusy}
            onClick={onToggleTryOn}
          >
            {tryOnBusy ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
            ) : (
              <Sparkles className="h-4 w-4 shrink-0" aria-hidden />
            )}
            <span className="max-w-[4.25rem] text-center text-[10px] font-medium leading-tight sm:max-w-[5rem] sm:text-[11px]">
              {labels.tryOnOpen}
            </span>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 w-9 shrink-0 p-0 sm:h-10 sm:w-10"
            disabled={uploading || sending}
            onClick={() => galleryInputRef.current?.click()}
            aria-label={labels.guestAttachPhoto}
            title={labels.guestAttachPhoto}
          >
            {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
          </Button>
          {showCameraButton ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 w-9 shrink-0 p-0 sm:h-10 sm:w-10"
              disabled={uploading || sending}
              onClick={() => cameraInputRef.current?.click()}
              aria-label={labels.guestTakePhoto}
              title={labels.guestTakePhoto}
            >
              <Camera className="h-5 w-5" />
            </Button>
          ) : null}
          {productShelfButtonLabel && onOpenProductShelf ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="flex h-auto min-h-[2.75rem] shrink-0 flex-col items-center justify-center gap-0.5 px-2 py-1.5 sm:min-h-[3rem]"
              disabled={uploading || sending}
              onClick={() => onOpenProductShelf()}
            >
              <Package className="h-4 w-4 shrink-0" aria-hidden />
              <span className="max-w-[4.25rem] text-center text-[10px] font-medium leading-tight sm:max-w-[5rem] sm:text-[11px]">
                {productShelfButtonLabel}
              </span>
            </Button>
          ) : null}
          {showCommerceShortcuts && onOpenMyOrders && ordersShortcutLabel ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="flex h-auto min-h-[2.75rem] shrink-0 flex-col items-center justify-center gap-0.5 border-violet-300/80 bg-violet-50/90 px-2 py-1.5 text-violet-950 hover:bg-violet-100/90 dark:border-violet-700 dark:bg-violet-950/45 dark:text-violet-50 dark:hover:bg-violet-900/55 sm:min-h-[3rem]"
              disabled={uploading || sending}
              onClick={() => onOpenMyOrders()}
              title={ordersShortcutLabel}
              aria-label={ordersShortcutLabel}
            >
              <Package className="h-4 w-4 shrink-0" aria-hidden />
              <span className="max-w-[4.25rem] text-center text-[10px] font-medium leading-tight sm:max-w-[5rem] sm:text-[11px]">
                {ordersShortcutLabel}
              </span>
            </Button>
          ) : null}
          {showCommerceShortcuts && onOpenCart && cartShortcutLabel ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="relative flex h-auto min-h-[2.75rem] shrink-0 flex-col items-center justify-center gap-0.5 px-2 py-1.5 sm:min-h-[3rem]"
              disabled={uploading || sending}
              onClick={() => onOpenCart()}
              title={cartShortcutLabel}
              aria-label={`${cartShortcutLabel} (${cartItemCount})`}
            >
              <ShoppingCart className="h-4 w-4 shrink-0" aria-hidden />
              <span className="max-w-[4.25rem] text-center text-[10px] font-medium leading-tight sm:max-w-[5rem] sm:text-[11px]">
                {cartShortcutLabel}
              </span>
              {cartItemCount > 0 ? (
                <span className="absolute right-0 top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-emerald-600 px-0.5 text-[9px] font-bold leading-none text-white">
                  {cartItemCount > 99 ? '99+' : cartItemCount}
                </span>
              ) : null}
            </Button>
          ) : null}
        </div>
      </div>
      {uploading ? <p className="text-xs text-muted-foreground sm:text-sm">{labels.guestUploading}</p> : null}
      <p className="hidden text-xs leading-tight text-muted-foreground sm:block sm:text-sm">{labels.sendKeyboardHint}</p>
    </div>
  )
})

/**
 * Layout một cột (không sidebar) — neo thanh nhập fixed + đo chiều cao cho padding vùng tin.
 * Mặc định `true` (mobile-first): tránh một lần render đầu `false` khiến ô nhập không neo và bị bàn phím che
 * (useEffect chạy sau paint). Desktop chỉnh về `false` trong useLayoutEffect trước khi vẽ.
 */
function useGuestChatNarrowLayout(): boolean {
  const [narrow, setNarrow] = useState(true)
  useLayoutEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)')
    const apply = () => setNarrow(mq.matches)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])
  return narrow
}

export function PartnerGuestChatClient({
  slug,
  shopDisplayName,
  uiLocale,
  t,
  toolT,
  orderDetailT,
  initialChatList = [],
  guestPurchaseFlow = 'in_chat',
  guestExternalCartUrlTemplate = null,
  consultFromInventory,
  metaViewContent,
  adsTracking,
  ga4InitialViewItem,
}: {
  slug: string
  shopDisplayName: string
  /** Ngôn ngữ UI khách (cookie trang) — gửi kèm API để tin hệ thống đơn đúng ngôn ngữ. */
  uiLocale: WebLocale
  t: T
  toolT: Dictionary['tool']
  /** Nhãn cho modal «Đơn hàng» trong khung nhúng (không cần đăng nhập NanoAI). */
  orderDetailT: Dictionary['messagingMyOrders']
  initialChatList?: ChatRailItem[]
  guestPurchaseFlow?: GuestPurchaseFlow
  /** Mẫu URL giỏ web (`{sku}`) — chế độ `external_cart_url`. */
  guestExternalCartUrlTemplate?: string | null
  /**
   * Trang `/messaging/p/{slug}/tu-van/{uuid}` — ngữ cảnh từ kho (URL gọn, không query `ctx_*` dài).
   */
  consultFromInventory?: {
    inventoryId: string
    sku?: string
    imageUrl?: string
    productUrl?: string
  } | null
  /** Meta Pixel ViewContent — server đã gửi CAPI; client dedupe bằng `eventId`. */
  metaViewContent?: MetaViewContentClientPayload | null
  /** GA4 + Google Ads + TikTok (+ Meta browser khi không có CAPI). */
  adsTracking: PartnerSiteShopTrackingConfig
  /** Dữ liệu view_item lấy trực tiếp từ kho khi không có Meta Pixel. */
  ga4InitialViewItem?: ShopGa4ProductInput | null
}) {
  const { toast } = useToast()
  const guestChatKeyboardInset = useVisualViewportBottomInset()
  const guestChatShellHeightPx = useVisualViewportShellHeightPx()
  const guestChatNarrowLayout = useGuestChatNarrowLayout()
  const guestChatFocusRootRef = useRef<HTMLDivElement>(null)
  const [guestChatFormFieldFocused, setGuestChatFormFieldFocused] = useState(false)

  const syncGuestChatFormFieldFocus = useCallback(() => {
    requestAnimationFrame(() => {
      const root = guestChatFocusRootRef.current
      const ae = document.activeElement
      const isField =
        ae instanceof HTMLInputElement ||
        ae instanceof HTMLTextAreaElement ||
        ae instanceof HTMLSelectElement
      setGuestChatFormFieldFocused(Boolean(root && ae && isField && root.contains(ae)))
    })
  }, [])

  useEffect(() => {
    const root = guestChatFocusRootRef.current
    if (!root) return
    const onFocusIn = (ev: FocusEvent) => {
      const t = ev.target
      if (
        !(
          t instanceof HTMLInputElement ||
          t instanceof HTMLTextAreaElement ||
          t instanceof HTMLSelectElement ||
          (t instanceof HTMLElement && t.isContentEditable)
        )
      ) {
        return
      }
      if (t instanceof HTMLElement && t.dataset.guestComposerInput === '1') return
      requestAnimationFrame(() => {
        t.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'auto' })
      })
    }
    root.addEventListener('focusin', onFocusIn)
    return () => root.removeEventListener('focusin', onFocusIn)
  }, [])

  const guestChatKeyboardUaProfile = useMemo(() => detectGuestChatKeyboardUaProfile(), [])

  /**
   * Khoảng cần đẩy thanh nhập lên khỏi bàn phím (px).
   * Ưu tiên số đo từ hook + visualViewport. Với WebView báo sai `innerHeight`,
   * fallback thêm theo `screen.height` để vẫn nhấc composer lên khi bàn phím mở.
   */
  const guestChatKeyboardLiftPx = useMemo(() => {
    if (typeof window === 'undefined') return guestChatKeyboardInset
    if (guestChatKeyboardUaProfile.isZaloInApp) return 0
    if (!guestChatKeyboardUaProfile.isFacebookInApp) return 0
    let n = guestChatKeyboardInset
    const vv = window.visualViewport
    if (vv) {
      const visualBottom = vv.offsetTop + vv.height
      const ih = Math.max(window.innerHeight, document.documentElement?.clientHeight ?? 0)
      const overlap = Math.max(0, Math.round(ih - visualBottom))
      n = Math.max(n, overlap)
    }
    /**
     * WebView in-app lỗi (đặc biệt Facebook) có máy không đổi viewport dù bàn phím đã mở.
     * Khi đang focus mà số đo vẫn quá nhỏ, ép nâng tối thiểu để ô gõ không bị che.
     */
    if (
      guestChatKeyboardUaProfile.isLikelyProblematicInApp &&
      !guestChatKeyboardUaProfile.isZaloInApp &&
      guestChatNarrowLayout &&
      guestChatFormFieldFocused &&
      n < 140
    ) {
      const ih = Math.max(window.innerHeight, document.documentElement?.clientHeight ?? 0)
      const screenH = Math.max(0, window.screen?.height ?? 0)
      const baseH = Math.max(ih, screenH)
      const rawFromVisual = vv ? Math.max(0, Math.round(baseH - (vv.offsetTop + vv.height))) : 0
      const fallbackFloor = Math.round(baseH * 0.34)
      const forced = Math.min(520, Math.max(220, Math.max(rawFromVisual, fallbackFloor)))
      n = Math.max(n, forced)
    }
    return n
  }, [
    guestChatKeyboardInset,
    guestChatFormFieldFocused,
    guestChatKeyboardUaProfile,
    guestChatNarrowLayout,
  ])
  const guestChatShouldTranslateComposer =
    guestChatNarrowLayout &&
    guestChatFormFieldFocused &&
    !guestChatKeyboardUaProfile.isZaloInApp &&
    guestChatKeyboardLiftPx > 0
  const [authReady, setAuthReady] = useState(false)

  const [userId, setUserId] = useState<string | null>(null)
  const [messages, setMessages] = useState<GuestMsg[]>([])
  const [hasMoreOlderMessages, setHasMoreOlderMessages] = useState(false)
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false)
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false)
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [authMode, setAuthMode] = useState<'anonymous' | 'account'>('anonymous')
  const [guestLoyaltyStatus, setGuestLoyaltyStatus] = useState<GuestLoyaltyStatus | null>(null)
  const [guestNeedsProfile, setGuestNeedsProfile] = useState(false)
  const [guestProfileOpen, setGuestProfileOpen] = useState(false)
  const [guestBirthDay, setGuestBirthDay] = useState('')
  const [guestBirthMonth, setGuestBirthMonth] = useState('')
  const [guestBirthYear, setGuestBirthYear] = useState('')
  const [guestProfileGender, setGuestProfileGender] = useState<'male' | 'female' | ''>('')
  const [guestProfileSaving, setGuestProfileSaving] = useState(false)
  const [authGateRequired, setAuthGateRequired] = useState(false)
  const [guestAuthEmail, setGuestAuthEmail] = useState('')
  const [guestAuthOtp, setGuestAuthOtp] = useState('')
  const [guestAuthRememberDevice, setGuestAuthRememberDevice] = useState(() =>
    readGuestAuthRememberDevicePreference()
  )
  const [guestAuthSending, setGuestAuthSending] = useState(false)
  const [guestAuthVerifying, setGuestAuthVerifying] = useState(false)
  const otpLastAutoSubmittedRef = useRef<string>('')
  /** Chuỗi hóa POST `/api/messaging/guest` — tránh race khi khách gửi nhiều tin nhanh (job AI + thứ tự DB). */
  const guestMessagePostChainRef = useRef(Promise.resolve())
  /** Sau khi gửi tin: server báo AI/FAQ đang trả lời — poll nhanh và hiện “đang soạn tin”. */
  const [shopTyping, setShopTyping] = useState<{
    deadline: number
    baselineLatestOutbound: GuestShopOutboundCursor | null
  } | null>(null)
  /** Mở link tư vấn — chờ fetch lời mở đầu + POST (vector) trước khi có bubble. */
  const [uploading, setUploading] = useState(false)
  const [isTouchDevice, setIsTouchDevice] = useState(false)
  const [tryOnOpen, setTryOnOpen] = useState(() => initialTryOnOpenFromGuestUrl(slug))
  /** `open_try_on=1` từ widget — hiển thị gợi ý ảnh người / credits trong iframe. */
  const [tryOnOpenedViaEmbedQuery, setTryOnOpenedViaEmbedQuery] = useState(() => initialTryOnOpenFromGuestUrl(slug))
  const [tryOnBusy, setTryOnBusy] = useState(false)
  const [tryOnCreditsBalance, setTryOnCreditsBalance] = useState<number | null>(null)
  const [tryOnCreditsLoading, setTryOnCreditsLoading] = useState(false)
  const [topUpOpen, setTopUpOpen] = useState(false)
  /** Đăng nhập OTP để mở ví credit (thử đồ / nạp) — Dialog thay vì bảng nạp khi chưa account. */
  const [guestCreditAuthDialogOpen, setGuestCreditAuthDialogOpen] = useState(false)
  const [pendingTopUpAfterAuth, setPendingTopUpAfterAuth] = useState(false)
  const tryOnZeroCreditAutoTopUpRef = useRef(false)
  const [topUpLoading, setTopUpLoading] = useState(false)
  const [topUpAmount, setTopUpAmount] = useState(String(CREDIT_UNIT_PRICE_VND))
  const [topUpConfigs, setTopUpConfigs] = useState<TopUpPaymentConfig[]>([])
  const [topUpSelectedBank, setTopUpSelectedBank] = useState('')
  const [topUpPayment, setTopUpPayment] = useState<TopUpPayment | null>(null)
  const [topUpSuccessCountdown, setTopUpSuccessCountdown] = useState<number | null>(null)
  const [portalMounted, setPortalMounted] = useState(false)
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null)
  const [orderFormOpen, setOrderFormOpen] = useState(false)
  const [orderFormBusy, setOrderFormBusy] = useState(false)
  const [buyOptionsOpen, setBuyOptionsOpen] = useState(false)
  const [buyOptionsBusy, setBuyOptionsBusy] = useState(false)
  const [buyOptions, setBuyOptions] = useState<BuyProductOption[]>([])
  const [buyPromptMessageId, setBuyPromptMessageId] = useState<string | null>(null)
  const [cartOpen, setCartOpen] = useState(false)
  const [cartItems, setCartItems] = useState<GuestCartItem[]>([])
  const [cartSyncReady, setCartSyncReady] = useState(false)
  const [cartCheckoutBusy, setCartCheckoutBusy] = useState(false)
  const [activeOrderCard, setActiveOrderCard] = useState<PartnerAiProductCard | null>(null)
  const [activePurchaseOptions, setActivePurchaseOptions] = useState<PurchaseOptionsPayload | null>(null)
  const [orderName, setOrderName] = useState('')
  const [orderPhone, setOrderPhone] = useState('')
  const [orderAddress, setOrderAddress] = useState('')
  const [orderColor, setOrderColor] = useState('')
  /** URL ảnh màu đã chọn — có thể nhiều; mỗi ảnh một loại, tránh trùng `name`. */
  const [orderSelectedColorImgs, setOrderSelectedColorImgs] = useState<string[]>([])
  /** SL theo từng ảnh màu (key = URL ảnh). */
  const [orderQtyByColorImg, setOrderQtyByColorImg] = useState<Record<string, string>>({})
  /** Size theo từng ảnh màu (key = URL ảnh). */
  const [orderSizeByColorImg, setOrderSizeByColorImg] = useState<Record<string, string>>({})
  const [orderSize, setOrderSize] = useState('')
  const [orderQuantity, setOrderQuantity] = useState('1')
  const [orderNote, setOrderNote] = useState('')
  const [proofOrderId, setProofOrderId] = useState<string | null>(null)
  /** Đơn đang chờ CK dùng SePay — không gợi ý gửi ảnh biên lai dưới ô nhập. */
  const [proofOrderIsSepay, setProofOrderIsSepay] = useState(false)
  const [paymentProofBusyOrderId, setPaymentProofBusyOrderId] = useState<string | null>(null)
  const [embedOrderDetailId, setEmbedOrderDetailId] = useState<string | null>(null)
  const [embedMyOrdersOpen, setEmbedMyOrdersOpen] = useState(false)
  const [nanoToolsSheetOpen, setNanoToolsSheetOpen] = useState(false)
  /** Tăng sau gửi biên lai thành công — tải lại dialog đơn / danh sách. */
  const [embedWidgetDataNonce, setEmbedWidgetDataNonce] = useState(0)
  /** Chat nhúng iframe trên site shop (`?embed=1`) — không có header FloatingChatWidget của nanoai.vn. */
  const [isEmbedUi, setIsEmbedUi] = useState(false)
  /** `true` khi trang chat chạy trong iframe (FloatingChatWidget / script nhúng); locale/mở rộng ở frame cha. */
  const [guestInIframe, setGuestInIframe] = useState(false)
  /** Trang hosted trên nanoai.vn (không nhúng) — hiện điều hướng về trang chủ & công cụ NanoAI. */
  const showNanoSiteNav = !isEmbedUi && !guestInIframe

  const guestBirthMaxDay = useMemo(() => {
    const m = Number.parseInt(guestBirthMonth, 10)
    const y = Number.parseInt(guestBirthYear, 10)
    if (!Number.isFinite(m) || !Number.isFinite(y) || m < 1 || m > 12) return 31
    return new Date(y, m, 0).getDate()
  }, [guestBirthMonth, guestBirthYear])

  const guestBirthYearOptions = useMemo(() => {
    const cy = new Date().getFullYear()
    const out: number[] = []
    for (let y = cy; y >= 1900; y -= 1) out.push(y)
    return out
  }, [])

  useEffect(() => {
    const d = Number.parseInt(guestBirthDay, 10)
    if (!guestBirthDay || !Number.isFinite(d)) return
    if (d > guestBirthMaxDay) setGuestBirthDay('')
  }, [guestBirthMaxDay, guestBirthDay])

  const [tryOnUserFile, setTryOnUserFile] = useState<File | null>(null)
  const [tryOnGarmentFiles, setTryOnGarmentFiles] = useState<SelectedImage[]>([])
  const [tryOnGarmentPickerOpen, setTryOnGarmentPickerOpen] = useState(false)
  const [tryOnUserPreviewUrl, setTryOnUserPreviewUrl] = useState<string | null>(null)
  const [imageStoragePaths, setImageStoragePaths] = useState<string[]>([])
  const [imagePreviewUrls, setImagePreviewUrls] = useState<string[]>([])
  const [visionPickBusyId, setVisionPickBusyId] = useState<string | null>(null)
  /** Thẻ vision 3 nút: mỗi nút một khóa (`messageId\u001finventoryId::detail|buy|consult`). */
  const [visionButtonTappedKeys, setVisionButtonTappedKeys] = useState(() => new Set<string>())
  /** Xem ảnh gợi ý / thẻ — overlay cùng trang (không mở tab). */
  const [chatImageLightboxUrl, setChatImageLightboxUrl] = useState<string | null>(null)
  /** Kết quả thử đồ còn trong ô soạn: cho phép mở lại dialog ảnh lớn sau khi đóng. */
  const [tryOnResultInComposer, setTryOnResultInComposer] = useState(false)
  const [tryOnComposerLargeOpen, setTryOnComposerLargeOpen] = useState(false)
  const pageContextRef = useRef<WidgetPageContextSeed | null>(null)
  const contextSeededRef = useRef(false)
  /** Chỉ khi `true`: gửi `pageContext` (từ ?ctx_* / tu-vân) lên server — khi khách bấm chip hoặc gửi tin. */
  const attachUrlPageContextRef = useRef(false)
  /** Hiển thị chip thumbnail «gửi SP đang xem» — đồng bộ ref khi mount; ẩn sau gửi / bỏ qua / đã có trong thread. */
  const [pendingUrlPageContextChip, setPendingUrlPageContextChip] = useState<WidgetPageContextSeed | null>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const tryOnUserInputRef = useRef<HTMLInputElement>(null)
  const tryOnGarmentInputRef = useRef<HTMLInputElement>(null)
  /** Một lần mở panel thử đồ: tự thêm ảnh SP từ ctx_image (chỉ luồng try_on). */
  const tryOnPageContextGarmentSeededRef = useRef(false)

  const closeEmbedTryOnPanel = useCallback(() => {
    setGuestTryOnUrlFlagCache(slug, false)
    setTryOnOpen(false)
    setTryOnOpenedViaEmbedQuery(false)
    setTryOnGarmentPickerOpen(false)
    tryOnPageContextGarmentSeededRef.current = false
    setTryOnGarmentFiles((prev) => {
      for (const item of prev) {
        if (item.revokeObjectUrl) URL.revokeObjectURL(item.previewUrl)
      }
      return []
    })
  }, [slug])
  const chatScrollRef = useRef<HTMLDivElement>(null)
  const scrollAnchorRef = useRef<HTMLDivElement>(null)
  /** Khoảng cách tới đáy ≤ ngưỡng này → coi như «đang xem cuối», cho phép tự cuộn theo tin/typing mới. */
  const guestChatNearBottomRef = useRef(true)
  /** Một số thao tác (gửi tin, chọn mẫu, đặt hàng) luôn cần kéo xuống dù trước đó user đang lướt lên. */
  const forceGuestChatScrollToBottomRef = useRef(false)
  const skipNextAutoScrollRef = useRef(false)
  const loadingOlderRef = useRef(false)
  const loadingCurrentRef = useRef(false)
  const lastAuthRefreshAtRef = useRef(0)
  const didInitialAutoScrollRef = useRef(false)
  const guestSessionIdRef = useRef<string | null>(null)
  const guestAccountIdRef = useRef<string | null>(null)
  const shopGa4InitialViewItemKeyRef = useRef<string | null>(null)
  const cartSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [recentProductsOpen, setRecentProductsOpen] = useState(false)
  /** SP từ email CMSN / deep link ?interested_inv= */
  const [birthdayPromoExtraRows, setBirthdayPromoExtraRows] = useState<RecentProductWithSource[]>([])
  const [birthdayPromoDiscountPct, setBirthdayPromoDiscountPct] = useState<number | null>(null)
  /** ISO time — neo bubble chúc SN (client-only), luôn xếp sau tin gần nhất. */
  const [birthdayPromoGreetingAnchoredAt, setBirthdayPromoGreetingAnchoredAt] = useState<string | null>(null)
  const [productShelfShuffleNonce, setProductShelfShuffleNonce] = useState(0)
  const [productShelfVisibleCount, setProductShelfVisibleCount] = useState(PRODUCT_SHELF_LAZY_INITIAL)
  const productShelfScrollRef = useRef<HTMLDivElement>(null)
  const productShelfSentinelRef = useRef<HTMLDivElement>(null)
  const productShelfImageInputRef = useRef<HTMLInputElement>(null)
  const prevRecentProductsOpenRef = useRef(false)
  const [productShelfSearchQuery, setProductShelfSearchQuery] = useState('')
  const [productShelfVectorRows, setProductShelfVectorRows] = useState<RecentProductWithSource[] | null>(null)
  const [productShelfSearchLoading, setProductShelfSearchLoading] = useState(false)
  const [productShelfSimilarRows, setProductShelfSimilarRows] = useState<RecentProductWithSource[] | null>(null)
  const [productShelfSimilarLoading, setProductShelfSimilarLoading] = useState(false)

  const mergeGuestMessages = useCallback((base: GuestMsg[], incoming: GuestMsg[]): GuestMsg[] => {
    if (!incoming.length) return base
    const byId = new Map<string, GuestMsg>()
    for (const m of base) byId.set(m.id, m)
    for (const m of incoming) byId.set(m.id, m)
    return Array.from(byId.values()).sort((a, b) => {
      const ta = Date.parse(a.created_at)
      const tb = Date.parse(b.created_at)
      if (ta !== tb) return ta - tb
      return a.id.localeCompare(b.id)
    })
  }, [])

  const guestMessagesEquivalent = useCallback((a: GuestMsg[], b: GuestMsg[]) => {
    const payloadEqual = (x: GuestMsg['raw_payload'], y: GuestMsg['raw_payload']) => {
      if (x === y) return true
      if (x == null || y == null) return x == null && y == null
      try {
        return JSON.stringify(x) === JSON.stringify(y)
      } catch {
        return false
      }
    }
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) {
      const x = a[i]
      const y = b[i]
      if (!x || !y) return false
      if (x.id !== y.id) return false
      if (x.body !== y.body) return false
      if (x.direction !== y.direction) return false
      if (x.created_at !== y.created_at) return false
      if (!payloadEqual(x.raw_payload, y.raw_payload)) return false
    }
    return true
  }, [])

  const recentProductRows = useMemo(() => {
    if (!recentProductsOpen && birthdayPromoExtraRows.length === 0) return []
    void productShelfShuffleNonce
    const base = collectAllSuggestedProductsWithSource(messages)
    shuffleInPlace(base)
    if (birthdayPromoExtraRows.length === 0) return base
    const seen = new Set(base.map((r) => r.card.product_url.trim().toLowerCase()))
    const extra = birthdayPromoExtraRows.filter((r) => !seen.has(r.card.product_url.trim().toLowerCase()))
    return [...extra, ...base]
  }, [messages, productShelfShuffleNonce, birthdayPromoExtraRows, recentProductsOpen])

  const productShelfDisplayRows = useMemo(() => {
    if (productShelfVectorRows !== null) return productShelfVectorRows
    if (productShelfSimilarRows !== null && productShelfSimilarRows.length > 0) {
      return productShelfSimilarRows
    }
    return recentProductRows
  }, [productShelfVectorRows, productShelfSimilarRows, recentProductRows])

  const productShelfDisplayLenRef = useRef(0)
  productShelfDisplayLenRef.current = productShelfDisplayRows.length

  useEffect(() => {
    const open = recentProductsOpen
    const prev = prevRecentProductsOpenRef.current
    if (!open && prev) {
      setProductShelfVisibleCount(PRODUCT_SHELF_LAZY_INITIAL)
      setProductShelfVectorRows(null)
      setProductShelfSimilarRows(null)
      setProductShelfSimilarLoading(false)
      setProductShelfSearchQuery('')
    }
    prevRecentProductsOpenRef.current = open
  }, [recentProductsOpen])

  /** Đồng bộ số ô hiển thị khi danh sách đổi / mở sheet — tránh kẹt 0 ô khi có dữ liệu sau. */
  useEffect(() => {
    if (!recentProductsOpen) return
    const len = productShelfDisplayRows.length
    setProductShelfVisibleCount((v) => {
      if (len === 0) return 0
      const capped = Math.min(v, len)
      if (capped === 0) return Math.min(PRODUCT_SHELF_LAZY_INITIAL, len)
      return capped
    })
  }, [productShelfDisplayRows.length, recentProductsOpen])

  useLayoutEffect(() => {
    if (!recentProductsOpen) return
    if (productShelfVisibleCount >= productShelfDisplayRows.length) return

    let cancelled = false
    let io: IntersectionObserver | null = null
    let frames = 0

    const tryAttach = () => {
      if (cancelled) return
      frames += 1
      const root = productShelfScrollRef.current
      const sentinel = productShelfSentinelRef.current
      if (!root || !sentinel) {
        if (frames < PRODUCT_SHELF_IO_ATTACH_MAX_FRAMES) {
          requestAnimationFrame(tryAttach)
        }
        return
      }
      io?.disconnect()
      io = new IntersectionObserver(
        (entries) => {
          if (!entries.some((e) => e.isIntersecting)) return
          setProductShelfVisibleCount((v) =>
            Math.min(v + PRODUCT_SHELF_LAZY_STEP, productShelfDisplayLenRef.current)
          )
        },
        { root, rootMargin: '320px 0px', threshold: 0 }
      )
      io.observe(sentinel)
    }

    requestAnimationFrame(tryAttach)

    return () => {
      cancelled = true
      io?.disconnect()
    }
  }, [recentProductsOpen, productShelfDisplayRows.length, productShelfVisibleCount])

  const { paidDepositOrderIds, sepayWebhookOrderIds } = useMemo(
    () => collectGuestOrderDepositConfirmationSplit(messages),
    [messages]
  )

  useEffect(() => {
    if (proofOrderId && paidDepositOrderIds.has(proofOrderId)) {
      setProofOrderId(null)
    }
  }, [proofOrderId, paidDepositOrderIds])

  /** Khi tin SePay xác nhận xuất hiện trong chat, tải lại chi tiết đơn (ẩn QR theo trạng thái mới). */
  const embedDetailRefetchNonceOidRef = useRef<string | null>(null)
  useEffect(() => {
    const oid = embedOrderDetailId?.trim() ?? ''
    if (!oid) {
      embedDetailRefetchNonceOidRef.current = null
      return
    }
    if (!paidDepositOrderIds.has(oid)) return
    if (embedDetailRefetchNonceOidRef.current === oid) return
    embedDetailRefetchNonceOidRef.current = oid
    setEmbedWidgetDataNonce((n) => n + 1)
  }, [embedOrderDetailId, paidDepositOrderIds])

  useEffect(() => {
    if (!proofOrderId) setProofOrderIsSepay(false)
  }, [proofOrderId])

  const recentSuggestedGarmentImages = useMemo(() => {
    if (!tryOnOpen || !tryOnGarmentPickerOpen) return []
    const out: Array<{ name: string; imageUrl: string }> = []
    const seen = new Set<string>()
    for (let idx = messages.length - 1; idx >= 0; idx--) {
      const m = messages[idx]
      if (m.direction !== 'outbound') continue
      const cards = aiProductCardsFromPayload(m.raw_payload ?? null)
      for (const card of cards) {
        const imageUrl = card.image_url.trim()
        if (!imageUrl || seen.has(imageUrl)) continue
        seen.add(imageUrl)
        out.push({ name: card.name, imageUrl })
        if (out.length >= 20) return out
      }
    }
    return out
  }, [messages, tryOnOpen, tryOnGarmentPickerOpen])

  useLayoutEffect(() => {
    if (typeof window === 'undefined') return
    let querySession = ''
    let queryAccount = ''
    try {
      const params = new URLSearchParams(window.location.search)
      querySession = readUuidQueryParam(params, EMBED_GUEST_SESSION_QUERY_KEY)
      queryAccount = readUuidQueryParam(params, EMBED_GUEST_ACCOUNT_QUERY_KEY)
    } catch {
      // ignore malformed URL/search in embedded browsers
    }
    let session =
      querySession
      || window.localStorage.getItem(MESSAGING_GUEST_SESSION_STORAGE_KEY)?.trim()
      || window.localStorage.getItem(MESSAGING_GUEST_SESSION_STORAGE_KEY_LEGACY)?.trim()
      || ''
    if (!session) {
      const fromCookie = readDocumentCookie(MESSAGING_GUEST_SESSION_SYNC_COOKIE)?.trim() ?? ''
      if (fromCookie) {
        session = fromCookie
        try {
          window.localStorage.setItem(MESSAGING_GUEST_SESSION_STORAGE_KEY, session)
          window.localStorage.setItem(MESSAGING_GUEST_SESSION_STORAGE_KEY_LEGACY, session)
        } catch {
          // ignore quota / private mode
        }
      }
    }
    if (session) guestSessionIdRef.current = session

    let account =
      queryAccount
      || window.localStorage.getItem(MESSAGING_GUEST_ACCOUNT_STORAGE_KEY)?.trim()
      || window.localStorage.getItem(MESSAGING_GUEST_ACCOUNT_STORAGE_KEY_LEGACY)?.trim()
      || ''
    if (!account) {
      const fromCookie = readDocumentCookie(MESSAGING_GUEST_ACCOUNT_SYNC_COOKIE)?.trim() ?? ''
      if (fromCookie) {
        account = fromCookie
        try {
          window.localStorage.setItem(MESSAGING_GUEST_ACCOUNT_STORAGE_KEY, account)
          window.localStorage.setItem(MESSAGING_GUEST_ACCOUNT_STORAGE_KEY_LEGACY, account)
        } catch {
          // ignore
        }
      }
    }
    if (account) guestAccountIdRef.current = account
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const q = new URLSearchParams(window.location.search)
    const ev = (q.get('embed') || '').trim().toLowerCase()
    let inIframe = false
    try {
      inIframe = window.self !== window.top
    } catch {
      inIframe = true
    }
    setGuestInIframe(inIframe)
    const embedLike = ev === '1' || ev === 'true' || ev === 'yes' || inIframe
    setIsEmbedUi(embedLike)

    const invBootstrap = (consultFromInventory?.inventoryId ?? '').trim()
    const uuidOk =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(invBootstrap)

    if (uuidOk && consultFromInventory) {
      const c = consultFromInventory
      const skuB = (c.sku ?? '').trim()
      const imageUrlB = (c.imageUrl ?? '').trim()
      const productUrlB = (c.productUrl ?? '').trim()
      const hasAny = Boolean(skuB || imageUrlB || productUrlB || invBootstrap)
      const rawSeed: WidgetPageContextSeed = {
        ...(skuB ? { sku: skuB.slice(0, 128) } : {}),
        ...(imageUrlB ? { imageUrl: imageUrlB } : {}),
        ...(productUrlB ? { productUrl: productUrlB } : {}),
        inventoryId: invBootstrap,
      }
      const next = hasAny ? sanitizeWidgetPageContextSeed(rawSeed) : null
      pageContextRef.current = hasWidgetPageContextSeed(next) ? next : null
    } else {
      const sku = (q.get('ctx_sku') || '').trim()
      const imageUrl = (q.get('ctx_image') || '').trim()
      const imageUrl2 = (q.get('ctx_image_2') || '').trim()
      const productUrl = (q.get('ctx_product_url') || '').trim()
      const invRaw = (q.get('ctx_inventory') || '').trim()
      const inventoryId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(invRaw)
        ? invRaw
        : ''
      const hasAny = Boolean(sku || imageUrl || imageUrl2 || productUrl || inventoryId)
      const rawSeed: WidgetPageContextSeed = {
        ...(sku ? { sku } : {}),
        ...(imageUrl ? { imageUrl } : {}),
        ...(imageUrl2 ? { imageUrl2 } : {}),
        ...(productUrl ? { productUrl } : {}),
        ...(inventoryId ? { inventoryId } : {}),
      }
      const next = hasAny ? sanitizeWidgetPageContextSeed(rawSeed) : null
      pageContextRef.current = hasWidgetPageContextSeed(next) ? next : null
    }

    const embedGateway = (q.get('ctx_gateway') || '').trim().toLowerCase()
    const tryOnOpenFlag = (q.get('open_try_on') || '').trim().toLowerCase()
    const isTryOnEmbed =
      embedGateway === 'try_on' ||
      tryOnOpenFlag === '1' ||
      tryOnOpenFlag === 'true' ||
      tryOnOpenFlag === 'yes'
    const pageChip = hasWidgetPageContextSeed(pageContextRef.current) ? pageContextRef.current : null

    /** ctx_image dùng chung — tách UI: tư vấn = chip, thử đồ = panel (không hiện cả hai). */
    if (isTryOnEmbed) {
      setPendingUrlPageContextChip(null)
      setGuestTryOnUrlFlagCache(slug, true)
      setTryOnOpen(true)
      setTryOnOpenedViaEmbedQuery(true)
      if (tryOnOpenFlag === '1' || tryOnOpenFlag === 'true' || tryOnOpenFlag === 'yes') {
        try {
          const u = new URL(window.location.href)
          if (u.searchParams.has('open_try_on')) {
            u.searchParams.delete('open_try_on')
            window.history.replaceState({}, '', `${u.pathname}${u.search}${u.hash}`)
          }
        } catch {
          /* ignore */
        }
      }
    } else if (embedGateway === 'consult') {
      closeEmbedTryOnPanel()
      setPendingUrlPageContextChip(pageChip)
    } else {
      closeEmbedTryOnPanel()
      setPendingUrlPageContextChip(pageChip)
    }

    /** Từ email / liên kết chia sẻ: `?order=<uuid>` mở chi tiết đơn trong widget. */
    const orderParam = (q.get('order') || '').trim().toLowerCase()
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(orderParam)) {
      setEmbedOrderDetailId(orderParam)
    }
  }, [consultFromInventory, slug, closeEmbedTryOnPanel])

  const authHeaders = useCallback((): Record<string, string> => {
    const h: Record<string, string> = {}
    const sessionId = guestSessionIdRef.current?.trim() ?? ''
    if (sessionId) h['x-guest-session-id'] = sessionId
    const accountId = guestAccountIdRef.current?.trim() ?? ''
    if (accountId) h['x-guest-account-id'] = accountId
    return h
  }, [])

  const runProductShelfTextSearch = useCallback(() => {
    const q = productShelfSearchQuery.trim()
    if (q.length < 2) return
    setProductShelfSearchLoading(true)
    void (async () => {
      try {
        const fd = new FormData()
        fd.set('mode', 'text')
        fd.set('q', q)
        const res = await fetch(`/api/messaging/guest/${encodeURIComponent(slug)}/inventory-vector-search`, {
          method: 'POST',
          body: fd,
          credentials: 'same-origin',
          headers: authHeaders(),
        })
        const data = (await res.json().catch(() => null)) as { ok?: boolean; cards?: PartnerAiProductCard[] } | null
        if (!res.ok || !data?.ok || !Array.isArray(data.cards)) {
          toast({ title: t.productShelfSearchFailed, variant: 'destructive' })
          return
        }
        const mapped: RecentProductWithSource[] = data.cards.map((card) => ({
          card,
          sourceMessageId: 'vector-search-text',
        }))
        setProductShelfVectorRows(mapped)
        setProductShelfVisibleCount(Math.min(PRODUCT_SHELF_LAZY_INITIAL, mapped.length))
      } catch {
        toast({ title: t.productShelfSearchFailed, variant: 'destructive' })
      } finally {
        setProductShelfSearchLoading(false)
      }
    })()
  }, [slug, authHeaders, productShelfSearchQuery, toast, t.productShelfSearchFailed])

  const onProductShelfImageFile = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      e.target.value = ''
      if (!file?.size) return
      setProductShelfSearchLoading(true)
      void (async () => {
        try {
          const fd = new FormData()
          fd.set('mode', 'image')
          fd.set('file', file)
          const res = await fetch(`/api/messaging/guest/${encodeURIComponent(slug)}/inventory-vector-search`, {
            method: 'POST',
            body: fd,
            credentials: 'same-origin',
            headers: authHeaders(),
          })
          const data = (await res.json().catch(() => null)) as { ok?: boolean; cards?: PartnerAiProductCard[] } | null
          if (!res.ok || !data?.ok || !Array.isArray(data.cards)) {
            toast({ title: t.productShelfSearchFailed, variant: 'destructive' })
            return
          }
          const mapped: RecentProductWithSource[] = data.cards.map((card) => ({
            card,
            sourceMessageId: 'vector-search-image',
          }))
          setProductShelfVectorRows(mapped)
          setProductShelfVisibleCount(Math.min(PRODUCT_SHELF_LAZY_INITIAL, mapped.length))
        } catch {
          toast({ title: t.productShelfSearchFailed, variant: 'destructive' })
        } finally {
          setProductShelfSearchLoading(false)
        }
      })()
    },
    [slug, authHeaders, toast, t.productShelfSearchFailed]
  )

  const captureGuestSessionFromResponse = useCallback((res: Response) => {
    const sid = res.headers.get('x-guest-session-id')?.trim() ?? ''
    if (!sid) return
    guestSessionIdRef.current = sid
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(MESSAGING_GUEST_SESSION_STORAGE_KEY, sid)
      window.localStorage.setItem(MESSAGING_GUEST_SESSION_STORAGE_KEY_LEGACY, sid)
      window.parent?.postMessage({ source: 'nanoai-widget', type: 'GUEST_IDENTITY', guestSessionId: sid }, '*')
    }
  }, [])

  const captureGuestAccountFromResponse = useCallback((res: Response) => {
    const aid = res.headers.get('x-guest-account-id')?.trim() ?? ''
    if (!aid) return
    guestAccountIdRef.current = aid
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(MESSAGING_GUEST_ACCOUNT_STORAGE_KEY, aid)
      window.localStorage.setItem(MESSAGING_GUEST_ACCOUNT_STORAGE_KEY_LEGACY, aid)
      window.parent?.postMessage({ source: 'nanoai-widget', type: 'GUEST_IDENTITY', guestAccountId: aid }, '*')
    }
  }, [])

  const loadProductShelfSimilarRows = useCallback(async () => {
    setProductShelfSimilarLoading(true)
    try {
      const res = await fetch(`/api/messaging/guest/${encodeURIComponent(slug)}/product-shelf`, {
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { ...authHeaders() },
      })
      captureGuestSessionFromResponse(res)
      captureGuestAccountFromResponse(res)
      const data = (await res.json().catch(() => null)) as {
        ok?: boolean
        cards?: PartnerAiProductCard[]
      } | null
      if (!res.ok || !data?.ok || !Array.isArray(data.cards)) {
        setProductShelfSimilarRows([])
        return
      }
      const mapped: RecentProductWithSource[] = data.cards.map((card) => ({
        card,
        sourceMessageId: 'chat-similar',
      }))
      setProductShelfSimilarRows(mapped)
      if (mapped.length > 0) {
        setProductShelfVisibleCount(Math.min(PRODUCT_SHELF_LAZY_INITIAL, mapped.length))
      }
    } catch {
      setProductShelfSimilarRows([])
    } finally {
      setProductShelfSimilarLoading(false)
    }
  }, [slug, authHeaders, captureGuestAccountFromResponse, captureGuestSessionFromResponse])

  useEffect(() => {
    if (!recentProductsOpen) return
    void loadProductShelfSimilarRows()
  }, [recentProductsOpen, loadProductShelfSimilarRows, productShelfShuffleNonce])

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (!isOpenMyOrdersMessage(e.data)) return
      // Parent nhúng có thể khác origin (site shop → iframe nanoai); chỉ chấp nhận tin từ `parent`.
      if (e.source !== window.parent) return
      setEmbedMyOrdersOpen(true)
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [])

  /** Khách đã có guest account (OTP/cookie) — không được coi 401 từ /api/account/* là “mất đăng nhập chat”. */
  const hasVerifiedGuestAccount = useCallback(() => Boolean(guestAccountIdRef.current?.trim()), [])

  const orderProfileStorageKey = useMemo(() => {
    const account = guestAccountIdRef.current?.trim()
    return `${ORDER_PROFILE_STORAGE_PREFIX}:${slug}:${account || 'anonymous'}`
  }, [slug])

  const readLocalOrderProfile = useCallback((): OrderProfileDraft | null => {
    if (typeof window === 'undefined') return null
    try {
      const raw = window.localStorage.getItem(orderProfileStorageKey)
      if (!raw) return null
      const obj = JSON.parse(raw) as Partial<OrderProfileDraft>
      return {
        customerName: String(obj.customerName ?? '').trim(),
        customerPhone: String(obj.customerPhone ?? '').trim(),
        shippingAddress: String(obj.shippingAddress ?? '').trim(),
      }
    } catch {
      return null
    }
  }, [orderProfileStorageKey])

  const saveLocalOrderProfile = useCallback((draft: OrderProfileDraft) => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(
        orderProfileStorageKey,
        JSON.stringify({
          customerName: draft.customerName.trim(),
          customerPhone: draft.customerPhone.trim(),
          shippingAddress: draft.shippingAddress.trim(),
        } satisfies OrderProfileDraft)
      )
    } catch {
      // ignore localStorage errors
    }
  }, [orderProfileStorageKey])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        if (typeof window !== 'undefined') {
          const sp = new URLSearchParams(window.location.search)
          const pcToken = sp.get(PARTNER_SITE_CUSTOMER_TOKEN_QUERY_KEY)?.trim() ?? ''
          if (pcToken) {
            const authRes = await fetch(
              `/api/messaging/guest/${encodeURIComponent(slug)}/auth/partner-site`,
              {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json', ...authHeaders() },
                body: JSON.stringify({ token: pcToken }),
              }
            )
            captureGuestSessionFromResponse(authRes)
            captureGuestAccountFromResponse(authRes)
            if (authRes.ok) {
              setAuthGateRequired(false)
              setAuthMode('account')
            }
            sp.delete(PARTNER_SITE_CUSTOMER_TOKEN_QUERY_KEY)
            const nextPath = `${window.location.pathname}${sp.toString() ? `?${sp.toString()}` : ''}`
            window.history.replaceState(null, '', nextPath)
          }
        }
        const resumeRes = await fetch(`/api/messaging/guest/${encodeURIComponent(slug)}/auth/resume`, {
          method: 'POST',
          credentials: 'same-origin',
          headers: {
            'Content-Type': 'application/json',
            ...authHeaders(),
          },
          body: JSON.stringify({ browserId: getStableEmailTrustedBrowserId() }),
        })
        captureGuestSessionFromResponse(resumeRes)
        captureGuestAccountFromResponse(resumeRes)
        const resumeJson = (await resumeRes.json().catch(() => ({}))) as {
          synced?: boolean
          accountId?: string
        }
        if (resumeJson.synced && resumeJson.accountId) {
          guestAccountIdRef.current = resumeJson.accountId
          setAuthGateRequired(false)
          setAuthMode('account')
        }
        const me = await fetch('/api/auth/me', {
          credentials: 'same-origin',
          headers: { ...authHeaders() },
        })
        const j = me.ok ? ((await me.json()) as { user?: { id?: string } }) : {}
        if (!cancelled) setUserId(j.user?.id ?? null)
      } catch {
        if (!cancelled) setUserId(null)
      } finally {
        if (!cancelled) setAuthReady(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [authHeaders, captureGuestAccountFromResponse, captureGuestSessionFromResponse, slug])

  const load = useCallback(async (options?: { beforeId?: string; appendOlder?: boolean; silent?: boolean }) => {
    const appendOlder = options?.appendOlder === true
    const silent = options?.silent === true
    const scrollerBeforeSilentRefresh = !appendOlder && silent ? chatScrollRef.current : null
    const shouldPreserveSilentScroll =
      Boolean(scrollerBeforeSilentRefresh) && !guestChatNearBottomRef.current
    const silentScrollSnapshot = shouldPreserveSilentScroll && scrollerBeforeSilentRefresh
      ? {
          top: scrollerBeforeSilentRefresh.scrollTop,
          height: scrollerBeforeSilentRefresh.scrollHeight,
        }
      : null
    if (silentScrollSnapshot) {
      skipNextAutoScrollRef.current = true
    }
    if (appendOlder) {
      if (loadingOlderRef.current) return
      loadingOlderRef.current = true
      setLoadingOlderMessages(true)
    } else {
      if (loadingCurrentRef.current) return
      loadingCurrentRef.current = true
      if (!silent) setLoading(true)
    }
    try {
      const qs = new URLSearchParams()
      if (options?.beforeId) qs.set('before_id', options.beforeId)
      if (!options?.beforeId) qs.set('limit', '50')
      const q = qs.toString()
      const endpoint = `/api/messaging/guest/${encodeURIComponent(slug)}${q ? `?${q}` : ''}`
      const res = await fetch(endpoint, {
        credentials: 'same-origin',
        headers: { ...authHeaders() },
      })
      captureGuestSessionFromResponse(res)
      captureGuestAccountFromResponse(res)
      const data = (await res.json()) as {
        messages?: GuestMsg[]
        hasMoreOlder?: boolean
        error?: string
        authMode?: 'anonymous' | 'account'
        needsProfile?: boolean
        guestProfile?: { birthDate?: string | null; gender?: string | null } | null
        loyaltyStatus?: GuestLoyaltyStatus | null
      }
      if (res.status === 401) {
        setUserId(null)
        setAuthGateRequired(true)
        setAuthMode('anonymous')
        return
      }
      if (!res.ok) {
        if (data.error?.startsWith('AUTH_REQUIRED_')) {
          setAuthGateRequired(true)
          setAuthMode('anonymous')
          toast({
            title: t.guestAuthRequiredAfterLimit.replace('{count}', '5'),
            variant: 'destructive',
          })
          return
        }
        toast({ title: data.error || t.loadError, variant: 'destructive' })
        return
      }
      const next = Array.isArray(data.messages) ? data.messages : []
      const normalizedMessages = next
        .filter((m) => {
          if (m.direction !== 'outbound') return true
          return !/^AUTH_REQUIRED_\d+$/i.test(String(m.body ?? '').trim())
        })
        .map((m) => {
          if (m.direction !== 'outbound') return m
          if (!/^AUTH_REQUIRED_/i.test(String(m.body ?? '').trim())) return m
          return {
            ...m,
            body: t.guestAuthRequiredAfterLimit.replace('{count}', '5'),
          }
        })
      const serverSaysAccount = data.authMode === 'account'
      const hasGuestAccount = Boolean(guestAccountIdRef.current?.trim())
      const hasMoreOlder = data.hasMoreOlder === true
      setHasMoreOlderMessages(hasMoreOlder)
      setMessages((prev) => {
        const merged = mergeGuestMessages(prev, normalizedMessages)
        setShopTyping((typingPrev) => {
          if (!typingPrev) return null
          if (Date.now() > typingPrev.deadline) return null
          /** Tải tin cũ: không so baseline — tránh tắt nhầm khi thêm outbound lịch sử phía trên. */
          if (appendOlder) return typingPrev
          const latest = latestOutboundCursor(merged)
          if (hasNewOutboundSinceTypingBaseline(latest, typingPrev.baselineLatestOutbound)) return null
          return typingPrev
        })
        return guestMessagesEquivalent(prev, merged) ? prev : merged
      })
      if (silentScrollSnapshot && scrollerBeforeSilentRefresh) {
        requestAnimationFrame(() => {
          const nextHeight = scrollerBeforeSilentRefresh.scrollHeight
          scrollerBeforeSilentRefresh.scrollTop =
            silentScrollSnapshot.top + Math.max(0, nextHeight - silentScrollSnapshot.height)
          const fromBottom =
            scrollerBeforeSilentRefresh.scrollHeight -
            scrollerBeforeSilentRefresh.scrollTop -
            scrollerBeforeSilentRefresh.clientHeight
          guestChatNearBottomRef.current = fromBottom <= GUEST_CHAT_STICK_TO_BOTTOM_PX
        })
      }
      const effectiveAuthMode = serverSaysAccount || hasGuestAccount ? 'account' : 'anonymous'
      setAuthMode(effectiveAuthMode)
      setGuestLoyaltyStatus(data.loyaltyStatus ?? null)
      if (effectiveAuthMode === 'account') setAuthGateRequired(false)
      setGuestNeedsProfile(Boolean(data.needsProfile))
      const gp = data.guestProfile
      if (gp?.birthDate && typeof gp.birthDate === 'string') {
        const p = gp.birthDate.trim()
        const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(p)
        if (m) {
          const [, y, mo, d] = m
          setGuestBirthYear((prev) => prev || y)
          setGuestBirthMonth((prev) => prev || String(Number(mo)))
          setGuestBirthDay((prev) => prev || String(Number(d)))
        }
      }
      if (gp?.gender === 'male' || gp?.gender === 'female') {
        const g = gp.gender
        setGuestProfileGender((prev) => prev || g)
      }
      setHasLoadedOnce(true)
    } catch {
      toast({ title: t.loadError, variant: 'destructive' })
    } finally {
      if (appendOlder) {
        loadingOlderRef.current = false
        setLoadingOlderMessages(false)
      } else {
        loadingCurrentRef.current = false
        if (!silent) setLoading(false)
      }
    }
  }, [
    slug,
    toast,
    t.guestAuthRequiredAfterLimit,
    t.loadError,
    authHeaders,
    captureGuestSessionFromResponse,
    captureGuestAccountFromResponse,
    guestMessagesEquivalent,
    mergeGuestMessages,
  ])

  const loadOlderMessages = useCallback(async () => {
    if (!hasMoreOlderMessages || loadingOlderRef.current) return
    const beforeId = messages[0]?.id
    if (!beforeId) return
    const scroller = chatScrollRef.current
    const prevHeight = scroller?.scrollHeight ?? 0
    const prevTop = scroller?.scrollTop ?? 0
    skipNextAutoScrollRef.current = true
    await load({ beforeId, appendOlder: true })
    if (scroller) {
      requestAnimationFrame(() => {
        const nextHeight = scroller.scrollHeight
        scroller.scrollTop = prevTop + Math.max(0, nextHeight - prevHeight)
      })
    }
  }, [hasMoreOlderMessages, messages, load])

  const dismissGuestProfilePrompt = useCallback(() => {
    try {
      sessionStorage.setItem(`messaging_guest_profile_skip_${slug}`, '1')
    } catch {
      /* ignore */
    }
    setGuestProfileOpen(false)
  }, [slug])

  const saveGuestProfile = useCallback(async () => {
    const birthIso = buildIsoDateFromBirthParts(guestBirthDay, guestBirthMonth, guestBirthYear)
    if (!birthIso || !guestProfileGender) {
      toast({ title: t.guestProfileInvalid, variant: 'destructive' })
      return
    }
    setGuestProfileSaving(true)
    try {
      const res = await fetch(`/api/messaging/guest/${encodeURIComponent(slug)}/profile`, {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ birthDate: birthIso, gender: guestProfileGender }),
      })
      const j = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        toast({ title: j.error || t.loadError, variant: 'destructive' })
        return
      }
      setGuestNeedsProfile(false)
      setGuestProfileOpen(false)
      void load()
    } catch {
      toast({ title: t.loadError, variant: 'destructive' })
    } finally {
      setGuestProfileSaving(false)
    }
  }, [
    slug,
    toast,
    t.loadError,
    t.guestProfileInvalid,
    authHeaders,
    load,
    guestBirthDay,
    guestBirthMonth,
    guestBirthYear,
    guestProfileGender,
  ])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!hasLoadedOnce || authMode !== 'account' || !guestNeedsProfile) {
      if (!guestNeedsProfile) setGuestProfileOpen(false)
      return
    }
    try {
      if (sessionStorage.getItem(`messaging_guest_profile_skip_${slug}`)) return
    } catch {
      /* ignore */
    }
    setGuestProfileOpen(true)
  }, [hasLoadedOnce, authMode, guestNeedsProfile, slug])

  const refreshAuthAndReload = useCallback(async () => {
    try {
      const me = await fetch('/api/auth/me', {
        credentials: 'same-origin',
        headers: { ...authHeaders() },
      })
      const j = me.ok ? ((await me.json()) as { user?: { id?: string } }) : {}
      const uid = j.user?.id ?? null
      setUserId(uid)
      if (uid) {
        setAuthGateRequired(false)
        setAuthMode('account')
      } else {
        setTryOnCreditsBalance(null)
      }
    } catch {
      setUserId(null)
      setTryOnCreditsBalance(null)
    } finally {
      void load()
    }
  }, [authHeaders, load])

  useEffect(() => {
    if (authReady) void load()
  }, [authReady, load])

  useEffect(() => {
    didInitialAutoScrollRef.current = false
    guestChatNearBottomRef.current = true
  }, [slug, userId])

  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === 'hidden') return
      void load({ silent: true })
    }, 18000)
    return () => window.clearInterval(id)
  }, [load])

  useEffect(() => {
    if (!shopTyping) return
    const id = window.setInterval(() => {
      if (document.visibilityState === 'hidden') return
      void load({ silent: true })
    }, 2500)
    return () => window.clearInterval(id)
  }, [shopTyping, load])

  useEffect(() => {
    if (!shopTyping) return
    const ms = Math.max(0, shopTyping.deadline - Date.now())
    const t = window.setTimeout(() => {
      setShopTyping((s) => (s && Date.now() >= s.deadline ? null : s))
    }, ms)
    return () => window.clearTimeout(t)
  }, [shopTyping, shopTyping?.deadline])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(pointer: coarse)')
    const sync = () => {
      setIsTouchDevice(Boolean(mq.matches || navigator.maxTouchPoints > 0))
    }
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const sp = new URLSearchParams(window.location.search)
    const auth = sp.get('auth')
    if (!auth) return
    if (auth === 'ok') {
      setAuthGateRequired(false)
      setAuthMode('account')
      try {
        window.localStorage.setItem(
          MESSAGING_AUTH_SYNC_EVENT_KEY,
          JSON.stringify({ ts: Date.now(), slug })
        )
      } catch {}
      void refreshAuthAndReload()
    }
    sp.delete('auth')
    const next = `${window.location.pathname}${sp.toString() ? `?${sp.toString()}` : ''}`
    window.history.replaceState(null, '', next)
  }, [refreshAuthAndReload, slug])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const onStorage = (e: StorageEvent) => {
      if (e.key !== MESSAGING_AUTH_SYNC_EVENT_KEY) return
      void refreshAuthAndReload()
    }
    const onFocus = () => {
      if (document.visibilityState === 'hidden') return
      const now = Date.now()
      if (now - lastAuthRefreshAtRef.current < 15_000) return
      lastAuthRefreshAtRef.current = now
      void refreshAuthAndReload()
    }
    window.addEventListener('storage', onStorage)
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onFocus)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onFocus)
    }
  }, [refreshAuthAndReload])

  useEffect(() => {
    if (!tryOnUserFile) {
      setTryOnUserPreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(tryOnUserFile)
    setTryOnUserPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [tryOnUserFile])

  useEffect(() => {
    return () => {
      for (const item of tryOnGarmentFiles) {
        if (item.revokeObjectUrl) URL.revokeObjectURL(item.previewUrl)
      }
    }
  }, [tryOnGarmentFiles])

  useEffect(() => {
    if (!tryOnOpen) {
      tryOnPageContextGarmentSeededRef.current = false
      setTryOnOpenedViaEmbedQuery(false)
    }
  }, [tryOnOpen])

  useEffect(() => {
    if (!tryOnUserFile) return
    if (tryOnUserFile.size > TRY_ON_USER_PORTRAIT_STORAGE_MAX_BYTES) return
    const key = tryOnUserPortraitStorageKey(slug)
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const dataUrl = String(reader.result || '')
        if (dataUrl.startsWith('data:image/') && dataUrl.length <= 2_500_000) {
          localStorage.setItem(key, dataUrl)
        }
      } catch {
        /* ignore quota / private mode */
      }
    }
    reader.readAsDataURL(tryOnUserFile)
  }, [tryOnUserFile, slug])

  useEffect(() => {
    if (!tryOnOpen) return
    if (tryOnUserFile) return
    const key = tryOnUserPortraitStorageKey(slug)
    let raw = ''
    try {
      raw = localStorage.getItem(key) ?? ''
    } catch {
      return
    }
    if (!raw.startsWith('data:image/')) return
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch(raw)
        const blob = await res.blob()
        if (!blob.type.startsWith('image/')) return
        if (blob.size > GUEST_IMAGE_MAX_BYTES) return
        if (cancelled) return
        const ext = blob.type.includes('png') ? 'png' : 'jpg'
        const file = new File([blob], `try-on-saved-portrait.${ext}`, { type: blob.type || 'image/jpeg' })
        if (cancelled) return
        setTryOnUserFile(file)
      } catch {
        /* ignore */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [tryOnOpen, tryOnUserFile, slug])

  useEffect(() => {
    if (!tryOnOpen) return
    if (readGuestEmbedGatewayFromUrl() === 'consult') {
      closeEmbedTryOnPanel()
      return
    }
    if (tryOnPageContextGarmentSeededRef.current) return
    const pc = pageContextRef.current
    const imageUrl = pc?.imageUrl?.trim() ?? ''
    if (!imageUrl || !/^https?:\/\//i.test(imageUrl)) {
      tryOnPageContextGarmentSeededRef.current = true
      return
    }
    const sku = pc?.sku?.trim() ?? ''
    const label = sku
      ? t.tryOnEmbedGarmentFromPageWithSku.replace(/\{sku\}/g, sku.slice(0, 128))
      : t.tryOnEmbedGarmentFromPage
    setTryOnGarmentFiles((prev) => {
      if (prev.length >= MAX_TRY_ON_GARMENTS) {
        tryOnPageContextGarmentSeededRef.current = true
        return prev
      }
      if (prev.some((item) => item.sourceUrl === imageUrl)) {
        tryOnPageContextGarmentSeededRef.current = true
        return prev
      }
      tryOnPageContextGarmentSeededRef.current = true
      return [
        ...prev,
        {
          file: null,
          previewUrl: imageUrl,
          sourceUrl: imageUrl,
          sourceLabel: label,
          revokeObjectUrl: false,
        },
      ]
    })
  }, [tryOnOpen, closeEmbedTryOnPanel, t.tryOnEmbedGarmentFromPage, t.tryOnEmbedGarmentFromPageWithSku])

  useEffect(() => {
    if (skipNextAutoScrollRef.current) {
      skipNextAutoScrollRef.current = false
      return
    }
    const anchor = scrollAnchorRef.current
    if (!anchor) return
    const hasBirthdayOnlyGreeting =
      authMode === 'account' &&
      birthdayPromoDiscountPct != null &&
      birthdayPromoDiscountPct > 0 &&
      Boolean(birthdayPromoGreetingAnchoredAt)
    if (!messages.length && !shopTyping && !hasBirthdayOnlyGreeting) return
    const shouldScrollToBottom =
      forceGuestChatScrollToBottomRef.current ||
      !didInitialAutoScrollRef.current ||
      guestChatNearBottomRef.current
    if (!shouldScrollToBottom) return
    forceGuestChatScrollToBottomRef.current = false
    anchor.scrollIntoView({
      block: 'end',
      behavior: didInitialAutoScrollRef.current ? 'smooth' : 'auto',
    })
    didInitialAutoScrollRef.current = true
    guestChatNearBottomRef.current = true
  }, [messages.length, shopTyping, shopTyping?.deadline, authMode, birthdayPromoDiscountPct, birthdayPromoGreetingAnchoredAt])

  const scrollGuestChatToBottomOnce = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const scroll = () => {
      scrollAnchorRef.current?.scrollIntoView({ block: 'end', behavior })
    }
    scroll()
    window.requestAnimationFrame(scroll)
    window.setTimeout(scroll, 220)
  }, [])

  const removeTryOnUserPortrait = useCallback(() => {
    setTryOnUserFile(null)
    try {
      localStorage.removeItem(tryOnUserPortraitStorageKey(slug))
    } catch {
      /* ignore private mode */
    }
    if (tryOnUserInputRef.current) tryOnUserInputRef.current.value = ''
  }, [slug])

  const setTryOnUserFromFile = async (file: File | null) => {
    if (!file) {
      removeTryOnUserPortrait()
      return
    }
    if (!file.type.startsWith('image/')) {
      toast({ title: t.guestImageInvalidType, variant: 'destructive' })
      return
    }
    if (file.size > GUEST_IMAGE_MAX_BYTES) {
      toast({ title: t.guestImageTooLarge, variant: 'destructive' })
      return
    }
    setTryOnUserFile(file)
  }

  const addTryOnGarmentFile = async (file: File | null) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast({ title: t.guestImageInvalidType, variant: 'destructive' })
      return
    }
    if (tryOnGarmentFiles.length >= MAX_TRY_ON_GARMENTS) {
      toast({
        title: t.tryOnGarmentLimitReached.replace('{max}', String(MAX_TRY_ON_GARMENTS)),
        variant: 'destructive',
      })
      return
    }
    if (file.size > GUEST_IMAGE_MAX_BYTES) {
      toast({ title: t.guestImageTooLarge, variant: 'destructive' })
      return
    }
    const previewUrl = URL.createObjectURL(file)
    setTryOnGarmentFiles((prev) => [...prev, { file, previewUrl, revokeObjectUrl: true }])
    setTryOnGarmentPickerOpen(false)
  }

  const addTryOnGarmentFromRecent = (imageUrl: string, name: string) => {
    if (!imageUrl) return
    if (tryOnGarmentFiles.length >= MAX_TRY_ON_GARMENTS) {
      toast({
        title: t.tryOnGarmentLimitReached.replace('{max}', String(MAX_TRY_ON_GARMENTS)),
        variant: 'destructive',
      })
      return
    }
    const exists = tryOnGarmentFiles.some((item) => item.sourceUrl === imageUrl)
    if (exists) return
    setTryOnGarmentFiles((prev) => [
      ...prev,
      { file: null, previewUrl: imageUrl, sourceUrl: imageUrl, sourceLabel: name, revokeObjectUrl: false },
    ])
    setTryOnGarmentPickerOpen(false)
  }

  const removeTryOnGarmentAt = (index: number) => {
    setTryOnGarmentFiles((prev) => {
      const target = prev[index]
      if (target?.revokeObjectUrl) URL.revokeObjectURL(target.previewUrl)
      return prev.filter((_, i) => i !== index)
    })
  }

  const clearAttachment = useCallback(() => {
    setImageStoragePaths([])
    setImagePreviewUrls([])
    setTryOnResultInComposer(false)
    setTryOnComposerLargeOpen(false)
    setTryOnGarmentPickerOpen(false)
    if (galleryInputRef.current) galleryInputRef.current.value = ''
    if (cameraInputRef.current) cameraInputRef.current.value = ''
  }, [])

  const removeAttachmentAt = useCallback((index: number) => {
    setImageStoragePaths((prev) => prev.filter((_, i) => i !== index))
    setImagePreviewUrls((prev) => prev.filter((_, i) => i !== index))
    if (index === 0) {
      setTryOnResultInComposer(false)
      setTryOnComposerLargeOpen(false)
    }
    setTryOnGarmentPickerOpen(false)
  }, [])

  const submitVisionPick = async (messageId: string, inventoryId: string) => {
    setVisionPickBusyId(messageId)
    const baselineLatestOutbound = latestOutboundCursor(messages)
    setShopTyping({
      deadline: Date.now() + FALLBACK_SHOP_TYPING_WAIT_MS,
      baselineLatestOutbound,
    })
    try {
      const res = await fetch(`/api/messaging/guest/${encodeURIComponent(slug)}/vision-pick`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ messageId, inventoryId }),
      })
      captureGuestSessionFromResponse(res)
      captureGuestAccountFromResponse(res)
      const data = (await res.json()) as {
        ok?: boolean
        error?: string
        shopTyping?: { maxWaitMs: number }
        requireAuth?: boolean
      }
      if (res.status === 401) {
        setUserId(null)
        setAuthGateRequired(true)
        setAuthMode('anonymous')
        toast({
          title: t.guestAuthRequiredAfterLimit.replace('{count}', '5'),
          variant: 'destructive',
        })
        return
      }
      if (!res.ok) {
        if (data.requireAuth) {
          setAuthGateRequired(true)
          setAuthMode('anonymous')
          toast({
            title: t.guestAuthRequiredAfterLimit.replace('{count}', '5'),
            variant: 'destructive',
          })
          return
        }
        if (data.error?.startsWith('AUTH_REQUIRED_')) {
          setAuthGateRequired(true)
          setAuthMode('anonymous')
          toast({
            title: t.guestAuthRequiredAfterLimit.replace('{count}', '5'),
            variant: 'destructive',
          })
          return
        }
        toast({
          title: data.error?.startsWith('AUTH_REQUIRED_')
            ? t.guestAuthRequiredAfterLimit.replace('{count}', '5')
            : data.error || t.visionPickError,
          variant: 'destructive',
        })
        return
      }
      const waitMs =
        data.shopTyping?.maxWaitMs && data.shopTyping.maxWaitMs > 0
          ? data.shopTyping.maxWaitMs
          : FALLBACK_SHOP_TYPING_WAIT_MS
      setShopTyping({
        deadline: Date.now() + waitMs,
        baselineLatestOutbound,
      })
      forceGuestChatScrollToBottomRef.current = true
      await load()
    } catch {
      toast({ title: t.visionPickError, variant: 'destructive' })
    } finally {
      setVisionPickBusyId(null)
    }
  }

  const promptLoginForPurchase = useCallback(() => {
    setAuthGateRequired(true)
    toast({
      title: 'Vui lòng đăng nhập Gmail để tạo và lưu đơn hàng.',
      variant: 'destructive',
    })
  }, [toast])

  const toCardFromBuyOption = useCallback((x: BuyProductOption): PartnerAiProductCard => {
    const out: PartnerAiProductCard = {
      name: x.name,
      image_url: x.image_url,
      product_url: x.product_url,
    }
    if (x.price_hint && x.price_hint.trim()) out.price_hint = x.price_hint.trim()
    if (x.sku && x.sku.trim()) out.sku = x.sku.trim().slice(0, 128)
    const inv = (x.inventory_id ?? '').trim()
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(inv)) {
      out.inventory_id = inv
    }
    return out
  }, [])

  /** ViewContent + AddToCart (CAPI + Pixel) — thẻ có UUID kho hoặc URL khớp kho. */
  const fireMetaBuyNowFromProductCard = useCallback(
    (card: PartnerAiProductCard) => {
      if (typeof window === 'undefined') return
      const inv = (card.inventory_id ?? '').trim()
      const pu = (card.product_url ?? '').trim()
      const uuidOk =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(inv)
      if (!uuidOk && !/^https?:\/\//i.test(pu)) return
      const ga4Product = guestCardToTrackingProduct(card)
      trackPartnerSiteViewItem(adsTracking, ga4Product, { skipMeta: true })
      trackPartnerSiteAddToCart(adsTracking, ga4Product, ga4Product.quantity ?? 1, { skipMeta: true })

      void (async () => {
        try {
          const body: { eventSourceUrl: string; inventoryId?: string; productUrl?: string } = {
            eventSourceUrl: window.location.href.slice(0, 4000),
          }
          if (uuidOk) body.inventoryId = inv
          else body.productUrl = pu

          const res = await fetch(
            `/api/messaging/guest/${encodeURIComponent(slug)}/meta-commerce`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body),
            }
          )
          const data = (await res.json().catch(() => null)) as {
            ok?: boolean
            skipped?: boolean
            pixelId?: string
            viewContentEventId?: string
            addToCartEventId?: string
            content_ids?: string[]
            content_name?: string
            content_type?: string
            currency?: string
            value?: number
            remarketing_id?: string
          } | null
          if (!data?.ok || data.skipped) return
          if (
            data.pixelId &&
            data.viewContentEventId &&
            data.addToCartEventId &&
            Array.isArray(data.content_ids) &&
            data.content_name &&
            data.content_type === 'product' &&
            data.currency === 'VND' &&
            typeof data.value === 'number'
          ) {
            fireMetaBuyNowPixelEvents({
              pixelId: data.pixelId,
              viewContentEventId: data.viewContentEventId,
              addToCartEventId: data.addToCartEventId,
              content_ids: data.content_ids,
              content_name: data.content_name,
              content_type: 'product',
              currency: 'VND',
              value: data.value,
              ...(data.remarketing_id ? { remarketing_id: data.remarketing_id } : {}),
            })
          }
        } catch {
          // Meta tùy chọn — không chặn mở form đặt hàng
        }
      })()
    },
    [adsTracking, slug]
  )

  /** Lấy SKU từ kho khi thẻ AI thiếu — chế độ 3 và Meta cần mã đúng. */
  const resolveSkuForGuestPurchase = useCallback(
    async (input: { sku?: string | null; inventory_id?: string; product_url?: string }): Promise<string> => {
      const fromCard = (input.sku ?? '').trim().slice(0, 128)
      if (fromCard) return fromCard
      const invId = (input.inventory_id ?? '').trim()
      const productUrl = (input.product_url ?? '').trim()
      try {
        const q = new URLSearchParams()
        if (invId && INVENTORY_ID_RE.test(invId)) q.set('ids', invId)
        else if (productUrl && /^https?:\/\//i.test(productUrl)) q.set('productUrl', productUrl)
        else return ''
        const res = await fetch(
          `/api/messaging/guest/${encodeURIComponent(slug)}/inventory-cards?${q.toString()}`,
          { credentials: 'same-origin' }
        )
        const data = (await res.json().catch(() => null)) as {
          cards?: Array<{ sku?: string }>
        } | null
        const sku = data?.cards?.[0]?.sku?.trim().slice(0, 128) ?? ''
        return sku
      } catch {
        return ''
      }
    },
    [slug]
  )

  const openGuestPurchaseExternalFromOption = useCallback(
    async (x: BuyProductOption): Promise<boolean> => {
      let sku = (x.sku ?? '').trim().slice(0, 128) || null
      if (guestPurchaseFlow === 'external_cart_url' && !sku) {
        sku =
          (await resolveSkuForGuestPurchase({
            sku: x.sku,
            inventory_id: x.inventory_id,
            product_url: x.product_url,
          })) || null
      }
      const nav = resolveGuestPurchaseButtonUrl(guestPurchaseFlow, guestExternalCartUrlTemplate, {
        product_url: x.product_url ?? '',
        sku,
      })
      if (nav.ok) {
        openGuestProductDetailUrl(nav.url)
        toast({
          title:
            guestPurchaseFlow === 'external_cart_url'
              ? t.purchaseOpenCartUrlToast
              : t.purchaseOpenSiteToast,
        })
        setBuyOptionsOpen(false)
        return true
      }
      if (nav.reason === 'missing_sku') {
        toast({ title: t.purchaseMissingSkuToast, variant: 'destructive' })
      } else if (nav.reason === 'missing_template' || nav.reason === 'invalid_template') {
        toast({ title: t.purchaseMissingCartTemplateToast, variant: 'destructive' })
      } else {
        toast({ title: t.purchaseMissingProductUrlToast, variant: 'destructive' })
      }
      return false
    },
    [guestExternalCartUrlTemplate, guestPurchaseFlow, resolveSkuForGuestPurchase, t]
  )

  const openOrderFormByOption = useCallback(
    async (x: BuyProductOption) => {
      if (guestPurchaseOpensExternalUrl(guestPurchaseFlow)) {
        await openGuestPurchaseExternalFromOption(x)
        return
      }
      const card = toCardFromBuyOption(x)
      void fireMetaBuyNowFromProductCard(card)
      setOrderFormBusy(true)
      try {
        const res = await fetch(`/api/messaging/guest/${encodeURIComponent(slug)}/order`, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify({ productCard: card }),
        })
        captureGuestSessionFromResponse(res)
        captureGuestAccountFromResponse(res)
        const data = (await res.json().catch(() => null)) as
          | { ok?: boolean; error?: string; order?: { id?: string } }
          | null
        if (res.status === 401 || data?.error?.startsWith('AUTH_REQUIRED_')) {
          setUserId(null)
          promptLoginForPurchase()
          return
        }
        if (!res.ok) {
          toast({ title: data?.error || `Không tạo được đơn hàng (mã lỗi ${res.status}).`, variant: 'destructive' })
          return
        }
        const oid = String(data?.order?.id ?? '').trim()
        if (!oid) {
          toast({ title: 'Không tạo được đơn hàng.', variant: 'destructive' })
          return
        }
        const detailRes = await fetch(`/api/messaging/guest/${encodeURIComponent(slug)}/order`, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify({ action: 'product_options', productUrl: x.product_url }),
        })
        captureGuestSessionFromResponse(detailRes)
        captureGuestAccountFromResponse(detailRes)
        const detail = (await detailRes.json().catch(() => null)) as
          | {
              ok?: boolean
              options?: PurchaseOptionsPayload | null
              profile?: { customerName?: string; customerPhone?: string; shippingAddress?: string } | null
            }
          | null
        const localProfile = readLocalOrderProfile()
        const profileName = String(detail?.profile?.customerName ?? '').trim() || localProfile?.customerName || ''
        const profilePhone = String(detail?.profile?.customerPhone ?? '').trim() || localProfile?.customerPhone || ''
        const profileAddress = String(detail?.profile?.shippingAddress ?? '').trim() || localProfile?.shippingAddress || ''
        setOrderName(profileName)
        setOrderPhone(profilePhone)
        setOrderAddress(profileAddress)
        setActiveOrderCard(card)
        setActivePurchaseOptions(detail?.options ?? null)
        setOrderColor('')
        setOrderSelectedColorImgs([])
        setOrderQtyByColorImg({})
        setOrderSizeByColorImg({})
        setOrderSize('')
        setOrderQuantity('1')
        setOrderNote('')
        setActiveOrderId(oid)
        setOrderFormOpen(true)
        setBuyOptionsOpen(false)
        forceGuestChatScrollToBottomRef.current = true
        await load()
      } catch {
        toast({ title: 'Không tạo được đơn hàng.', variant: 'destructive' })
      } finally {
        setOrderFormBusy(false)
      }
    },
    [
      authHeaders,
      captureGuestAccountFromResponse,
      captureGuestSessionFromResponse,
      load,
      promptLoginForPurchase,
      readLocalOrderProfile,
      slug,
      toCardFromBuyOption,
      fireMetaBuyNowFromProductCard,
      toast,
      guestPurchaseFlow,
      guestExternalCartUrlTemplate,
      openGuestPurchaseExternalFromOption,
      t,
    ]
  )

  const maybeOpenBuyOptionsFromInbound = useCallback(async () => {
    if (buyOptionsBusy || orderFormOpen) return
    if (authGateRequired && authMode !== 'account') return
    /** Bỏ tin mở đầu tự động (thường có «đặt hàng») — không coi là khách chủ đích muốn mua. */
    const inbound = [...messages]
      .reverse()
      .find((m) => m.direction === 'inbound' && !isGuestWidgetAutoOpeningMessage(m.raw_payload))
    if (!inbound) return
    if (buyPromptMessageId === inbound.id || isBuyPromptDismissed(slug, inbound.id)) return
    if (!inboundTextLooksLikePurchasePickListIntent(inbound.body ?? '')) return
    const recent = collectRecentSuggestedCardsFromMessages(messages, 80, inbound.id)
    if (!recent.length) {
      setBuyOptions([])
      setBuyOptionsOpen(false)
      setBuyPromptMessageId(inbound.id)
      rememberBuyPromptHandled(slug, inbound.id)
      toast({
        title:
          'Để tư vấn đúng mẫu bạn muốn mua, vui lòng gửi ảnh sản phẩm hoặc mã sản phẩm (SKU) và cho shop biết bạn muốn mua mẫu nào nhé.',
      })
      return
    }
    setBuyOptionsBusy(true)
    try {
      const res = await fetch(`/api/messaging/guest/${encodeURIComponent(slug)}/order`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ action: 'related_products', recentCards: recent.slice(0, 80) }),
      })
      captureGuestSessionFromResponse(res)
      captureGuestAccountFromResponse(res)
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; products?: BuyProductOption[]; error?: string }
        | null
      if (res.status === 401 || data?.error?.startsWith('AUTH_REQUIRED_')) {
        setUserId(null)
        promptLoginForPurchase()
        return
      }
      if (!res.ok || !data?.ok || !Array.isArray(data.products)) return
      setBuyOptions(data.products.slice(0, 20))
      setBuyOptionsOpen(data.products.length > 0)
      setBuyPromptMessageId(inbound.id)
      rememberBuyPromptHandled(slug, inbound.id)
      if (data.products.length === 0) {
        toast({ title: 'Mình chưa thấy sản phẩm phù hợp để lên đơn. Shop tư vấn thêm giúp bạn ngay nhé.' })
      }
    } catch {
      // silent fallback
    } finally {
      setBuyOptionsBusy(false)
    }
  }, [
    authHeaders,
    buyOptionsBusy,
    buyPromptMessageId,
    captureGuestAccountFromResponse,
    captureGuestSessionFromResponse,
    messages,
    authGateRequired,
    authMode,
    orderFormOpen,
    promptLoginForPurchase,
    slug,
    toast,
  ])

  useEffect(() => {
    void maybeOpenBuyOptionsFromInbound()
  }, [maybeOpenBuyOptionsFromInbound])

  /** Mọi nút «Mua» / «Đặt hàng» / «Thêm giỏ» trên thẻ — cùng luồng theo `guestPurchaseFlow`. */
  const triggerGuestProductPurchase = useCallback(
    async (card: PartnerAiProductCard) => {
      const productUrl = (card.product_url ?? '').trim()
      if (!/^https?:\/\//i.test(productUrl)) return
      setBuyOptionsOpen(false)
      const base = guestPurchaseInputFromProductCard(card)
      let sku = base.sku
      if (guestPurchaseFlow === 'external_cart_url' && !sku) {
        const resolved = await resolveSkuForGuestPurchase(base)
        if (resolved) sku = resolved
      }
      await openOrderFormByOption({
        name: base.name,
        image_url: base.image_url,
        product_url: base.product_url,
        price_hint: base.price_hint,
        sku,
        ...(base.inventory_id ? { inventory_id: base.inventory_id } : {}),
      })
    },
    [guestPurchaseFlow, openOrderFormByOption, resolveSkuForGuestPurchase]
  )

  const openGuestProductOrderFormFromCard = triggerGuestProductPurchase

  const cartSubtotal = useMemo(
    () =>
      cartItems.reduce((sum, item) => {
        const price = parseVndFromHint(item.card.price_hint ?? '')
        return sum + Math.max(0, price) * Math.max(1, Math.floor(item.quantity || 1))
      }, 0),
    [cartItems]
  )

  useEffect(() => {
    const key = metaViewContent
      ? `meta|${metaViewContent.eventId}|${metaViewContent.content_ids.join(',')}`
      : ga4InitialViewItem
        ? `ga4|${ga4InitialViewItem.itemId ?? ''}|${ga4InitialViewItem.itemName ?? ''}`
        : ''
    if (!key) return
    if (shopGa4InitialViewItemKeyRef.current === key) return
    shopGa4InitialViewItemKeyRef.current = key
    if (metaViewContent) {
      trackPartnerSiteViewItem(adsTracking, trackingProductFromMetaViewContent(metaViewContent), {
        skipMeta: true,
      })
    } else if (ga4InitialViewItem) {
      trackPartnerSiteViewItem(adsTracking, trackingProductFromGa4Input(ga4InitialViewItem))
    }
  }, [adsTracking, ga4InitialViewItem, metaViewContent])

  const sanitizeCartItemsFromServer = useCallback((raw: unknown): GuestCartItem[] => {
    if (!Array.isArray(raw)) return []
    const out: GuestCartItem[] = []
    for (const item of raw) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) continue
      const o = item as Record<string, unknown>
      const card = o.card
      if (!card || typeof card !== 'object' || Array.isArray(card)) continue
      const c = card as Record<string, unknown>
      const name = typeof c.name === 'string' ? c.name.trim() : ''
      const image_url = typeof c.image_url === 'string' ? c.image_url.trim() : ''
      const product_url = typeof c.product_url === 'string' ? c.product_url.trim() : ''
      if (!name || !/^https?:\/\//i.test(image_url) || !/^https?:\/\//i.test(product_url)) continue
      out.push({
        id: typeof o.id === 'string' && o.id.trim() ? o.id.trim() : `${Date.now()}-${out.length}`,
        card: {
          name,
          image_url,
          product_url,
          ...(typeof c.price_hint === 'string' && c.price_hint.trim() ? { price_hint: c.price_hint.trim() } : {}),
          ...(typeof c.sku === 'string' && c.sku.trim() ? { sku: c.sku.trim() } : {}),
          ...(typeof c.inventory_id === 'string' && c.inventory_id.trim() ? { inventory_id: c.inventory_id.trim() } : {}),
        },
        quantity: Math.max(1, Math.min(99, Math.floor(Number(o.quantity) || 1))),
        color: typeof o.color === 'string' ? o.color : '',
        size: typeof o.size === 'string' ? o.size : '',
        note: typeof o.note === 'string' ? o.note : '',
        variantLineImages: Array.isArray(o.variantLineImages)
          ? o.variantLineImages.filter((u): u is string => typeof u === 'string' && /^https?:\/\//i.test(u.trim()))
          : undefined,
      })
      if (out.length >= 50) break
    }
    return out
  }, [])

  useEffect(() => {
    if (!hasLoadedOnce || authMode !== 'account') {
      if (authMode !== 'account') setCartSyncReady(false)
      return
    }
    let cancelled = false
    setCartSyncReady(false)
    void (async () => {
      try {
        const res = await fetch(`/api/messaging/guest/${encodeURIComponent(slug)}/cart`, {
          method: 'GET',
          credentials: 'same-origin',
          headers: { ...authHeaders() },
        })
        captureGuestSessionFromResponse(res)
        captureGuestAccountFromResponse(res)
        const data = (await res.json().catch(() => null)) as { ok?: boolean; items?: unknown } | null
        if (!cancelled && res.ok && data?.ok) {
          const serverItems = sanitizeCartItemsFromServer(data.items)
          setCartItems((localItems) => {
            if (localItems.length === 0) return serverItems
            const merged = [...serverItems]
            const keyOf = (item: GuestCartItem) =>
              `${item.card.product_url.trim().toLowerCase()}|${item.color.trim()}|${item.size.trim()}`
            const idxByKey = new Map(merged.map((item, idx) => [keyOf(item), idx] as const))
            for (const local of localItems) {
              const key = keyOf(local)
              const idx = idxByKey.get(key)
              if (idx == null) {
                idxByKey.set(key, merged.length)
                merged.push(local)
              } else {
                const current = merged[idx]
                merged[idx] = {
                  ...current,
                  quantity: Math.max(current.quantity, local.quantity),
                  note: current.note || local.note,
                  variantLineImages: current.variantLineImages?.length
                    ? current.variantLineImages
                    : local.variantLineImages,
                }
              }
            }
            return merged
          })
        }
      } finally {
        if (!cancelled) setCartSyncReady(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [
    authHeaders,
    authMode,
    captureGuestAccountFromResponse,
    captureGuestSessionFromResponse,
    hasLoadedOnce,
    sanitizeCartItemsFromServer,
    slug,
  ])

  useEffect(() => {
    if (authMode !== 'account' || !cartSyncReady) return
    if (cartSaveTimerRef.current) clearTimeout(cartSaveTimerRef.current)
    cartSaveTimerRef.current = setTimeout(() => {
      void (async () => {
        try {
          const res = await fetch(`/api/messaging/guest/${encodeURIComponent(slug)}/cart`, {
            method: 'PUT',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json', ...authHeaders() },
            body: JSON.stringify({ items: cartItems }),
          })
          captureGuestSessionFromResponse(res)
          captureGuestAccountFromResponse(res)
        } catch {
          // Cart sync is best-effort; local state remains usable.
        }
      })()
    }, 450)
    return () => {
      if (cartSaveTimerRef.current) clearTimeout(cartSaveTimerRef.current)
    }
  }, [
    authHeaders,
    authMode,
    captureGuestAccountFromResponse,
    captureGuestSessionFromResponse,
    cartItems,
    cartSyncReady,
    slug,
  ])

  useEffect(() => {
    if (typeof window === 'undefined' || window.parent === window) return
    try {
      window.parent.postMessage(
        { source: NANOAI_WIDGET_MSG_SOURCE, type: 'CART_COUNT', count: cartItems.length },
        '*'
      )
    } catch {
      /* ignore */
    }
  }, [cartItems.length])

  useEffect(() => {
    if (typeof window === 'undefined' || window.parent === window) return
    try {
      window.parent.postMessage(
        {
          source: NANOAI_WIDGET_MSG_SOURCE,
          type: 'LOYALTY_STATUS',
          status: guestLoyaltyStatus?.enabled
            ? {
                enabled: true,
                tierCode: guestLoyaltyStatus.tierCode || 'L1',
                tierName: guestLoyaltyStatus.tierName || guestLoyaltyStatus.tierCode || 'L1',
              }
            : { enabled: false },
        },
        '*'
      )
    } catch {
      /* ignore */
    }
  }, [guestLoyaltyStatus])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const onMessage = (event: MessageEvent) => {
      const data = event.data
      if (!data || typeof data !== 'object') return
      if ((data as { source?: unknown }).source !== NANOAI_WIDGET_MSG_SOURCE) return
      const type = (data as { type?: unknown }).type
      if (type === 'OPEN_CART') setCartOpen(true)
      if (type === 'SCROLL_CHAT_BOTTOM') scrollGuestChatToBottomOnce('smooth')
      if (isWidgetTryOnPanelMessage(data)) {
        if (data.type === 'CLOSE_TRY_ON_PANEL') {
          closeEmbedTryOnPanel()
          const pc = pageContextRef.current
          setPendingUrlPageContextChip(hasWidgetPageContextSeed(pc) ? pc : null)
        } else {
          setGuestTryOnUrlFlagCache(slug, true)
          setTryOnOpen(true)
          setTryOnOpenedViaEmbedQuery(true)
          setPendingUrlPageContextChip(null)
        }
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [closeEmbedTryOnPanel, scrollGuestChatToBottomOnce, slug])

  const submitCartCheckout = useCallback(async () => {
    if (cartItems.length === 0) return
    const missing: string[] = []
    if (!orderName.trim()) missing.push('Họ tên')
    if (!orderPhone.trim()) missing.push('Số điện thoại')
    if (!orderAddress.trim()) missing.push('Địa chỉ')
    if (missing.length > 0) {
      toast({ title: `Vui lòng điền: ${missing.join(', ')}`, variant: 'destructive' })
      return
    }
    trackPartnerSiteBeginCheckout(
      adsTracking,
      cartItems.map((item) => guestCardToTrackingProduct(item.card, item.quantity))
    )
    setCartCheckoutBusy(true)
    try {
      const res = await fetch(`/api/messaging/guest/${encodeURIComponent(slug)}/order`, {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          action: 'cart_checkout',
          form: {
            customerName: orderName,
            customerPhone: orderPhone,
            shippingAddress: orderAddress,
            note: orderNote,
          },
          items: cartItems.map((item) => ({
            card: item.card,
            color: item.color,
            size: item.size,
            quantity: item.quantity,
            note: item.note,
            ...(item.variantLineImages ? { variantLineImages: item.variantLineImages } : {}),
          })),
        }),
      })
      captureGuestSessionFromResponse(res)
      captureGuestAccountFromResponse(res)
      const data = (await res.json().catch(() => null)) as {
        ok?: boolean
        error?: string
        order?: GuestOrderGa4Snapshot
        metaPurchase?: {
          pixelId?: string
          eventId?: string
          value?: number
          currency?: string
          content_ids?: string[]
          content_type?: string
          num_items?: number
          contents?: Array<{ id: string; quantity: number; item_price: number; title?: string }>
          order_id?: string
          remarketing_id?: string
        }
      } | null
      if (!res.ok || !data?.ok) {
        toast({ title: data?.error || 'Không tạo được đơn hàng.', variant: 'destructive' })
        return
      }
      const mp = data.metaPurchase
      if (
        mp?.pixelId &&
        mp.eventId &&
        typeof mp.value === 'number' &&
        mp.currency === 'VND' &&
        Array.isArray(mp.content_ids) &&
        mp.content_type === 'product' &&
        typeof mp.num_items === 'number' &&
        Array.isArray(mp.contents) &&
        mp.order_id
      ) {
        const purchasePayload = {
          pixelId: mp.pixelId,
          eventId: mp.eventId,
          value: mp.value,
          currency: 'VND' as const,
          content_ids: mp.content_ids,
          content_type: 'product' as const,
          num_items: mp.num_items,
          contents: mp.contents,
          order_id: mp.order_id,
          ...(mp.remarketing_id ? { remarketing_id: mp.remarketing_id } : {}),
        }
        try {
          fireMetaPurchasePixelEvents(purchasePayload)
        } catch {
          // Meta tùy chọn
        }
        trackPartnerSitePurchase(
          adsTracking,
          {
            transactionId: purchasePayload.order_id,
            value: purchasePayload.value,
            lines: purchasePayload.contents.map((item) => ({
              itemId: item.id,
              itemName: item.title || item.id,
              value: item.item_price,
              quantity: item.quantity,
            })),
          },
          { skipMeta: true }
        )
      } else if (!mp) {
        trackGuestPurchaseFromOrderSnapshot(adsTracking, data.order)
      }
      setCartItems([])
      setCartOpen(false)
      toast({ title: 'Đã tạo đơn hàng từ giỏ.' })
      await load()
    } catch {
      toast({ title: 'Không tạo được đơn hàng.', variant: 'destructive' })
    } finally {
      setCartCheckoutBusy(false)
    }
  }, [
    authHeaders,
    captureGuestAccountFromResponse,
    captureGuestSessionFromResponse,
    cartItems,
    adsTracking,
    load,
    orderAddress,
    orderName,
    orderNote,
    orderPhone,
    slug,
    toast,
  ])

  const fireMetaViewContentOnConsultClick = useCallback(
    (card: PartnerAiProductCard) => {
      if (typeof window === 'undefined') return
      const cookieValue = (name: string): string | null => {
        if (typeof document === 'undefined') return null
        const m = document.cookie.match(new RegExp(`(?:^|; )${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}=([^;]*)`))
        if (!m?.[1]) return null
        try {
          return decodeURIComponent(m[1])
        } catch {
          return m[1]
        }
      }
      const inv = (card.inventory_id ?? '').trim()
      const productUrl = (card.product_url ?? '').trim()
      const uuidOk =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(inv)
      if (!uuidOk && (!productUrl || !/^https?:\/\//i.test(productUrl))) return
      trackPartnerSiteViewItem(adsTracking, guestCardToTrackingProduct(card), { skipMeta: true })

      void (async () => {
        try {
          const body: {
            eventSourcePath: string
            inventoryId?: string
            productUrl?: string
            fbc?: string
            fbp?: string
          } = {
            eventSourcePath: `${window.location.pathname}${window.location.search}`.slice(0, 2000),
          }
          if (uuidOk) body.inventoryId = inv
          else body.productUrl = productUrl
          const fbc = cookieValue('_fbc')
          const fbp = cookieValue('_fbp')
          if (fbc) body.fbc = fbc
          if (fbp) body.fbp = fbp

          const res = await fetch(
            `/api/messaging/guest/${encodeURIComponent(slug)}/meta-view-content`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body),
            }
          )
          const data = (await res.json().catch(() => null)) as {
            ok?: boolean
            skipped?: boolean
            meta?: MetaViewContentClientPayload
          } | null
          if (!data?.ok || data.skipped || !data.meta) return
          fireMetaConsultViewContentPixelEvent(data.meta)
        } catch {
          // Meta tùy chọn — không chặn gửi tin tư vấn
        }
      })()
    },
    [adsTracking, slug]
  )

  const submitProductCardPick = async (card: PartnerAiProductCard, sourceMessageId: string) => {
    void fireMetaViewContentOnConsultClick(card)
    const latestInboundText = [...messages].reverse().find((m) => m.direction === 'inbound')?.body ?? ''
    const intent = classifyOrderIntent(latestInboundText)
    const label = card.name?.trim() || 'mau san pham'
    const productUrl = card.product_url.trim()
    const productKey = normalizeProductUrlKey(productUrl)
    /** Nút «Mua» gọi `openGuestProductOrderFormFromCard`; «Tư vấn» luôn vào nhánh dưới — đã tư vấn vẫn bấm lại (consult-product cache hit DB). */
    if (intent !== 'purchase') {
      setBuyOptionsOpen(false)
      const sku = (card.sku ?? '').trim().slice(0, 128)
      const productRef = sku
        ? t.productConsultProductRefFromSku.replace('{sku}', sku)
        : t.productConsultProductRefFromName.replace('{name}', label)
      const ask =
        intent === 'shipping_policy'
          ? t.productConsultAskShipping.replace('{productRef}', productRef)
          : sku
            ? t.productConsultAskDetailFromSku.replace('{sku}', sku)
            : t.productConsultAskDetail.replace('{productRef}', productRef)
      const imageUrl = (card.image_url ?? '').trim()
      const pageContext: {
        sku?: string
        imageUrl?: string
        productUrl?: string
        inventoryId?: string
        source: string
      } = { source: 'product_card_consult', productUrl }
      if (sku) pageContext.sku = sku
      if (imageUrl && /^https?:\/\//i.test(imageUrl)) pageContext.imageUrl = imageUrl
      const invId = (card.inventory_id ?? '').trim()
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(invId)) {
        pageContext.inventoryId = invId
      }
      const baselineLatestOutbound = latestOutboundCursor(messages)
      scrollGuestChatToBottomOnce('smooth')
      setSending(true)
      try {
        const res = await fetch(`/api/messaging/guest/${encodeURIComponent(slug)}`, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify({
            text: ask,
            pageContext,
            uiLocale,
            landingSourceUrl:
              typeof window !== 'undefined' ? window.location.href.slice(0, 4000) : undefined,
          }),
        })
        captureGuestSessionFromResponse(res)
        captureGuestAccountFromResponse(res)
        const data = (await res.json().catch(() => null)) as {
          error?: string
          shopTyping?: { maxWaitMs: number }
          visionPickRequired?: boolean
        } | null
        if (res.status === 401 || data?.error?.startsWith('AUTH_REQUIRED_')) {
          setUserId(null)
          setAuthGateRequired(true)
          setAuthMode('anonymous')
          toast({
            title: t.guestAuthRequiredAfterLimit.replace('{count}', '5'),
            variant: 'destructive',
          })
          return
        }
        if (!res.ok) {
          toast({ title: data?.error || t.sendError, variant: 'destructive' })
          return
        }
        if (data?.visionPickRequired === true) {
          setShopTyping(null)
        } else {
          const waitMs =
            data?.shopTyping?.maxWaitMs && data.shopTyping.maxWaitMs > 0
              ? data.shopTyping.maxWaitMs
              : FALLBACK_SHOP_TYPING_WAIT_MS
          setShopTyping({
            deadline: Date.now() + waitMs,
            baselineLatestOutbound,
          })
        }
        scrollGuestChatToBottomOnce('smooth')
        setSending(false)
        void (async () => {
          if (productUrl && productKey) {
            try {
              const rec = await fetch(
                `/api/messaging/guest/${encodeURIComponent(slug)}/consult-product`,
                {
                  method: 'POST',
                  credentials: 'same-origin',
                  headers: { 'Content-Type': 'application/json', ...authHeaders() },
                  body: JSON.stringify({
                    productUrlKey: productKey,
                    sourceMessageId: sourceMessageId.trim(),
                  }),
                }
              )
              captureGuestSessionFromResponse(rec)
              captureGuestAccountFromResponse(rec)
            } catch {
              // vẫn cập nhật local + load(); có thể retry sau
            }
          }
          try {
            await load()
            scrollGuestChatToBottomOnce('smooth')
          } catch {
            // Polling sẽ thử lại; không để tác vụ phụ giữ trạng thái gửi.
          }
        })()
      } catch {
        toast({ title: t.sendError, variant: 'destructive' })
      } finally {
        setSending(false)
      }
      return
    }

    await triggerGuestProductPurchase(card)
  }

  const buildCurrentOrderSelection = ():
    | {
        colorPayload: string
        sizePayload: string
        totalQty: number
        variantLineImages?: string[]
        cartLines: CurrentOrderPickedLine[]
      }
    | null => {
    const missing: string[] = []
    const pushMissing = (msg: string) => {
      if (!missing.includes(msg)) missing.push(msg)
    }

    const paletteColors = activePurchaseOptions?.colors
    const hasPalette = Boolean(paletteColors && paletteColors.length > 0)
    const shopSizes = activePurchaseOptions?.sizes ?? []
    const productHasShopSizes = shopSizes.length > 0

    const variantLabel = (imgUrl: string) => {
      const c = findPaletteColorByImageUrl(paletteColors ?? null, imgUrl)
      return (c?.name || '').trim() || 'mẫu đã chọn'
    }

    if (hasPalette && paletteColors) {
      if (orderSelectedColorImgs.length === 0) {
        pushMissing('chọn ít nhất một màu/mẫu (bấm vào ảnh)')
      }
      for (const img of orderSelectedColorImgs) {
        const label = variantLabel(img)
        const q = Math.max(0, parseInt(orderQtyByColorImg[img] || '0', 10) || 0)
        if (q <= 0) pushMissing(`số lượng cho "${label}"`)
        if (productHasShopSizes) {
          const sz = (orderSizeByColorImg[img] ?? '').trim()
          if (!sz) {
            pushMissing(`size cho "${label}" (chọn trong danh sách)`)
          }
        }
      }
    } else {
      if (!orderColor.trim()) pushMissing('màu')
      if (productHasShopSizes && !orderSize.trim()) {
        pushMissing('size (chọn trong danh sách shop)')
      }
      const qtyOne = Math.max(0, parseInt(orderQuantity || '0', 10) || 0)
      if (qtyOne <= 0) pushMissing('số lượng')
    }

    if (missing.length > 0) {
      toast({
        title:
          missing.length === 1
            ? `Thiếu: ${missing[0]}.`
            : `Thiếu các mục sau: ${missing.join('; ')}.`,
        variant: 'destructive',
      })
      return null
    }
    const totalQtyRaw = hasPalette
      ? sumPaletteLineUnits(orderSelectedColorImgs, orderQtyByColorImg)
      : Math.min(99, Math.max(1, parseInt(orderQuantity || '1', 10) || 1))
    /** Luôn là số nguyên 1–99 — tránh JSON.stringify(NaN)→null khiến API coi thiếu SL. */
    const totalQty = Math.max(1, Math.min(99, Math.floor(Number(totalQtyRaw)) || 1))
    let colorPayload = orderColor.trim()
    const cartLines: CurrentOrderPickedLine[] = []
    if (hasPalette && activePurchaseOptions?.colors) {
      const parts: string[] = []
      for (const img of orderSelectedColorImgs) {
        const c = findPaletteColorByImageUrl(activePurchaseOptions.colors, img)
        const n = c?.name?.trim() || 'Mẫu'
        const q = Math.max(1, Math.min(99, parseInt(orderQtyByColorImg[img] || '1', 10) || 1))
        parts.push(`${n}×${q}`)
      }
      colorPayload = parts.join(', ').slice(0, 2000)
    }
    if (!colorPayload.trim()) colorPayload = '-'
    /** Ký tự ASCII — API/DB tránh lỗi với dấu gạch Unicode. */
    const noSizePlaceholder = '-'
    let sizePayload = productHasShopSizes ? orderSize.trim() : noSizePlaceholder
    if (hasPalette && activePurchaseOptions?.colors) {
      const szParts: string[] = []
      for (const img of orderSelectedColorImgs) {
        const c = findPaletteColorByImageUrl(activePurchaseOptions.colors, img)
        const n = c?.name?.trim() || 'Mẫu'
        const q = Math.max(1, Math.min(99, parseInt(orderQtyByColorImg[img] || '1', 10) || 1))
        const sz = productHasShopSizes
          ? (orderSizeByColorImg[img] ?? '').trim()
          : noSizePlaceholder
        szParts.push(`${n}:${sz}`)
        cartLines.push({
          color: n,
          size: sz || noSizePlaceholder,
          quantity: q,
          variantLineImages: [img],
        })
      }
      sizePayload = szParts.join(', ').slice(0, 2000)
    } else {
      cartLines.push({
        color: colorPayload,
        size: sizePayload.trim() || noSizePlaceholder,
        quantity: totalQty,
      })
    }
    return {
      colorPayload,
      sizePayload: sizePayload.trim() || noSizePlaceholder,
      totalQty,
      ...(hasPalette && orderSelectedColorImgs.length > 0
        ? { variantLineImages: orderSelectedColorImgs.slice(0, 24) }
        : {}),
      cartLines,
    }
  }

  const addActiveOrderSelectionToCart = () => {
    if (!activeOrderCard) return
    const picked = buildCurrentOrderSelection()
    if (!picked) return
    setCartItems((prev) => {
      let next = [...prev]
      for (const line of picked.cartLines) {
        const key = `${activeOrderCard.product_url.trim().toLowerCase()}|${line.color}|${line.size}`
        const exists = next.find(
          (item) => `${item.card.product_url.trim().toLowerCase()}|${item.color}|${item.size}` === key
        )
        if (exists) {
          next = next.map((item) =>
            item.id === exists.id
              ? { ...item, quantity: Math.min(99, item.quantity + line.quantity) }
              : item
          )
        } else {
          next.push({
            id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
            card: activeOrderCard,
            quantity: line.quantity,
            color: line.color,
            size: line.size,
            note: orderNote,
            variantLineImages: line.variantLineImages,
          })
        }
      }
      return next
    })
    setOrderFormOpen(false)
    setCartOpen(true)
    toast({ title: 'Đã thêm vào giỏ hàng.' })
  }

  const submitOrderCheckout = async () => {
    const oid = activeOrderId
    if (!oid) return
    const missing: string[] = []
    if (!orderName.trim()) missing.push('họ tên')
    if (!orderPhone.trim()) missing.push('số điện thoại')
    if (!orderAddress.trim()) missing.push('địa chỉ')
    if (missing.length > 0) {
      toast({
        title:
          missing.length === 1
            ? `Thiếu: ${missing[0]}.`
            : `Thiếu các mục sau: ${missing.join('; ')}.`,
        variant: 'destructive',
      })
      return
    }
    const picked = buildCurrentOrderSelection()
    if (!picked) return
    if (activeOrderCard) {
      trackPartnerSiteBeginCheckout(adsTracking, [
        guestCardToTrackingProduct(activeOrderCard, picked.totalQty),
      ])
    }
    setOrderFormBusy(true)
    try {
      const res = await fetch(`/api/messaging/guest/${encodeURIComponent(slug)}/order`, {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          orderId: oid,
          form: {
            customerName: orderName,
            customerPhone: orderPhone,
            shippingAddress: orderAddress,
            color: picked.colorPayload,
            size: picked.sizePayload,
            quantity: picked.totalQty,
            note: orderNote,
            ...(picked.variantLineImages ? { variantLineImages: picked.variantLineImages } : {}),
          },
        }),
      })
      captureGuestSessionFromResponse(res)
      captureGuestAccountFromResponse(res)
      const data = (await res.json()) as {
        ok?: boolean
        error?: string
        order?: GuestOrderGa4Snapshot & {
          required_amount?: number
          payment_qr_url?: string | null
          payment_reference?: string | null
        }
        metaPurchase?: {
          pixelId?: string
          eventId?: string
          value?: number
          currency?: string
          content_ids?: string[]
          content_type?: string
          num_items?: number
          contents?: Array<{ id: string; quantity: number; item_price: number; title?: string }>
          order_id?: string
          remarketing_id?: string
        }
      }
      if (res.status === 401) {
        setUserId(null)
        promptLoginForPurchase()
        return
      }
      if (!res.ok) {
        toast({ title: data.error || `Không cập nhật được đơn hàng (mã lỗi ${res.status}).`, variant: 'destructive' })
        return
      }
      const mp = data.metaPurchase
      if (
        mp?.pixelId &&
        mp.eventId &&
        typeof mp.value === 'number' &&
        mp.currency === 'VND' &&
        Array.isArray(mp.content_ids) &&
        mp.content_type === 'product' &&
        typeof mp.num_items === 'number' &&
        Array.isArray(mp.contents) &&
        mp.order_id
      ) {
        const purchasePayload = {
          pixelId: mp.pixelId,
          eventId: mp.eventId,
          value: mp.value,
          currency: 'VND' as const,
          content_ids: mp.content_ids,
          content_type: 'product' as const,
          num_items: mp.num_items,
          contents: mp.contents,
          order_id: mp.order_id,
          ...(mp.remarketing_id ? { remarketing_id: mp.remarketing_id } : {}),
        }
        try {
          fireMetaPurchasePixelEvents(purchasePayload)
        } catch {
          // Meta tùy chọn
        }
        trackPartnerSitePurchase(
          adsTracking,
          {
            transactionId: purchasePayload.order_id,
            value: purchasePayload.value,
            lines: purchasePayload.contents.map((item) => ({
              itemId: item.id,
              itemName: item.title || item.id,
              value: item.item_price,
              quantity: item.quantity,
            })),
          },
          { skipMeta: true }
        )
      } else if (!mp) {
        trackGuestPurchaseFromOrderSnapshot(adsTracking, data.order)
      }
      saveLocalOrderProfile({
        customerName: orderName,
        customerPhone: orderPhone,
        shippingAddress: orderAddress,
      })
      setOrderFormOpen(false)
      const requiredAmount = Math.max(0, Math.round(Number(data.order?.required_amount) || 0))
      const checkoutSepay = isSepayStyleOrderPayment({
        payment_qr_url: data.order?.payment_qr_url,
        payment_reference: data.order?.payment_reference,
      })
      if (requiredAmount > 0) {
        setProofOrderIsSepay(checkoutSepay)
        setProofOrderId(String(data.order?.id ?? oid))
      } else {
        setProofOrderId(null)
        setProofOrderIsSepay(false)
      }
      forceGuestChatScrollToBottomRef.current = true
      await load()
      toast({
        title:
          requiredAmount > 0
            ? checkoutSepay
              ? 'Đã tạo đơn hàng và QR. Chuyển khoản đúng «Nội dung CK» trong khối thanh toán — xác nhận tự động, không cần gửi ảnh biên lai.'
              : 'Đã tạo đơn hàng và QR. Sau khi chuyển khoản, bấm «Gửi ảnh giao dịch» ngay dưới khối QR trong chat.'
            : 'Đã tạo đơn hàng thành công. Đơn này không yêu cầu đặt cọc trước, khách thanh toán khi nhận hàng.',
      })
    } catch {
      toast({ title: 'Không cập nhật được đơn hàng. Vui lòng thử lại.', variant: 'destructive' })
    } finally {
      setOrderFormBusy(false)
    }
  }

  /** Upload ảnh lên storage guest — dùng cho đính kèm chat và cho luồng biên lai riêng. */
  const uploadGuestImageToStorage = async (file: File): Promise<{ path: string; publicUrl?: string } | null> => {
    if (!file.type.startsWith('image/')) {
      toast({ title: t.guestImageInvalidType, variant: 'destructive' })
      return null
    }
    if (file.size > GUEST_IMAGE_MAX_BYTES) {
      toast({ title: t.guestImageTooLarge, variant: 'destructive' })
      return null
    }
    const fd = new FormData()
    fd.set('file', file)
    const res = await fetch(`/api/messaging/guest/${encodeURIComponent(slug)}/image`, {
      method: 'POST',
      body: fd,
      credentials: 'same-origin',
      headers: { ...authHeaders() },
    })
    captureGuestSessionFromResponse(res)
    const data = (await res.json()) as { path?: string; publicUrl?: string; error?: string; requireAuth?: boolean }
    if (res.status === 401 || data.requireAuth || data.error?.startsWith('AUTH_REQUIRED_')) {
      setUserId(null)
      setAuthGateRequired(true)
      setAuthMode('anonymous')
      toast({
        title: t.guestAuthRequiredAfterLimit.replace('{count}', '5'),
        variant: 'destructive',
      })
      return null
    }
    if (!res.ok || !data.path) {
      const msg = data.error || t.sendError
      if (/large|too large|lớn/i.test(msg)) toast({ title: t.guestImageTooLarge, variant: 'destructive' })
      else if (/type|unsupported|hỗ trợ/i.test(msg)) toast({ title: t.guestImageInvalidType, variant: 'destructive' })
      else toast({ title: msg, variant: 'destructive' })
      return null
    }
    return { path: data.path, publicUrl: data.publicUrl }
  }

  const pickAndVerifyPaymentProof = (orderId: string) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/jpeg,image/png,image/webp,image/gif'
    input.onchange = () => {
      const file = input.files?.[0]
      if (!file) return
      void (async () => {
        setPaymentProofBusyOrderId(orderId)
        try {
          const uploaded = await uploadGuestImageToStorage(file)
          if (!uploaded) return
          const res = await fetch(`/api/messaging/guest/${encodeURIComponent(slug)}/order/verify-payment`, {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json', ...authHeaders() },
            body: JSON.stringify({
              orderId,
              proofImageStoragePath: uploaded.path,
            }),
          })
          captureGuestSessionFromResponse(res)
          const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null
          if (!res.ok) {
            if (res.status === 401 || data?.error?.startsWith('AUTH_REQUIRED_')) {
              setUserId(null)
              promptLoginForPurchase()
              return
            }
            toast({ title: data?.error || 'Không đối chiếu được thanh toán.', variant: 'destructive' })
            return
          }
          forceGuestChatScrollToBottomRef.current = true
          await load()
          setProofOrderId(null)
          setEmbedWidgetDataNonce((n) => n + 1)
          toast({ title: 'Đã gửi biên lai. Kết quả đối chiếu hiển thị trong chat.' })
        } catch {
          toast({ title: 'Không đối chiếu được thanh toán.', variant: 'destructive' })
        } finally {
          setPaymentProofBusyOrderId(null)
        }
      })()
    }
    input.click()
  }

  const orderPaymentProofSlot: OrderPaymentProofSlot = {
    highlightOrderId: proofOrderId,
    busyOrderId: paymentProofBusyOrderId,
    onPickProof: pickAndVerifyPaymentProof,
    onViewOrderDetail: (oid) => setEmbedOrderDetailId(oid),
    paidDepositOrderIds,
    sepayWebhookOrderIds,
  }

  const uploadFiles = async (files: File[], options?: { replace?: boolean }): Promise<string[] | null> => {
    const picked = files.filter(Boolean)
    if (picked.length < 1) return null
    const maxImagesPerMessage = 4
    setUploading(true)
    try {
      const nextPaths = options?.replace ? [] : [...imageStoragePaths]
      const nextPreviews = options?.replace ? [] : [...imagePreviewUrls]
      for (const file of picked) {
        if (nextPaths.length >= maxImagesPerMessage) break
        const data = await uploadGuestImageToStorage(file)
        if (!data) continue
        nextPaths.push(data.path)
        nextPreviews.push(data.publicUrl ?? '')
      }
      if (nextPaths.length < 1) {
        clearAttachment()
        return null
      }
      setImageStoragePaths(nextPaths)
      setImagePreviewUrls(nextPreviews)
      return nextPreviews
    } catch {
      toast({ title: t.sendError, variant: 'destructive' })
      clearAttachment()
      return null
    } finally {
      setUploading(false)
    }
  }

  const onPickGallery = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).slice(0, 4)
    if (files.length > 0) void uploadFiles(files)
  }

  const onPickCamera = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) void uploadFiles([f])
  }

  const onDraftPaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    if (uploading || sending || tryOnBusy) return
    const cd = e.clipboardData
    if (!cd) return
    const attachFirstImage = (f: File | null) => {
      if (!f?.type.startsWith('image/')) return false
      e.preventDefault()
      void uploadFiles([f])
      return true
    }
    const { files, items } = cd
    if (files?.length) {
      for (let i = 0; i < files.length; i++) {
        if (attachFirstImage(files[i])) return
      }
    }
    if (items?.length) {
      for (let i = 0; i < items.length; i++) {
        const it = items[i]
        if (it.kind !== 'file' || !it.type.startsWith('image/')) continue
        if (attachFirstImage(it.getAsFile())) return
      }
    }
  }

  const runTryOn = async () => {
    if (authMode !== 'account') {
      setGuestCreditAuthDialogOpen(true)
      toast({ title: t.guestCreditWalletLoginTitle, description: t.guestCreditWalletLoginDescription })
      return
    }
    if (!userId) {
      toast({ title: t.loginPromptTitle, description: t.loginPromptDescription })
      return
    }
    if (!tryOnUserFile || tryOnGarmentFiles.length === 0) {
      toast({ title: t.tryOnNeedBoth, variant: 'destructive' })
      return
    }
    if (typeof tryOnCreditsBalance === 'number' && tryOnCreditsBalance < TRY_ON_COST_2K) {
      toast({ title: t.toastTryOnInsufficientCredits, variant: 'destructive' })
      void openTopUpPopup()
      return
    }
    setTryOnBusy(true)
    try {
      const fd = new FormData()
      fd.set('userImage', tryOnUserFile)
      tryOnGarmentFiles.forEach((item, idx) => {
        if (item.file) {
          fd.set(`garmentImage${idx}`, item.file)
          return
        }
        if (item.sourceUrl) {
          fd.set(`garmentUrl${idx}`, item.sourceUrl)
        }
      })
      fd.set('garmentCount', String(tryOnGarmentFiles.length))
      fd.set('imageQuality', '2K')

      const res = await fetch(`/api/messaging/guest/${encodeURIComponent(slug)}/try-on`, {
        method: 'POST',
        body: fd,
        credentials: 'same-origin',
        headers: { ...authHeaders() },
      })
      captureGuestSessionFromResponse(res)
      const data = (await res.json()) as {
        ok?: boolean
        resultUrl?: string
        error?: string
        deductedCredits?: number
        creditsRemaining?: number
      }
      if (res.status === 401) {
        setUserId(null)
        setTryOnCreditsBalance(null)
        return
      }
      if (!res.ok || !data.resultUrl) {
        toast({ title: data.error || t.tryOnFailed, variant: 'destructive' })
        return
      }

      // Show generated result immediately while uploading to chat storage.
      setImagePreviewUrls([data.resultUrl])
      setTryOnResultInComposer(true)
      setTryOnComposerLargeOpen(true)

      const imgRes = await fetch(data.resultUrl)
      const blob = await imgRes.blob()
      const file = new File([blob], `try-on-${Date.now()}.png`, { type: blob.type || 'image/png' })
      await uploadFiles([file], { replace: true })
      // Keep panel visible, but clear source selections to avoid sending wrong images.
      setTryOnUserFile(null)
      setTryOnGarmentFiles((prev) => {
        prev.forEach((item) => {
          if (item.revokeObjectUrl) URL.revokeObjectURL(item.previewUrl)
        })
        return []
      })
      setTryOnGarmentPickerOpen(false)
      if (tryOnUserInputRef.current) tryOnUserInputRef.current.value = ''
      if (tryOnGarmentInputRef.current) tryOnGarmentInputRef.current.value = ''
      const remaining =
        typeof data.creditsRemaining === 'number' ? formatCredits(Math.max(0, data.creditsRemaining)) : null
      if (typeof data.creditsRemaining === 'number') {
        setTryOnCreditsBalance(Math.max(0, data.creditsRemaining))
      }
      const deducted =
        typeof data.deductedCredits === 'number' ? formatCredits(Math.max(0, data.deductedCredits)) : formatCredits(TRY_ON_COST_2K)
      toast({
        title: t.tryOnReady,
        description: t.tryOnChargedToast
          .replace('{cost}', deducted)
          .replace('{remaining}', remaining ?? '—'),
      })
    } catch {
      toast({ title: t.tryOnFailed, variant: 'destructive' })
    } finally {
      setTryOnBusy(false)
    }
  }

  const loadTryOnCreditsBalance = useCallback(async () => {
    setTryOnCreditsLoading(true)
    try {
      const res = await fetch('/api/account/credits', {
        method: 'GET',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { ...authHeaders() },
      })
      if (!res.ok) {
        setTryOnCreditsBalance(null)
        if (res.status === 401) {
          // 401 ví credit ≠ mất phiên chat: khách đã OTP vẫn có guest account cookie.
          if (!hasVerifiedGuestAccount()) {
            setAuthGateRequired(true)
            setAuthMode('anonymous')
          }
        }
        return
      }
      const data = (await res.json()) as { balance?: unknown }
      const balance = Number(data.balance)
      setTryOnCreditsBalance(Number.isFinite(balance) ? Math.max(0, balance) : null)
    } catch {
      setTryOnCreditsBalance(null)
    } finally {
      setTryOnCreditsLoading(false)
    }
  }, [authHeaders, hasVerifiedGuestAccount])

  const closeTopUpModal = useCallback(() => {
    setTopUpOpen(false)
    setTopUpPayment(null)
    setTopUpSuccessCountdown(null)
  }, [])

  useEffect(() => {
    if (authMode !== 'account') {
      setTryOnCreditsBalance(null)
      return
    }
    void loadTryOnCreditsBalance()
  }, [authMode, loadTryOnCreditsBalance])

  useEffect(() => {
    if (!tryOnOpen) return
    void loadTryOnCreditsBalance()
  }, [tryOnOpen, loadTryOnCreditsBalance])

  useEffect(() => {
    setPortalMounted(true)
  }, [])

  useEffect(() => {
    if (!topUpOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeTopUpModal()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [topUpOpen, closeTopUpModal])

  useEffect(() => {
    if (!topUpOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [topUpOpen])

  useEffect(() => {
    if (!topUpOpen || !topUpPayment?.id) return
    if (topUpPayment.status === 'completed') return

    const id = topUpPayment.id
    let cancelled = false

    const poll = async () => {
      if (cancelled) return
      try {
        const res = await fetch(`/api/account/payments/${encodeURIComponent(id)}`, {
          credentials: 'same-origin',
          cache: 'no-store',
          headers: { ...authHeaders() },
        })
        const j = (await res.json()) as { payment?: TopUpPayment; error?: string }
        if (!res.ok || !j.payment) return
        setTopUpPayment((prev) => {
          if (!prev || prev.id !== j.payment!.id) return prev
          return { ...prev, ...j.payment }
        })
        if (j.payment.status === 'completed') {
          fireMetaStandardEvent('Subscribe', {
            dedupeKey: `topup_subscribe_${id}`,
            customData: buildNanoAiCreditMetaCustomData({
              amountVnd: Math.max(0, Math.round(Number(j.payment.amount) || 0)),
              creditsAdded: Math.max(0, Math.round(Number(j.payment.credits_added) || 0)),
            }),
          })
          void loadTryOnCreditsBalance()
        }
      } catch {
        /* ignore */
      }
    }

    void poll()
    const iv = window.setInterval(poll, 3000)
    return () => {
      cancelled = true
      window.clearInterval(iv)
    }
  }, [topUpOpen, topUpPayment?.id, topUpPayment?.status, authHeaders, loadTryOnCreditsBalance])

  useEffect(() => {
    if (!topUpOpen || topUpPayment?.status !== 'completed') {
      setTopUpSuccessCountdown(null)
      return
    }

    let remaining = 10
    setTopUpSuccessCountdown(remaining)
    const iv = window.setInterval(() => {
      remaining -= 1
      if (remaining <= 0) {
        window.clearInterval(iv)
        setTopUpOpen(false)
        setTopUpPayment(null)
        setTopUpSuccessCountdown(null)
        return
      }
      setTopUpSuccessCountdown(remaining)
    }, 1000)
    return () => window.clearInterval(iv)
  }, [topUpOpen, topUpPayment?.status, topUpPayment?.id])

  const buildTransferContent = useCallback(() => {
    const suffix = `${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`
    return `SEVQR DH${suffix}`
  }, [])

  const beginTopUpModalFlow = useCallback(async () => {
    setTopUpOpen(true)
    setTopUpPayment(null)
    try {
      const authRes = await fetch('/api/account/credits', {
        method: 'GET',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { ...authHeaders() },
      })
      if (authRes.status === 401) {
        setTopUpOpen(false)
        if (hasVerifiedGuestAccount()) {
          toast({
            title: 'Chưa mở được ví credit. Thử tải lại trang.',
            variant: 'destructive',
          })
        } else {
          setGuestCreditAuthDialogOpen(true)
          toast({
            title: t.toastGuestTopUpLoginRequired,
            variant: 'destructive',
          })
        }
        return
      }
      if (authRes.ok) {
        const authJson = (await authRes.json().catch(() => null)) as { balance?: unknown } | null
        const balance = Number(authJson?.balance)
        setTryOnCreditsBalance(Number.isFinite(balance) ? Math.max(0, balance) : null)
      }
      const res = await fetch('/api/payment-configs', { credentials: 'same-origin', cache: 'no-store' })
      const data = (await res.json().catch(() => null)) as { configs?: TopUpPaymentConfig[]; error?: string } | null
      if (!res.ok || !data?.configs) {
        toast({ title: data?.error || 'Không tải được cấu hình nạp tiền.', variant: 'destructive' })
        return
      }
      const configs = data.configs
      setTopUpConfigs(configs)
      setTopUpSelectedBank((prev) => (prev && configs.some((c) => c.id === prev) ? prev : configs[0]?.id ?? ''))
      void loadTryOnCreditsBalance()
    } catch {
      toast({ title: 'Không tải được cấu hình nạp tiền.', variant: 'destructive' })
    }
  }, [authHeaders, hasVerifiedGuestAccount, loadTryOnCreditsBalance, toast, t.toastGuestTopUpLoginRequired])

  const openTopUpPopup = useCallback(async () => {
    if (authMode !== 'account') {
      setPendingTopUpAfterAuth(true)
      setGuestCreditAuthDialogOpen(true)
      toast({ title: t.toastGuestTopUpLoginRequired })
      return
    }
    await beginTopUpModalFlow()
  }, [authMode, beginTopUpModalFlow, toast, t.toastGuestTopUpLoginRequired])

  useEffect(() => {
    if (authMode !== 'account' || !pendingTopUpAfterAuth) return
    setPendingTopUpAfterAuth(false)
    setGuestCreditAuthDialogOpen(false)
    void beginTopUpModalFlow()
  }, [authMode, pendingTopUpAfterAuth, beginTopUpModalFlow])

  useEffect(() => {
    if (!tryOnOpen) {
      tryOnZeroCreditAutoTopUpRef.current = false
      return
    }
    if (authMode !== 'account' || tryOnCreditsLoading) return
    if (typeof tryOnCreditsBalance !== 'number' || tryOnCreditsBalance >= TRY_ON_COST_2K) return
    if (tryOnZeroCreditAutoTopUpRef.current) return
    tryOnZeroCreditAutoTopUpRef.current = true
    void beginTopUpModalFlow()
  }, [tryOnOpen, authMode, tryOnCreditsBalance, tryOnCreditsLoading, beginTopUpModalFlow])

  const createTopUpPayment = useCallback(async () => {
    const amount = Math.max(1000, Math.round(Number(topUpAmount) || 0))
    const cfg = topUpConfigs.find((x) => x.id === topUpSelectedBank)
    if (!cfg) {
      toast({ title: 'Vui lòng chọn ngân hàng nhận tiền.', variant: 'destructive' })
      return
    }
    const creditsToAdd = Math.floor(amount / CREDIT_UNIT_PRICE_VND)
    if (creditsToAdd < 1) {
      toast({ title: 'Số tiền nạp chưa đủ để quy đổi credit.', variant: 'destructive' })
      return
    }
    const content = buildTransferContent()
    const qrUrl = buildSePayQrImgUrl({
      acc: cfg.bank_account,
      bank: cfg.bank_id,
      amount,
      des: content,
    })
    setTopUpLoading(true)
    try {
      const res = await fetch('/api/account/payments', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          amount,
          credits_added: creditsToAdd,
          transaction_content: content,
          bank_account: cfg.bank_account,
          bank_name: cfg.bank_name,
          qr_url: qrUrl,
        }),
      })
      const data = (await res.json().catch(() => null)) as { payment?: TopUpPayment; error?: string } | null
      if (res.status === 401) {
        if (hasVerifiedGuestAccount()) {
          toast({
            title: 'Chưa mở được ví credit. Thử tải lại trang.',
            variant: 'destructive',
          })
        } else {
          setTopUpOpen(false)
          setGuestCreditAuthDialogOpen(true)
          toast({ title: t.toastGuestTopUpLoginRequired, variant: 'destructive' })
        }
        return
      }
      if (!res.ok || !data?.payment) {
        toast({ title: data?.error || 'Không tạo được yêu cầu nạp tiền.', variant: 'destructive' })
        return
      }
      setTopUpPayment(data.payment)
      toast({ title: 'Đã tạo mã QR nạp credit.' })
      void loadTryOnCreditsBalance()
    } catch {
      toast({ title: 'Không tạo được yêu cầu nạp tiền.', variant: 'destructive' })
    } finally {
      setTopUpLoading(false)
    }
  }, [
    authHeaders,
    buildTransferContent,
    hasVerifiedGuestAccount,
    loadTryOnCreditsBalance,
    toast,
    topUpAmount,
    topUpConfigs,
    topUpSelectedBank,
    t.toastGuestTopUpLoginRequired,
  ])

  const enqueueGuestSend = useCallback((run: () => Promise<void>) => {
    const next = guestMessagePostChainRef.current.then(run)
    guestMessagePostChainRef.current = next.catch(() => {})
    void next
  }, [])

  const submitGuestMessage = useCallback(
    async (text: string, options?: { autoOpening?: boolean }): Promise<boolean> => {
      const trimmed = text.trim()
      const pcSeed = pageContextRef.current
      const hasSeed = hasWidgetPageContextSeed(pcSeed)
      const shouldAttachPageContext =
        !contextSeededRef.current && hasSeed && attachUrlPageContextRef.current
      if (!trimmed && imageStoragePaths.length < 1) {
        if (!hasSeed) return false
        /** Chỉ gửi tin rỗng + ngữ cảnh SP khi khách bấm chip «Gửi mã SP đang xem». */
        if (!attachUrlPageContextRef.current) return false
      }
      if (trimmed) {
        // Customer continues with normal consultation instead of choosing from buy rail.
        setBuyOptionsOpen(false)
      }
      const baselineLatestOutbound = latestOutboundCursor(messages)
      setSending(true)
      try {
        const seedText =
          shouldAttachPageContext && pcSeed ? buildWidgetPageContextInboundText(pcSeed, t) : ''
        const textOut = trimmed || seedText || undefined
        const res = await fetch(`/api/messaging/guest/${encodeURIComponent(slug)}`, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify({
            text: textOut,
            ...(imageStoragePaths.length === 1
              ? { imageStoragePath: imageStoragePaths[0] }
              : imageStoragePaths.length > 1
                ? { imageStoragePaths: imageStoragePaths.slice(0, 4) }
                : {}),
            uiLocale,
            clientHints: options?.autoOpening ? { autoOpening: true } : undefined,
            landingSourceUrl:
              typeof window !== 'undefined' ? window.location.href.slice(0, 4000) : undefined,
            pageContext:
              shouldAttachPageContext && pcSeed
                ? (() => {
                    const ctxImg = (pcSeed.imageUrl ?? '').trim()
                    const ctxImg2 = (pcSeed.imageUrl2 ?? '').trim()
                    const pu = (pcSeed.productUrl ?? '').trim()
                    return {
                      sku: pcSeed.sku,
                      inventoryId: pcSeed.inventoryId,
                      ...(ctxImg ? { imageUrl: ctxImg } : {}),
                      ...(ctxImg2 ? { imageUrl2: ctxImg2 } : {}),
                      ...(pu ? { productUrl: pu } : {}),
                      source: 'widget_page',
                    }
                  })()
                : undefined,
          }),
        })
        captureGuestSessionFromResponse(res)
        const data = (await res.json()) as {
          ok?: boolean
          error?: string
          shopTyping?: { maxWaitMs: number }
          visionPickRequired?: boolean
          paymentVerificationHandled?: boolean
          requireAuth?: boolean
          authMode?: 'anonymous' | 'account'
        }
        if (res.status === 401) {
          setUserId(null)
          return false
        }
        if (!res.ok) {
          if (data.requireAuth) {
            setAuthGateRequired(true)
            toast({
              title: t.guestAuthRequiredAfterLimit.replace('{count}', '5'),
              variant: 'destructive',
            })
            return false
          }
          if (data.error?.startsWith('AUTH_REQUIRED_')) {
            setAuthGateRequired(true)
            toast({
              title: t.guestAuthRequiredAfterLimit.replace('{count}', '5'),
              variant: 'destructive',
            })
            return false
          }
          const msg = data.error || t.sendError
          if (/large|too large|lớn/i.test(msg)) toast({ title: t.guestImageTooLarge, variant: 'destructive' })
          else if (/type|Unsupported|hỗ trợ/i.test(msg)) toast({ title: t.guestImageInvalidType, variant: 'destructive' })
          else toast({ title: msg, variant: 'destructive' })
          return false
        }
        clearAttachment()
        attachUrlPageContextRef.current = false
        if (hasSeed) {
          if (!shouldAttachPageContext) {
            pageContextRef.current = null
          }
          setPendingUrlPageContextChip(null)
          contextSeededRef.current = true
        } else if (pageContextRef.current) {
          contextSeededRef.current = true
        }
        if (shouldAttachPageContext) {
          stripWidgetPageContextParamsFromBrowserUrl()
        }
        if (data.authMode === 'account') {
          setAuthMode('account')
          setAuthGateRequired(false)
          void refreshAuthAndReload()
        }
        if (data.paymentVerificationHandled === true) {
          setProofOrderId(null)
          setShopTyping(null)
          toast({ title: 'Đã gửi biên lai. Kết quả đối chiếu hiển thị trong chat.' })
        } else if (data.visionPickRequired === true) {
          // For image-first flow waiting for customer product selection, do not show "shop is typing" yet.
          setShopTyping(null)
        } else {
          const waitMs =
            data.shopTyping?.maxWaitMs && data.shopTyping.maxWaitMs > 0
              ? data.shopTyping.maxWaitMs
              : FALLBACK_SHOP_TYPING_WAIT_MS
          setShopTyping({
            deadline: Date.now() + waitMs,
            baselineLatestOutbound,
          })
        }
        await load()
        scrollGuestChatToBottomOnce('smooth')
        return true
      } catch {
        toast({ title: t.sendError, variant: 'destructive' })
        return false
      } finally {
        setSending(false)
      }
    },
    [
      authHeaders,
      captureGuestSessionFromResponse,
      clearAttachment,
      scrollGuestChatToBottomOnce,
      imageStoragePaths,
      load,
      messages,
      refreshAuthAndReload,
      setShopTyping,
      slug,
      t,
      toast,
      uiLocale,
    ]
  )

  /** SP từ URL đã có trong hội thoại gần đây — ẩn chip, không gửi trùng. */
  useEffect(() => {
    if (!hasLoadedOnce) return
    if (!pendingUrlPageContextChip) return
    if (!hasWidgetPageContextSeed(pendingUrlPageContextChip)) return
    if (!isPageContextRedundantWithRecentThread(pendingUrlPageContextChip, messages)) return
    pageContextRef.current = null
    setPendingUrlPageContextChip(null)
    contextSeededRef.current = true
  }, [hasLoadedOnce, messages, pendingUrlPageContextChip])

  /** Email CMSN / link có ?interested_inv= & bday_discount= — mở kệ SP + banner ưu đãi. */
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!hasLoadedOnce || !authReady) return
    const q = new URLSearchParams(window.location.search)
    const raw = (q.get('interested_inv') ?? '').trim()
    const discRaw = (q.get('bday_discount') ?? '').trim()
    const disc = parseInt(discRaw, 10)
    if (Number.isFinite(disc) && disc > 0) setBirthdayPromoDiscountPct(disc)
    if (!raw) {
      if (Number.isFinite(disc) && disc > 0) stripWidgetPageContextParamsFromBrowserUrl()
      return
    }

    const sig = `bday_shelf:${slug}:${raw}:${discRaw}`
    try {
      if (window.sessionStorage.getItem(sig) === '1') return
    } catch {
      /* ignore */
    }

    let cancelled = false
    void (async () => {
      try {
        const res = await fetch(
          `/api/messaging/guest/${encodeURIComponent(slug)}/inventory-cards?ids=${encodeURIComponent(raw)}`
        )
        const data = (await res.json().catch(() => null)) as {
          ok?: boolean
          cards?: PartnerAiProductCard[]
        } | null
        if (cancelled || !data?.ok || !Array.isArray(data.cards) || data.cards.length === 0) return
        const rows: RecentProductWithSource[] = data.cards.map((card) => ({
          card,
          sourceMessageId: 'birthday-email',
        }))
        setBirthdayPromoExtraRows(rows)
        setRecentProductsOpen(true)
        try {
          window.sessionStorage.setItem(sig, '1')
        } catch {
          /* ignore */
        }
        stripWidgetPageContextParamsFromBrowserUrl()
        toast({
          title:
            Number.isFinite(disc) && disc > 0
              ? `Ưu đãi sinh nhật: giảm ${disc}% — xem sản phẩm bạn quan tâm bên dưới.`
              : 'Đã mở sản phẩm từ email chúc mừng sinh nhật.',
        })
      } catch {
        /* ignore */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [authReady, hasLoadedOnce, slug, toast])

  /** Đăng nhập email: % giảm CMSN từ server (cùng logic đơn hàng — tự động, không cần ?bday_discount). */
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!hasLoadedOnce || !authReady || authMode !== 'account') return
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch(`/api/messaging/guest/${encodeURIComponent(slug)}/birthday-promo`, {
          credentials: 'same-origin',
        })
        const data = (await res.json().catch(() => null)) as {
          ok?: boolean
          authenticated?: boolean
          discountPercent?: number | null
        } | null
        if (cancelled || !data?.ok) return
        if (data.authenticated) {
          const pct =
            data.discountPercent != null && data.discountPercent > 0 ? data.discountPercent : null
          setBirthdayPromoDiscountPct(pct)
          if (pct == null) {
            setBirthdayPromoGreetingAnchoredAt(null)
            return
          }
          setBirthdayPromoGreetingAnchoredAt((prev) => prev ?? new Date().toISOString())
          try {
            const k = `nanoai_bday_enter_toast_${slug}_${pct}`
            if (!sessionStorage.getItem(k)) {
              sessionStorage.setItem(k, '1')
              forceGuestChatScrollToBottomRef.current = true
              toast({
                title: t.birthdayPromoEnterToastTitle.replace('{percent}', String(pct)),
                description: t.birthdayPromoEnterToastDescription,
              })
            }
          } catch {
            /* ignore */
          }
        }
      } catch {
        /* ignore */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [
    authReady,
    hasLoadedOnce,
    slug,
    authMode,
    toast,
    t.birthdayPromoEnterToastTitle,
    t.birthdayPromoEnterToastDescription,
  ])

  useEffect(() => {
    if (authMode === 'account') return
    setBirthdayPromoGreetingAnchoredAt(null)
    // Không xóa % từ ?bday_discount= (link email CMSN) khi khách chưa đăng nhập.
    if (typeof window === 'undefined') {
      setBirthdayPromoDiscountPct(null)
      return
    }
    const discRaw = (new URLSearchParams(window.location.search).get('bday_discount') ?? '').trim()
    const disc = parseInt(discRaw, 10)
    if (Number.isFinite(disc) && disc > 0) return
    setBirthdayPromoDiscountPct(null)
  }, [authMode])

  const draftComposerLabels = useMemo(
    () => ({
      placeholder: t.placeholder,
      sendKeyboardHint: t.sendKeyboardHint,
      tryOnOpen: t.tryOnOpen,
      guestAttachPhoto: t.guestAttachPhoto,
      guestTakePhoto: t.guestTakePhoto,
      send: t.send,
      guestUploading: t.guestUploading,
    }),
    [t]
  )

  const toggleTryOnPanel = useCallback(() => setTryOnOpen((v) => !v), [])

  const showCameraButton = isTouchDevice

  const requestGuestAuthEmail = async () => {
    const email = guestAuthEmail.trim().toLowerCase()
    if (!email) return
    const browserId = getStableEmailTrustedBrowserId()
    setGuestAuthSending(true)
    try {
      const res = await fetch(`/api/messaging/guest/${encodeURIComponent(slug)}/auth/email/request`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ email, rememberDevice: guestAuthRememberDevice, browserId }),
      })
      captureGuestSessionFromResponse(res)
      captureGuestAccountFromResponse(res)
      const data = (await res.json()) as {
        ok?: boolean
        error?: string
        retry_after_sec?: number
        accountId?: string
        autoSignedIn?: boolean
      }
      if (!res.ok) {
        if (data.error === 'Missing session') {
          toast({ title: t.sendError, variant: 'destructive' })
          await load()
          return
        }
        if (res.status === 429) {
          const waitSec = Number.isFinite(data.retry_after_sec) ? Math.max(1, Math.round(data.retry_after_sec as number)) : 60
          toast({
            title: t.guestAuthRateLimited.replace('{seconds}', String(waitSec)),
            variant: 'destructive',
          })
          return
        }
        toast({ title: data.error || t.sendError, variant: 'destructive' })
        return
      }
      if (data.autoSignedIn) {
        setAuthMode('account')
        setAuthGateRequired(false)
        setGuestAuthOtp('')
        otpLastAutoSubmittedRef.current = ''
        const accountId = typeof data.accountId === 'string' ? data.accountId.trim() : ''
        if (accountId) {
          guestAccountIdRef.current = accountId
          if (typeof window !== 'undefined') {
            window.localStorage.setItem(MESSAGING_GUEST_ACCOUNT_STORAGE_KEY, accountId)
            window.localStorage.setItem(MESSAGING_GUEST_ACCOUNT_STORAGE_KEY_LEGACY, accountId)
          }
        }
        toast({ title: 'Đăng nhập thành công.' })
        setGuestCreditAuthDialogOpen(false)
        await refreshAuthAndReload()
        await load()
        return
      }
      toast({ title: t.guestAuthEmailSent })
    } catch {
      toast({ title: t.sendError, variant: 'destructive' })
    } finally {
      setGuestAuthSending(false)
    }
  }

  const verifyGuestOtp = useCallback(async () => {
    const email = guestAuthEmail.trim().toLowerCase()
    const otp = guestAuthOtp.trim()
    if (!email || otp.length !== 6) return
    const browserId = getStableEmailTrustedBrowserId()
    setGuestAuthVerifying(true)
    try {
      const res = await fetch(`/api/messaging/guest/${encodeURIComponent(slug)}/auth/email/verify-otp`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ email, otp, rememberDevice: guestAuthRememberDevice, browserId }),
      })
      captureGuestSessionFromResponse(res)
      captureGuestAccountFromResponse(res)
      const data = (await res.json()) as {
        ok?: boolean
        error?: string
        retry_after_sec?: number
        accountId?: string
        emailSessionIssued?: boolean
      }
      if (!res.ok || !data.ok) {
        if (res.status === 429) {
          const waitSec = Number.isFinite(data.retry_after_sec) ? Math.max(1, Math.round(data.retry_after_sec as number)) : 60
          toast({
            title: t.guestAuthRateLimited.replace('{seconds}', String(waitSec)),
            variant: 'destructive',
          })
          return
        }
        toast({ title: t.guestAuthOtpInvalid, variant: 'destructive' })
        return
      }
      setAuthMode('account')
      setAuthGateRequired(false)
      setGuestCreditAuthDialogOpen(false)
      setGuestAuthOtp('')
      otpLastAutoSubmittedRef.current = ''
      const accountId = typeof data.accountId === 'string' ? data.accountId.trim() : ''
      if (accountId) {
        guestAccountIdRef.current = accountId
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(MESSAGING_GUEST_ACCOUNT_STORAGE_KEY, accountId)
          window.localStorage.setItem(MESSAGING_GUEST_ACCOUNT_STORAGE_KEY_LEGACY, accountId)
        }
      }
      toast({ title: 'Đăng nhập thành công.' })
      if (data.emailSessionIssued === false) {
        toast({
          title: 'Chat đã sẵn sàng. Nếu số dư vẫn là —, tải lại trang hoặc kiểm tra máy chủ (AUTH_JWT_SECRET).',
          variant: 'destructive',
        })
      }
      await refreshAuthAndReload()
      await load()
    } catch {
      toast({ title: t.guestAuthOtpInvalid, variant: 'destructive' })
    } finally {
      setGuestAuthVerifying(false)
    }
  }, [
    authHeaders,
    captureGuestAccountFromResponse,
    captureGuestSessionFromResponse,
    guestAuthEmail,
    guestAuthRememberDevice,
    guestAuthOtp,
    load,
    refreshAuthAndReload,
    slug,
    t.guestAuthOtpInvalid,
    t.guestAuthRateLimited,
    toast,
  ])
  const activeChatList: ChatRailItem[] = (() => {
    const existing = initialChatList.find((x) => x.slug === slug)
    if (existing) return initialChatList
    const latest = messages[messages.length - 1]
    return [
      {
        conversationId: `current-${slug}`,
        shopName: shopDisplayName,
        slug,
        lastMessageAt: latest?.created_at ?? null,
        lastMessagePreview: latest?.body ?? null,
      },
      ...initialChatList,
    ]
  })()

  useEffect(() => {
    const otp = guestAuthOtp.replace(/\D/g, '').slice(0, 6)
    if (otp !== guestAuthOtp) {
      setGuestAuthOtp(otp)
      return
    }
    if (!authGateRequired || authMode === 'account') return
    if (guestAuthVerifying || guestAuthSending) return
    if (!guestAuthEmail.trim()) return
    if (otp.length !== 6) {
      otpLastAutoSubmittedRef.current = ''
      return
    }
    if (otpLastAutoSubmittedRef.current === otp) return
    otpLastAutoSubmittedRef.current = otp
    void verifyGuestOtp()
  }, [
    authGateRequired,
    authMode,
    guestAuthEmail,
    guestAuthOtp,
    guestAuthSending,
    guestAuthVerifying,
    verifyGuestOtp,
  ])

  const orderPreview = useMemo(() => {
    const palette = activePurchaseOptions?.colors
    const hasPalette = Boolean(palette && palette.length > 0)
    const lineCount = hasPalette ? orderSelectedColorImgs.length : 1
    let totalUnits = 0
    if (hasPalette) {
      totalUnits =
        orderSelectedColorImgs.length === 0 ? 0 : sumPaletteLineUnits(orderSelectedColorImgs, orderQtyByColorImg)
    } else {
      totalUnits = Math.max(1, Math.min(99, Math.floor(Number(orderQuantity) || 1)))
    }
    const paletteDetail =
      hasPalette && orderSelectedColorImgs.length > 0 && palette
        ? orderSelectedColorImgs
            .map((img) => {
              const c = findPaletteColorByImageUrl(palette, img)
              const n = c?.name?.trim() || 'Mẫu'
              const q = Math.max(0, Math.min(99, Math.floor(Number(orderQtyByColorImg[img]) || 0)))
              return `${n}×${q}`
            })
            .join(', ')
        : ''
    const optsHint = activePurchaseOptions?.price_hint?.trim()
    const cardHint = activeOrderCard?.price_hint
    const rawUnit = parseVndFromHint(optsHint || cardHint)
    const unit =
      optsHint && optsHint.length > 0
        ? rawUnit
        : discountVndNumberForBirthday(rawUnit, birthdayPromoDiscountPct)
    const subtotal = Math.max(0, unit * totalUnits)
    const policyMode = activePurchaseOptions?.deposit_policy?.mode ?? 'percent'
    const policyPercent = Math.max(0, Math.min(100, Math.round(Number(activePurchaseOptions?.deposit_policy?.percent) || 30)))
    const policyFixed = Math.max(0, Math.round(Number(activePurchaseOptions?.deposit_policy?.fixed_amount) || 0))
    if (policyMode === 'none') {
      return {
        qty: totalUnits,
        lineCount,
        paletteDetail,
        subtotal,
        prepay: 0,
        cod: subtotal,
        text: 'Không đặt cọc trước (thanh toán khi nhận hàng)',
        canCompute: subtotal > 0,
        depositUi: { kind: 'none' as const },
      }
    }
    if (policyMode === 'fixed_amount') {
      const fallback20 = policyFixed > subtotal && subtotal > 0
      const required = fallback20 ? Math.ceil(subtotal * 0.2) : policyFixed
      return {
        qty: totalUnits,
        lineCount,
        paletteDetail,
        subtotal,
        prepay: required,
        cod: Math.max(0, subtotal - required),
        text: fallback20
          ? 'Tiền cọc vượt tổng đơn, hệ thống áp dụng 20% giá trị đơn'
          : `Đặt cọc cố định ${new Intl.NumberFormat('vi-VN').format(policyFixed)}đ`,
        canCompute: subtotal > 0,
        depositUi: fallback20
          ? ({ kind: 'fixed_fallback20' as const, policyFixed })
          : ({ kind: 'fixed' as const, policyFixed }),
      }
    }
    const required = Math.ceil((subtotal * policyPercent) / 100)
    return {
      qty: totalUnits,
      lineCount,
      paletteDetail,
      subtotal,
      prepay: required,
      cod: Math.max(0, subtotal - required),
      text: `Đặt cọc theo cài đặt shop: ${policyPercent}%`,
      canCompute: subtotal > 0,
      depositUi: { kind: 'percent' as const, policyPercent },
    }
  }, [
    activeOrderCard?.price_hint,
    activePurchaseOptions?.colors,
    activePurchaseOptions?.deposit_policy?.fixed_amount,
    activePurchaseOptions?.deposit_policy?.mode,
    activePurchaseOptions?.deposit_policy?.percent,
    activePurchaseOptions?.price_hint,
    birthdayPromoDiscountPct,
    orderQuantity,
    orderQtyByColorImg,
    orderSelectedColorImgs,
  ])

  const guestMessagesForDisplay = useMemo(() => {
    if (
      authMode !== 'account' ||
      birthdayPromoDiscountPct == null ||
      birthdayPromoDiscountPct <= 0 ||
      !birthdayPromoGreetingAnchoredAt
    ) {
      return messages
    }
    const pct = birthdayPromoDiscountPct
    const shopName = shopDisplayName.trim() || 'Shop'
    let anchorMs = Date.parse(birthdayPromoGreetingAnchoredAt)
    if (!Number.isFinite(anchorMs)) anchorMs = Date.now()
    for (const m of messages) {
      const t0 = Date.parse(m.created_at)
      if (Number.isFinite(t0) && t0 >= anchorMs) anchorMs = t0 + 1
    }
    const greetBody = t.birthdayPromoChatGreeting
      .replaceAll('{shopName}', shopName)
      .replaceAll('{percent}', String(pct))
    const greet: GuestMsg = {
      id: `__local_bday_greet_${slug}`,
      direction: 'outbound',
      body: greetBody,
      created_at: new Date(anchorMs).toISOString(),
      raw_payload: { source: 'birthday_promo_greeting' } as Json,
    }
    return mergeGuestMessages(messages, [greet])
  }, [
    messages,
    authMode,
    birthdayPromoDiscountPct,
    birthdayPromoGreetingAnchoredAt,
    slug,
    shopDisplayName,
    t.birthdayPromoChatGreeting,
    mergeGuestMessages,
  ])

  /** Xen kẽ nền tin shop — phải gọi trước mọi `return` có điều kiện (Rules of Hooks). */
  const shopOutboundStripeById = useMemo(() => {
    const map = new Map<string, 0 | 1>()
    let k = 0
    for (const m of guestMessagesForDisplay) {
      if (m.direction === 'outbound' && !isSystemOrderMessage(m.raw_payload)) {
        map.set(m.id, (k % 2) as 0 | 1)
        k += 1
      }
    }
    return map
  }, [guestMessagesForDisplay])

  const visionReminderTriggerIds = useMemo(() => {
    const out = new Set<string>()
    for (const m of messages) {
      const triggerId = visionReminderTriggerMessageId(m.raw_payload)
      if (triggerId) out.add(triggerId)
    }
    return out
  }, [messages])

  if (!authReady) {
    return (
      <>
        {metaViewContent ? <MetaPixelViewContentTracker payload={metaViewContent} /> : null}
        <div className="flex w-full max-w-lg justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden />
        </div>
      </>
    )
  }

  const topUpModal =
    portalMounted && topUpOpen
      ? createPortal(
          <div
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-3 sm:p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby={
              topUpPayment?.status === 'completed' ? 'guest-top-up-success-title' : 'guest-top-up-title'
            }
            onClick={() => closeTopUpModal()}
          >
            <div
              className="max-h-[min(90dvh,640px)] w-full max-w-md overflow-y-auto rounded-xl border border-border/70 bg-background p-3 shadow-lg"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-2">
                <p
                  id={topUpPayment?.status === 'completed' ? 'guest-top-up-success-title' : 'guest-top-up-title'}
                  className="text-xs font-medium text-foreground"
                >
                  {topUpPayment?.status === 'completed' ? 'Nạp thành công' : 'Nạp credit'}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-6 w-6 shrink-0 p-0"
                  onClick={() => closeTopUpModal()}
                  aria-label="Đóng"
                  title="Đóng"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>

              {topUpPayment?.status === 'completed' ? (
                <div className="mt-4 flex flex-col items-center gap-3 py-2 text-center">
                  <CheckCircle className="h-14 w-14 text-emerald-600" aria-hidden />
                  <p className="text-sm font-semibold text-foreground">Đã nạp credit thành công</p>
                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    Đã cộng{' '}
                    <span className="font-medium text-foreground">
                      {formatCredits(Math.max(0, Number(topUpPayment.credits_added) || 0))} credit
                    </span>{' '}
                    vào ví.
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Số dư hiện tại:{' '}
                    {tryOnCreditsLoading
                      ? '...'
                      : typeof tryOnCreditsBalance === 'number'
                        ? formatCredits(tryOnCreditsBalance)
                        : '--'}{' '}
                    credit
                  </p>
                  {typeof topUpSuccessCountdown === 'number' && topUpSuccessCountdown > 0 ? (
                    <p className="text-[10px] text-muted-foreground">
                      Tự đóng sau {topUpSuccessCountdown}s…
                    </p>
                  ) : null}
                  <Button type="button" size="sm" className="mt-1" onClick={() => closeTopUpModal()}>
                    Đóng
                  </Button>
                </div>
              ) : (
                <>
                  <div className="mt-2 grid grid-cols-2 gap-1.5">
                    <input
                      type="text"
                      className="h-8 rounded-md border border-border bg-background px-2 text-[12px]"
                      value={topUpAmount}
                      onChange={(e) => setTopUpAmount(e.target.value.replace(/[^\d]/g, '').slice(0, 9))}
                      placeholder="Số tiền nạp (VND)"
                    />
                    <select
                      className="h-8 rounded-md border border-border bg-background px-2 text-[12px]"
                      value={topUpSelectedBank}
                      onChange={(e) => setTopUpSelectedBank(e.target.value)}
                    >
                      <option value="">Chọn ngân hàng</option>
                      {topUpConfigs.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.bank_name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="mt-2">
                    <Button
                      type="button"
                      size="sm"
                      disabled={topUpLoading || !topUpSelectedBank || !topUpAmount.trim()}
                      onClick={() => void createTopUpPayment()}
                    >
                      {topUpLoading ? 'Đang tạo mã QR...' : 'Tạo mã QR nạp tiền'}
                    </Button>
                  </div>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    Số dư hiện tại:{' '}
                    {tryOnCreditsLoading
                      ? '...'
                      : (typeof tryOnCreditsBalance === 'number' ? formatCredits(tryOnCreditsBalance) : '--')}{' '}
                    credit
                  </p>
                  {topUpPayment ? (
                    <div className="mt-2 rounded-md border border-border/70 bg-muted/20 p-2">
                      <p className="text-[11px] text-muted-foreground">
                        Nạp {new Intl.NumberFormat('vi-VN').format(topUpPayment.amount)}đ
                        {' '}~ {Math.max(1, Math.floor(topUpPayment.amount / CREDIT_UNIT_PRICE_VND))} credit
                      </p>
                      <p className="mt-1 text-[11px] text-foreground">
                        Nội dung chuyển khoản:{' '}
                        <span className="font-medium">{topUpPayment.transaction_content || '-'}</span>
                      </p>
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        Sau khi chuyển khoản thành công, số dư sẽ cập nhật tự động trong vài giây.
                      </p>
                      {topUpPayment.qr_url ? (
                        <div className="mt-2 flex justify-center">
                          <Image
                            src={topUpPayment.qr_url}
                            alt="QR nạp credit"
                            width={180}
                            height={180}
                            unoptimized
                            className="h-[180px] w-[180px] rounded-md border border-border/70 bg-white object-contain"
                          />
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </>
              )}
            </div>
          </div>,
          document.body
        )
      : null

  const loyaltyTierBadgeText =
    guestLoyaltyStatus?.enabled
      ? (guestLoyaltyStatus.tierName || guestLoyaltyStatus.tierCode || 'L1').trim()
      : ''

  const chatPane = (
    <>
      <Card className="flex h-full min-h-0 flex-col overflow-hidden bg-background rounded-none border-0 shadow-none sm:rounded-2xl sm:border sm:border-border sm:shadow-md">
        <h1 className="sr-only">{shopDisplayName}</h1>
        {isEmbedUi && !guestInIframe ? (
          <div className="relative z-[100] flex shrink-0 flex-nowrap items-center gap-1 overflow-hidden border-b border-border/60 bg-muted/35 px-2 py-1 pointer-events-auto touch-manipulation">
            <p className="min-w-0 max-w-[38%] flex-1 truncate text-xs font-semibold tracking-tight sm:max-w-none sm:text-sm">{shopDisplayName}</p>
            {loyaltyTierBadgeText ? (
              <span className="shrink-0 rounded-full border border-amber-300/80 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold leading-none text-amber-900 shadow-sm dark:border-amber-700/70 dark:bg-amber-950/45 dark:text-amber-100">
                {loyaltyTierBadgeText}
              </span>
            ) : null}
            <div className="ml-auto flex shrink-0 flex-nowrap items-center gap-0.5 sm:gap-1">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8 shrink-0 border-violet-300/80 bg-violet-50/90 text-violet-950 hover:bg-violet-100/90 dark:border-violet-700 dark:bg-violet-950/45 dark:text-violet-50 dark:hover:bg-violet-900/55"
                onClick={() => setEmbedMyOrdersOpen(true)}
                title={orderDetailT.pageTitle}
                aria-label={orderDetailT.pageTitle}
              >
                <Package className="h-3.5 w-3.5" aria-hidden />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="relative h-8 w-8 shrink-0"
                onClick={() => setCartOpen(true)}
                title={t.widgetShoppingCart}
                aria-label={`${t.widgetShoppingCart} (${cartItems.length})`}
              >
                <ShoppingCart className="h-3.5 w-3.5" aria-hidden />
                {cartItems.length > 0 ? (
                  <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-emerald-600 px-0.5 text-[9px] font-bold leading-none text-white">
                    {cartItems.length > 99 ? '99+' : cartItems.length}
                  </span>
                ) : null}
              </Button>
              <GuestChatLocaleSwitches
                currentLocale={uiLocale}
                slug={slug}
                variant="select"
                embedTouchSheet={isEmbedUi}
                languageSelectAriaLabel={t.widgetLanguageSelectAria}
              />
            </div>
          </div>
        ) : !isEmbedUi ? (
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border/60 bg-muted/25 px-2 py-1.5 sm:px-3">
            <div className="flex min-w-0 items-center gap-1">
              {showNanoSiteNav ? (
                <>
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" asChild>
                    <Link href="/" aria-label={t.backHomeAria}>
                      <ArrowLeft className="h-4 w-4" aria-hidden />
                    </Link>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 shrink-0 gap-1 px-2 text-xs font-medium lg:hidden"
                    onClick={() => setNanoToolsSheetOpen(true)}
                    aria-label={t.exploreToolsTitle}
                  >
                    <LayoutGrid className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    <span className="max-w-[9rem] truncate sm:max-w-none">{t.exploreToolsButton}</span>
                  </Button>
                </>
              ) : null}
            </div>
            <GuestChatLocaleSwitches
              currentLocale={uiLocale}
              slug={slug}
              languageSelectAriaLabel={t.widgetLanguageSelectAria}
            />
          </div>
        ) : null}
        <CardContent
          ref={guestChatFocusRootRef}
          className="relative flex min-h-0 flex-1 flex-col overflow-hidden p-0"
          onFocusCapture={syncGuestChatFormFieldFocus}
          onBlurCapture={syncGuestChatFormFieldFocus}
        >
          <div className="relative flex min-h-0 flex-1 flex-col">
          <div
            ref={chatScrollRef}
            className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overflow-x-hidden overscroll-contain break-words bg-muted/20 px-3 py-2 [word-break:break-word]"
            role="log"
            aria-live="polite"
            aria-relevant="additions"
            onScroll={(e) => {
              const el = e.currentTarget
              const fromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
              guestChatNearBottomRef.current = fromBottom <= GUEST_CHAT_STICK_TO_BOTTOM_PX
              if (!hasLoadedOnce || loadingOlderMessages || !hasMoreOlderMessages) return
              if (el.scrollTop <= 120) {
                void loadOlderMessages()
              }
            }}
            style={
              guestChatNarrowLayout
                ? {
                    /** Thanh nhập nằm trong flex (không `fixed`) — chỉ chừa đáy nhẹ cho bubble cuối. */
                    paddingBottom: '0.75rem',
                  }
                : undefined
            }
          >
            {loading && !hasLoadedOnce ? (
              <div className="flex flex-1 items-center justify-center gap-2 text-base text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              </div>
            ) : guestMessagesForDisplay.length === 0 ? (
              <p className="py-8 text-center text-base text-muted-foreground">{t.emptyThread}</p>
            ) : (
              guestMessagesForDisplay.map((m) => {
                const isMe = m.direction === 'inbound' && !isForcedShopSideMessage(m.raw_payload)
                const vs = getVisionPickState(m.raw_payload)
                const reminderTriggerId = visionReminderTriggerMessageId(m.raw_payload)
                const isShopVisionReminder = !isMe && Boolean(reminderTriggerId) && vs.candidates.length > 0
                const hasShopReminderForThisInbound = isMe && visionReminderTriggerIds.has(m.id)
                const consultLinkShopStyle =
                  isMe && vs.candidates.length > 0 && isConsultPageContextInbound(m.raw_payload)
                const isOrderTrackingBubble = !isMe && isSystemOrderMessage(m.raw_payload)
                const shopStripe = !isMe && !isOrderTrackingBubble ? shopOutboundStripeById.get(m.id) ?? 0 : null
                const shopBubbleClass =
                  shopStripe === 1
                    ? 'mr-auto rounded-bl-md border border-violet-200/75 bg-violet-50/95 text-foreground shadow-sm ring-1 ring-violet-500/[0.07] dark:border-violet-800/55 dark:bg-violet-950/45 dark:ring-violet-400/10'
                    : 'mr-auto rounded-bl-md border border-slate-200/85 bg-white text-foreground shadow-sm ring-1 ring-slate-900/[0.04] dark:border-slate-600/65 dark:bg-slate-900/55 dark:ring-white/[0.06]'
                return (
                  <div
                    key={m.id}
                    className={`max-w-[92%] rounded-2xl px-3.5 py-2.5 text-[17px] leading-relaxed sm:text-lg ${
                      consultLinkShopStyle
                        ? shopBubbleClass
                        : isMe
                          ? 'ml-auto rounded-br-md bg-gradient-to-br from-violet-600 to-violet-700 text-white shadow-sm'
                          : isOrderTrackingBubble
                            ? 'mr-auto rounded-bl-md border-2 border-amber-400/70 bg-gradient-to-br from-amber-50 via-orange-50/90 to-amber-100/40 text-foreground shadow-[0_2px_12px_rgba(217,119,6,0.12)] ring-1 ring-amber-300/40 dark:border-amber-500/45 dark:from-amber-950/70 dark:via-orange-950/50 dark:to-amber-950/30 dark:shadow-[0_2px_16px_rgba(0,0,0,0.35)] dark:ring-amber-700/35'
                            : shopBubbleClass
                    }`}
                  >
                    {(() => {
                      if (!consultLinkShopStyle || vs.candidates.length === 0) return null
                      return (
                        <div className="mb-2 space-y-2 border-b border-border/60 pb-2 isolate text-foreground [&_a]:!text-foreground">
                          <div className="-mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]">
                            {vs.candidates.map((c) => {
                              const isSelected = vs.selectedInventoryId === c.inventoryId
                              const isBusy = visionPickBusyId === m.id
                              const puVision = (c.product_url || '').trim()
                              const vk = `${m.id}\u001f${c.inventoryId}`
                              const idVisDetail = `${vk}::detail`
                              const idVisBuy = `${vk}::buy`
                              const idVisConsult = `${vk}::consult`
                              const visionTapped = (id: string) => visionButtonTappedKeys.has(id)
                              const markVisionBtn = (id: string) => {
                                setVisionButtonTappedKeys((prev) => new Set(prev).add(id))
                              }
                              return (
                                <div
                                  key={c.inventoryId}
                                  role="button"
                                  tabIndex={isBusy ? -1 : 0}
                                  aria-disabled={isBusy}
                                  className={`w-36 shrink-0 snap-start overflow-hidden rounded-lg border border-border/60 bg-card text-left text-xs text-foreground shadow-sm transition-all ${
                                    isSelected
                                      ? 'ring-2 ring-primary/30 ring-offset-0 border-primary/45'
                                      : 'hover:border-primary/25'
                                  } ${isBusy ? 'opacity-50' : 'cursor-pointer'}`}
                                  onClick={() => {
                                    if (isBusy) return
                                    void submitVisionPick(m.id, c.inventoryId)
                                  }}
                                  onKeyDown={(ev) => {
                                    if (isBusy) return
                                    if (ev.key === 'Enter' || ev.key === ' ') {
                                      ev.preventDefault()
                                      void submitVisionPick(m.id, c.inventoryId)
                                    }
                                  }}
                                  aria-label={c.name}
                                  aria-pressed={isSelected}
                                  title={c.name}
                                >
                                  {c.image_url ? (
                                    puVision && /^https?:\/\//i.test(puVision.trim()) ? (
                                      <a
                                        href={puVision.trim()}
                                        rel="noopener noreferrer"
                                        className="block w-full outline-none transition-opacity hover:opacity-95 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                                        onClick={(ev) => {
                                          ev.preventDefault()
                                          ev.stopPropagation()
                                          openGuestProductDetailUrl(puVision.trim())
                                        }}
                                        aria-label={`${c.name}. ${t.visionProductViewDetails}`}
                                      >
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                          src={msgImgSrc(c.image_url)}
                                          alt=""
                                          className="h-28 w-full bg-muted/30 object-contain"
                                        />
                                      </a>
                                    ) : (
                                      <button
                                        type="button"
                                        className="block w-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                                        onClick={(ev) => {
                                          ev.stopPropagation()
                                          setChatImageLightboxUrl(msgImgSrc(c.image_url))
                                        }}
                                        aria-label={`Xem ảnh lớn: ${c.name}`}
                                      >
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                          src={msgImgSrc(c.image_url)}
                                          alt=""
                                          className="h-28 w-full bg-muted/30 object-contain"
                                        />
                                      </button>
                                    )
                                  ) : (
                                    <div className="h-28 w-full bg-muted/30" />
                                  )}
                                  <div className="flex flex-col gap-1 px-1.5 py-1.5 text-foreground">
                                    <p
                                      className="w-full min-w-0 truncate text-[11px] tabular-nums leading-none text-muted-foreground"
                                      title={formatVndPriceWithBirthday(c.price_hint, birthdayPromoDiscountPct) ?? undefined}
                                    >
                                      {formatVndPriceWithBirthday(c.price_hint, birthdayPromoDiscountPct) ?? '\u00a0'}
                                    </p>
                                    {puVision && /^https?:\/\//i.test(puVision.trim()) ? (
                                      <a
                                        href={puVision.trim()}
                                        rel="noopener noreferrer"
                                        className={`flex h-8 w-full min-w-0 items-center justify-center rounded-md border px-1 text-[10px] font-semibold leading-snug transition-colors duration-150 active:scale-[0.99] sm:text-[10px] ${
                                          visionTapped(idVisDetail)
                                            ? 'border-emerald-600/45 bg-emerald-100 !text-emerald-950 ring-1 ring-emerald-500/40 dark:bg-emerald-950/50 dark:!text-emerald-50'
                                            : 'border-border/80 bg-background !text-foreground hover:bg-muted/60 hover:!text-foreground'
                                        }`}
                                        onClick={(e) => {
                                          e.preventDefault()
                                          e.stopPropagation()
                                          markVisionBtn(idVisDetail)
                                          openGuestProductDetailUrl(puVision.trim())
                                        }}
                                        aria-label={`${c.name}. ${t.visionProductViewDetails}`}
                                        lang="vi"
                                      >
                                        <span className="block w-full text-center leading-snug [overflow-wrap:anywhere]">
                                          {t.visionProductViewDetails}
                                        </span>
                                      </a>
                                    ) : null}
                                    {puVision && /^https?:\/\//i.test(puVision.trim()) ? (
                                      <div className="grid grid-cols-1 gap-1">
                                        <button
                                          type="button"
                                          disabled={isBusy}
                                          className={`flex h-8 min-w-0 items-center justify-center rounded-md px-1 text-[10px] font-semibold leading-snug transition-colors duration-150 active:scale-[0.99] disabled:pointer-events-none disabled:opacity-50 sm:text-[10px] ${
                                            visionTapped(idVisBuy)
                                              ? 'bg-emerald-600 !text-white ring-1 ring-emerald-500/60'
                                              : 'bg-primary !text-primary-foreground hover:bg-primary/90'
                                          }`}
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            markVisionBtn(idVisBuy)
                                            void triggerGuestProductPurchase({
                                              name: c.name,
                                              image_url: c.image_url,
                                              product_url: puVision.trim(),
                                              inventory_id: c.inventoryId,
                                              ...(c.sku && String(c.sku).trim()
                                                ? { sku: String(c.sku).trim().slice(0, 128) }
                                                : {}),
                                              ...(c.price_hint && String(c.price_hint).trim()
                                                ? { price_hint: String(c.price_hint).trim() }
                                                : {}),
                                            })
                                          }}
                                          aria-label={`${c.name}. ${t.visionProductBuy}`}
                                          aria-pressed={visionTapped(idVisBuy)}
                                          lang="vi"
                                        >
                                          <span className="block w-full text-center leading-snug [overflow-wrap:anywhere]">
                                            {t.visionProductBuy}
                                          </span>
                                        </button>
                                        <button
                                          type="button"
                                          disabled={isBusy}
                                          className="flex h-8 min-w-0 items-center justify-center rounded-md border border-border/80 bg-background px-1 text-[10px] font-semibold leading-snug !text-foreground transition-colors duration-150 hover:bg-muted/60 active:scale-[0.99] disabled:pointer-events-none disabled:opacity-50 sm:text-[10px]"
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            void triggerGuestProductPurchase({
                                              name: c.name,
                                              image_url: c.image_url,
                                              product_url: puVision.trim(),
                                              inventory_id: c.inventoryId,
                                              ...(c.sku && String(c.sku).trim()
                                                ? { sku: String(c.sku).trim().slice(0, 128) }
                                                : {}),
                                              ...(c.price_hint && String(c.price_hint).trim()
                                                ? { price_hint: String(c.price_hint).trim() }
                                                : {}),
                                            })
                                          }}
                                          aria-label={`${c.name}. ${t.guestProductAddToCart}`}
                                          lang="vi"
                                        >
                                          <span className="block w-full text-center leading-snug [overflow-wrap:anywhere]">
                                            {t.guestProductAddToCart}
                                          </span>
                                        </button>
                                        <button
                                          type="button"
                                          disabled={isBusy}
                                          className={`flex h-8 min-w-0 items-center justify-center rounded-md border px-1 text-[10px] font-semibold leading-snug transition-colors duration-150 active:scale-[0.99] sm:text-[10px] disabled:pointer-events-none disabled:opacity-50 ${
                                            visionTapped(idVisConsult)
                                              ? 'border-emerald-600/45 bg-emerald-100 !text-emerald-950 ring-1 ring-emerald-500/40 dark:bg-emerald-950/50 dark:!text-emerald-50'
                                              : 'border-border/80 bg-background !text-foreground hover:bg-muted/60 hover:!text-foreground'
                                          }`}
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            markVisionBtn(idVisConsult)
                                            void submitProductCardPick(
                                              {
                                                name: c.name,
                                                image_url: c.image_url,
                                                product_url: puVision.trim(),
                                                inventory_id: c.inventoryId,
                                                ...(c.sku && String(c.sku).trim()
                                                  ? { sku: String(c.sku).trim().slice(0, 128) }
                                                  : {}),
                                                ...(c.price_hint && String(c.price_hint).trim()
                                                  ? { price_hint: String(c.price_hint).trim() }
                                                  : {}),
                                              },
                                              m.id
                                            )
                                          }}
                                          aria-label={`${c.name}. ${t.visionProductLink}`}
                                          aria-pressed={visionTapped(idVisConsult)}
                                          lang="vi"
                                        >
                                          <span className="block w-full text-center leading-snug [overflow-wrap:anywhere]">
                                            {t.visionProductLink}
                                          </span>
                                        </button>
                                      </div>
                                    ) : null}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                          {visionPickBusyId === m.id ? (
                            <p className="text-[10px] text-muted-foreground">{t.visionPickBusy}</p>
                          ) : null}
                        </div>
                      )
                    })()}
                    <div
                      className={
                        consultLinkShopStyle ? '' : isMe ? '[&_a]:text-white/90 [&_img]:border-white/25' : ''
                      }
                    >
                      <CustomerCareMessageBody
                        row={{ id: m.id, body: m.body, raw_payload: m.raw_payload ?? null }}
                        tone={isMe && !consultLinkShopStyle ? 'onViolet' : 'default'}
                        openMessageLinksInSameTab
                        renderAiProductCarousel={!isMe && !isBirthdayPromoGreetingPayload(m.raw_payload)}
                        labels={{
                          productCardOpenProduct: t.visionProductLink,
                          productCardViewDetails: t.visionProductViewDetails,
                          productCardViewVideo: t.visionProductVideo,
                          productCardCloseVideo: t.visionVideoCloseAria,
                          productCardBuyProduct: t.visionProductBuy,
                          productCardAddToCart: t.guestProductAddToCart,
                        }}
                        onProductCardBuy={
                          isMe && !consultLinkShopStyle
                            ? undefined
                            : isBirthdayPromoGreetingPayload(m.raw_payload)
                              ? undefined
                              : (card) => void triggerGuestProductPurchase(card)
                        }
                        onProductCardAddToCart={
                          isMe && !consultLinkShopStyle
                            ? undefined
                            : isBirthdayPromoGreetingPayload(m.raw_payload)
                              ? undefined
                              : (card) => void triggerGuestProductPurchase(card)
                        }
                        onProductCardPick={
                          isMe && !consultLinkShopStyle
                            ? undefined
                            : isBirthdayPromoGreetingPayload(m.raw_payload)
                              ? undefined
                              : (card) => void submitProductCardPick(card, m.id)
                        }
                        orderPaymentProof={!isMe ? orderPaymentProofSlot : undefined}
                        shopDisplayName={shopDisplayName}
                      />
                    </div>
                    {(() => {
                      /** Chỉ tin shop (nhắc chọn ảnh…); không carousel vision trên bubble khách — «mẫu khác» chờ tin outbound AI. */
                      if (isMe) return null
                      if (vs.candidates.length === 0 || consultLinkShopStyle) return null
                      if (hasShopReminderForThisInbound) return null
                      if (!isShopVisionReminder) return null
                      const pickSourceMessageId = reminderTriggerId ?? m.id
                      return (
                        <div
                          className={`mt-2 space-y-2 border-t pt-2 isolate text-foreground [&_a]:!text-foreground ${
                            isMe ? 'border-white/20' : 'border-border/60'
                          }`}
                        >
                          <div className="-mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]">
                            {vs.candidates.map((c) => {
                              const isSelected = vs.selectedInventoryId === c.inventoryId
                              const isBusy = visionPickBusyId === pickSourceMessageId
                              const puVision = (c.product_url || '').trim()
                              const vk = `${pickSourceMessageId}\u001f${c.inventoryId}`
                              const idVisDetail = `${vk}::detail`
                              const idVisBuy = `${vk}::buy`
                              const idVisConsult = `${vk}::consult`
                              const visionTapped = (id: string) => visionButtonTappedKeys.has(id)
                              const markVisionBtn = (id: string) => {
                                setVisionButtonTappedKeys((prev) => new Set(prev).add(id))
                              }
                              return (
                                <div
                                  key={c.inventoryId}
                                  role="button"
                                  tabIndex={isBusy ? -1 : 0}
                                  aria-disabled={isBusy}
                                  className={`w-36 shrink-0 snap-start overflow-hidden rounded-lg border border-border/60 bg-card text-left text-xs text-foreground shadow-sm transition-all ${
                                    isSelected
                                      ? 'ring-2 ring-primary/30 ring-offset-0 border-primary/45'
                                      : 'hover:border-primary/25'
                                  } ${isBusy ? 'opacity-50' : 'cursor-pointer'}`}
                                  onClick={() => {
                                    if (isBusy) return
                                    void submitVisionPick(pickSourceMessageId, c.inventoryId)
                                  }}
                                  onKeyDown={(ev) => {
                                    if (isBusy) return
                                    if (ev.key === 'Enter' || ev.key === ' ') {
                                      ev.preventDefault()
                                      void submitVisionPick(pickSourceMessageId, c.inventoryId)
                                    }
                                  }}
                                  aria-label={c.name}
                                  aria-pressed={isSelected}
                                  title={c.name}
                                >
                                  {c.image_url ? (
                                    puVision && /^https?:\/\//i.test(puVision.trim()) ? (
                                      <a
                                        href={puVision.trim()}
                                        rel="noopener noreferrer"
                                        className="block w-full outline-none transition-opacity hover:opacity-95 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                                        onClick={(ev) => {
                                          ev.preventDefault()
                                          ev.stopPropagation()
                                          openGuestProductDetailUrl(puVision.trim())
                                        }}
                                        aria-label={`${c.name}. ${t.visionProductViewDetails}`}
                                      >
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                          src={msgImgSrc(c.image_url)}
                                          alt=""
                                          className="h-28 w-full bg-muted/30 object-contain"
                                        />
                                      </a>
                                    ) : (
                                      <button
                                        type="button"
                                        className="block w-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                                        onClick={(ev) => {
                                          ev.stopPropagation()
                                          setChatImageLightboxUrl(msgImgSrc(c.image_url))
                                        }}
                                        aria-label={`Xem ảnh lớn: ${c.name}`}
                                      >
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                          src={msgImgSrc(c.image_url)}
                                          alt=""
                                          className="h-28 w-full bg-muted/30 object-contain"
                                        />
                                      </button>
                                    )
                                  ) : (
                                    <div className="h-28 w-full bg-muted/30" />
                                  )}
                                  <div className="flex flex-col gap-1 px-1.5 py-1.5 text-foreground">
                                    <p
                                      className="w-full min-w-0 truncate text-[11px] tabular-nums leading-none text-muted-foreground"
                                      title={formatVndPriceWithBirthday(c.price_hint, birthdayPromoDiscountPct) ?? undefined}
                                    >
                                      {formatVndPriceWithBirthday(c.price_hint, birthdayPromoDiscountPct) ?? '\u00a0'}
                                    </p>
                                    {puVision && /^https?:\/\//i.test(puVision.trim()) ? (
                                      <a
                                        href={puVision.trim()}
                                        rel="noopener noreferrer"
                                        className={`flex h-8 w-full min-w-0 items-center justify-center rounded-md border px-1 text-[10px] font-semibold leading-snug transition-colors duration-150 active:scale-[0.99] sm:text-[10px] ${
                                          visionTapped(idVisDetail)
                                            ? 'border-emerald-600/45 bg-emerald-100 !text-emerald-950 ring-1 ring-emerald-500/40 dark:bg-emerald-950/50 dark:!text-emerald-50'
                                            : 'border-border/80 bg-background !text-foreground hover:bg-muted/60 hover:!text-foreground'
                                        }`}
                                        onClick={(e) => {
                                          e.preventDefault()
                                          e.stopPropagation()
                                          markVisionBtn(idVisDetail)
                                          openGuestProductDetailUrl(puVision.trim())
                                        }}
                                        aria-label={`${c.name}. ${t.visionProductViewDetails}`}
                                        lang="vi"
                                      >
                                        <span className="block w-full text-center leading-snug [overflow-wrap:anywhere]">
                                          {t.visionProductViewDetails}
                                        </span>
                                      </a>
                                    ) : null}
                                    {puVision && /^https?:\/\//i.test(puVision.trim()) ? (
                                      <div className="grid grid-cols-1 gap-1">
                                        <button
                                          type="button"
                                          disabled={isBusy}
                                          className={`flex h-8 min-w-0 items-center justify-center rounded-md px-1 text-[10px] font-semibold leading-snug transition-colors duration-150 active:scale-[0.99] disabled:pointer-events-none disabled:opacity-50 sm:text-[10px] ${
                                            visionTapped(idVisBuy)
                                              ? 'bg-emerald-600 !text-white ring-1 ring-emerald-500/60'
                                              : 'bg-primary !text-primary-foreground hover:bg-primary/90'
                                          }`}
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            markVisionBtn(idVisBuy)
                                            void triggerGuestProductPurchase({
                                              name: c.name,
                                              image_url: c.image_url,
                                              product_url: puVision.trim(),
                                              inventory_id: c.inventoryId,
                                              ...(c.sku && String(c.sku).trim()
                                                ? { sku: String(c.sku).trim().slice(0, 128) }
                                                : {}),
                                              ...(c.price_hint && String(c.price_hint).trim()
                                                ? { price_hint: String(c.price_hint).trim() }
                                                : {}),
                                            })
                                          }}
                                          aria-label={`${c.name}. ${t.visionProductBuy}`}
                                          aria-pressed={visionTapped(idVisBuy)}
                                          lang="vi"
                                        >
                                          <span className="block w-full text-center leading-snug [overflow-wrap:anywhere]">
                                            {t.visionProductBuy}
                                          </span>
                                        </button>
                                        <button
                                          type="button"
                                          disabled={isBusy}
                                          className="flex h-8 min-w-0 items-center justify-center rounded-md border border-border/80 bg-background px-1 text-[10px] font-semibold leading-snug !text-foreground transition-colors duration-150 hover:bg-muted/60 active:scale-[0.99] disabled:pointer-events-none disabled:opacity-50 sm:text-[10px]"
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            void triggerGuestProductPurchase({
                                              name: c.name,
                                              image_url: c.image_url,
                                              product_url: puVision.trim(),
                                              inventory_id: c.inventoryId,
                                              ...(c.sku && String(c.sku).trim()
                                                ? { sku: String(c.sku).trim().slice(0, 128) }
                                                : {}),
                                              ...(c.price_hint && String(c.price_hint).trim()
                                                ? { price_hint: String(c.price_hint).trim() }
                                                : {}),
                                            })
                                          }}
                                          aria-label={`${c.name}. ${t.guestProductAddToCart}`}
                                          lang="vi"
                                        >
                                          <span className="block w-full text-center leading-snug [overflow-wrap:anywhere]">
                                            {t.guestProductAddToCart}
                                          </span>
                                        </button>
                                        <button
                                          type="button"
                                          disabled={isBusy}
                                          className={`flex h-8 min-w-0 items-center justify-center rounded-md border px-1 text-[10px] font-semibold leading-snug transition-colors duration-150 active:scale-[0.99] sm:text-[10px] disabled:pointer-events-none disabled:opacity-50 ${
                                            visionTapped(idVisConsult)
                                              ? 'border-emerald-600/45 bg-emerald-100 !text-emerald-950 ring-1 ring-emerald-500/40 dark:bg-emerald-950/50 dark:!text-emerald-50'
                                              : 'border-border/80 bg-background !text-foreground hover:bg-muted/60 hover:!text-foreground'
                                          }`}
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            markVisionBtn(idVisConsult)
                                            void submitProductCardPick(
                                              {
                                                name: c.name,
                                                image_url: c.image_url,
                                                product_url: puVision.trim(),
                                                inventory_id: c.inventoryId,
                                                ...(c.sku && String(c.sku).trim()
                                                  ? { sku: String(c.sku).trim().slice(0, 128) }
                                                  : {}),
                                                ...(c.price_hint && String(c.price_hint).trim()
                                                  ? { price_hint: String(c.price_hint).trim() }
                                                  : {}),
                                              },
                                              pickSourceMessageId
                                            )
                                          }}
                                          aria-label={`${c.name}. ${t.visionProductLink}`}
                                          aria-pressed={visionTapped(idVisConsult)}
                                          lang="vi"
                                        >
                                          <span className="block w-full text-center leading-snug [overflow-wrap:anywhere]">
                                            {t.visionProductLink}
                                          </span>
                                        </button>
                                      </div>
                                    ) : null}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                          {visionPickBusyId === pickSourceMessageId ? (
                            <p className={`text-[10px] ${isMe ? 'text-white/80' : 'text-muted-foreground'}`}>
                              {t.visionPickBusy}
                            </p>
                          ) : null}
                        </div>
                      )
                    })()}
                    <div
                      className={`mt-1.5 text-xs ${isMe && !consultLinkShopStyle ? 'text-white/75' : 'text-muted-foreground'}`}
                    >
                      {new Date(m.created_at).toLocaleString()}
                    </div>
                  </div>
                )
              })
            )}
            {loadingOlderMessages ? (
              <div className="mr-auto flex items-center gap-2 rounded-2xl rounded-bl-md border border-border/60 bg-card px-3 py-1.5 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                Đang tải tin cũ...
              </div>
            ) : null}
            {shopTyping ? <GuestShopTypingPill label={t.shopTypingHint} /> : null}
            <div ref={scrollAnchorRef} className="h-px w-full shrink-0" aria-hidden />
          </div>

          {((buyOptionsOpen && buyOptions.length > 0) || orderFormOpen) ? (
            <div
              className="absolute inset-0 z-50 flex min-h-0 flex-col border-b border-border/70 bg-background shadow-[0_-6px_24px_rgba(0,0,0,0.08)] dark:shadow-[0_-6px_24px_rgba(0,0,0,0.35)]"
              role="dialog"
              aria-modal="true"
              aria-label={orderFormOpen ? 'Thông tin nhận hàng' : 'Chọn sản phẩm'}
            >
              <div
                className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-2 [scrollbar-width:thin]"
                style={
                  guestChatNarrowLayout && guestChatKeyboardLiftPx > 0
                    ? {
                        paddingBottom: `calc(0.75rem + max(env(keyboard-inset-height, 0px), min(${guestChatKeyboardLiftPx}px, 55vh)))`,
                      }
                    : undefined
                }
              >
              {buyOptionsOpen && buyOptions.length > 0 && !orderFormOpen ? (
                <div className="space-y-1.5 rounded-lg border border-border/70 bg-muted/20 p-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium text-foreground">Anh/chị muốn mua sản phẩm nào?</p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-6 w-6 p-0"
                      disabled={orderFormBusy}
                      onClick={() => {
                        setBuyOptionsOpen(false)
                        if (buyPromptMessageId) rememberBuyPromptHandled(slug, buyPromptMessageId)
                      }}
                      aria-label="Đóng"
                      title="Đóng"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {buyOptions.map((item) => {
                      const pu = (item.product_url || '').trim()
                      const href = pu && /^https?:\/\//i.test(pu) ? pu : ''
                      return (
                        <div
                          key={`${item.product_url}-${item.name}`}
                          className="flex w-28 shrink-0 flex-col rounded-md border border-border bg-background p-1.5"
                        >
                          {href ? (
                            <a
                              href={href}
                              rel="noopener noreferrer"
                              className="block shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                              aria-label={`Mở trang sản phẩm: ${item.name}`}
                              onClick={(e) => {
                                e.preventDefault()
                                openGuestProductDetailUrl(href)
                              }}
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={msgImgSrc(item.image_url)}
                                alt={item.name}
                                className="h-16 w-full rounded object-cover"
                              />
                            </a>
                          ) : (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                              src={msgImgSrc(item.image_url)}
                              alt={item.name}
                              className="h-16 w-full rounded object-cover"
                            />
                          )}
                          {item.price_hint ? (
                            <p className="mt-1 text-[10px] text-muted-foreground">
                              {formatVndPriceWithBirthday(item.price_hint, birthdayPromoDiscountPct)}
                            </p>
                          ) : null}
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            className="mt-1 h-7 w-full px-1 text-[10px]"
                            disabled={orderFormBusy}
                            onClick={() =>
                              void triggerGuestProductPurchase({
                                name: item.name,
                                image_url: item.image_url,
                                product_url: item.product_url,
                                ...(item.price_hint ? { price_hint: item.price_hint } : {}),
                                ...(item.sku && String(item.sku).trim()
                                  ? { sku: String(item.sku).trim().slice(0, 128) }
                                  : {}),
                                ...(item.inventory_id ? { inventory_id: item.inventory_id } : {}),
                              })
                            }
                          >
                            {t.guestProductPlaceOrder}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="mt-1 h-7 w-full px-1 text-[10px]"
                            disabled={orderFormBusy}
                            onClick={() =>
                              void triggerGuestProductPurchase({
                                name: item.name,
                                image_url: item.image_url,
                                product_url: item.product_url,
                                ...(item.price_hint ? { price_hint: item.price_hint } : {}),
                                ...(item.sku && String(item.sku).trim()
                                  ? { sku: String(item.sku).trim().slice(0, 128) }
                                  : {}),
                                ...(item.inventory_id ? { inventory_id: item.inventory_id } : {}),
                              })
                            }
                          >
                            {t.guestProductAddToCart}
                          </Button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : null}
              {orderFormOpen ? (
                <div className="mt-2 space-y-2 rounded-lg border border-border/70 bg-muted/20 p-2 sm:mt-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-medium text-foreground">Thông tin nhận hàng</p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-6 w-6 p-0"
                      disabled={orderFormBusy}
                      onClick={() => setOrderFormOpen(false)}
                      aria-label="Đóng"
                      title="Đóng"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  {activeOrderCard ? (
                    <div className="rounded-md border border-border/70 bg-background p-2">
                      <div className="flex items-center gap-2">
                        {activeOrderCard.product_url &&
                        /^https?:\/\//i.test(activeOrderCard.product_url.trim()) ? (
                          <a
                            href={activeOrderCard.product_url.trim()}
                            rel="noopener noreferrer"
                            className="shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                            aria-label={`Mở trang sản phẩm: ${activeOrderCard.name}`}
                            onClick={(e) => {
                              e.preventDefault()
                              openGuestProductDetailUrl(activeOrderCard.product_url.trim())
                            }}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={msgImgSrc(activeOrderCard.image_url)}
                              alt={activeOrderCard.name}
                              className="h-10 w-10 rounded object-cover"
                            />
                          </a>
                        ) : (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={msgImgSrc(activeOrderCard.image_url)}
                            alt={activeOrderCard.name}
                            className="h-10 w-10 rounded object-cover"
                          />
                        )}
                        <div className="min-w-0">
                          <p className="truncate text-[12px] font-medium text-foreground">{activeOrderCard.name}</p>
                          {activePurchaseOptions?.sku ? (
                            <p className="text-[10px] text-muted-foreground">Mã sản phẩm: {activePurchaseOptions.sku}</p>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ) : null}
                  <div className="grid grid-cols-2 gap-1.5">
                    <input
                      type="text"
                      className="h-8 rounded-md border border-border bg-background px-2 text-[12px]"
                      placeholder="Họ tên"
                      value={orderName}
                      onChange={(e) => setOrderName(e.target.value)}
                    />
                    <input
                      type="text"
                      className="h-8 rounded-md border border-border bg-background px-2 text-[12px]"
                      placeholder="Số điện thoại"
                      value={orderPhone}
                      onChange={(e) => setOrderPhone(e.target.value)}
                    />
                    <input
                      type="text"
                      className={`h-8 rounded-md border border-border bg-background px-2 text-[12px] ${
                        activePurchaseOptions?.colors && activePurchaseOptions.colors.length > 0 ? 'col-span-2' : ''
                      }`}
                      placeholder="Địa chỉ"
                      value={orderAddress}
                      onChange={(e) => setOrderAddress(e.target.value)}
                    />
                    {!(activePurchaseOptions?.colors && activePurchaseOptions.colors.length > 0) ? (
                      <>
                        <input
                          type="text"
                          className="h-8 rounded-md border border-border bg-background px-2 text-[12px]"
                          placeholder="Màu"
                          value={orderColor}
                          onChange={(e) => setOrderColor(e.target.value)}
                        />
                        {activePurchaseOptions?.sizes && activePurchaseOptions.sizes.length > 0 ? (
                          <Select
                            value={orderSize || '__empty__'}
                            onValueChange={(v) => setOrderSize(v === '__empty__' ? '' : v)}
                          >
                            <SelectTrigger className="h-8 rounded-md border border-border bg-background px-2 text-[12px]">
                              <SelectValue placeholder="Chọn size" />
                            </SelectTrigger>
                            <SelectContent position="popper" side="bottom" sideOffset={4} className="z-[300] max-h-64">
                              <SelectItem value="__empty__">Chọn size</SelectItem>
                              {activePurchaseOptions.sizes.map((s) => (
                                <SelectItem key={s} value={s}>
                                  {s}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : null}
                        <input
                          type="text"
                          className="h-8 rounded-md border border-border bg-background px-2 text-[12px]"
                          placeholder="Số lượng"
                          value={orderQuantity}
                          onChange={(e) => setOrderQuantity(e.target.value)}
                        />
                      </>
                    ) : null}
                  </div>
                  {activePurchaseOptions?.colors && activePurchaseOptions.colors.length > 0 ? (
                    <div className="space-y-1.5">
                      <div>
                        <p className="text-[11px] font-medium text-foreground">Chọn màu / mẫu</p>
                        <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">
                          Bấm vào ảnh sản phẩm để chọn hoặc bỏ chọn. Có thể chọn nhiều màu; sau khi chọn, nhập số
                          lượng
                          {activePurchaseOptions.sizes && activePurchaseOptions.sizes.length > 0
                            ? ' và chọn size ngay dưới ảnh.'
                            : ' ngay dưới ảnh.'}
                        </p>
                      </div>
                      <div className="flex gap-2 overflow-x-auto pb-1">
                      {activePurchaseOptions.colors.map((c, idx) => {
                        const selected = orderSelectedColorImgs.includes(c.img)
                        const lineQty = orderQtyByColorImg[c.img] ?? '1'
                        const lineSize = orderSizeByColorImg[c.img] ?? ''
                        const sizeList = activePurchaseOptions.sizes ?? []
                        const variantLabel = (c.name || '').trim() || 'Mẫu này'
                        return (
                          <div key={`${c.img}-${idx}`} className="flex w-28 shrink-0 flex-col gap-1">
                            <button
                              type="button"
                              aria-pressed={selected}
                              aria-label={
                                selected
                                  ? `Đã chọn ${variantLabel}. Bấm để bỏ chọn`
                                  : `Chọn màu / mẫu: ${variantLabel}`
                              }
                              title={
                                selected ? 'Bấm để bỏ chọn mẫu này' : 'Bấm vào ảnh để chọn màu / mẫu này'
                              }
                              className={`w-full cursor-pointer rounded-md border p-1 text-left transition-colors ${
                                selected
                                  ? 'border-violet-500 bg-violet-50/50 ring-1 ring-violet-200'
                                  : 'border-dashed border-muted-foreground/45 bg-muted/15 hover:border-muted-foreground/70 hover:bg-muted/25'
                              }`}
                              onClick={() => {
                                if (orderSelectedColorImgs.includes(c.img)) {
                                  setOrderSelectedColorImgs((prev) => prev.filter((x) => x !== c.img))
                                  setOrderQtyByColorImg((q) => {
                                    const n = { ...q }
                                    delete n[c.img]
                                    return n
                                  })
                                  setOrderSizeByColorImg((q) => {
                                    const n = { ...q }
                                    delete n[c.img]
                                    return n
                                  })
                                } else {
                                  setOrderSelectedColorImgs((prev) => [...prev, c.img])
                                  setOrderQtyByColorImg((q) => ({ ...q, [c.img]: q[c.img] ?? '1' }))
                                  setOrderSizeByColorImg((q) => ({ ...q, [c.img]: q[c.img] ?? '' }))
                                }
                              }}
                            >
                              <div className="flex h-28 w-full items-center justify-center overflow-hidden rounded bg-muted/40">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={c.img}
                                  alt=""
                                  className="max-h-full max-w-full object-contain object-center"
                                />
                              </div>
                              <p className="mt-0.5 min-h-[2rem] truncate text-center text-[10px] leading-tight">
                                {selected ? (
                                  <span className="font-semibold text-violet-700">Đã chọn</span>
                                ) : (
                                  <span className="block text-muted-foreground">
                                    <span className="font-medium text-foreground/90">Bấm để chọn</span>
                                    {variantLabel !== 'Mẫu này' ? (
                                      <span className="mt-0.5 block truncate text-[9px] normal-case text-muted-foreground">
                                        {variantLabel}
                                      </span>
                                    ) : null}
                                  </span>
                                )}
                              </p>
                            </button>
                            {selected ? (
                              <>
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  className="h-7 w-full rounded border border-border bg-background px-1 text-center text-[10px] tabular-nums"
                                  placeholder="SL"
                                  aria-label={`Số lượng ${c.name || 'mẫu'}`}
                                  value={lineQty}
                                  onChange={(e) =>
                                    setOrderQtyByColorImg((q) => ({ ...q, [c.img]: e.target.value }))
                                  }
                                  onClick={(e) => e.stopPropagation()}
                                />
                                {sizeList.length > 0 ? (
                                  <div
                                    className="w-full"
                                    onClick={(e) => e.stopPropagation()}
                                    onPointerDown={(e) => e.stopPropagation()}
                                    onKeyDown={(e) => e.stopPropagation()}
                                  >
                                    <Select
                                      value={lineSize || '__empty__'}
                                      onValueChange={(v) =>
                                        setOrderSizeByColorImg((q) => ({
                                          ...q,
                                          [c.img]: v === '__empty__' ? '' : v,
                                        }))
                                      }
                                    >
                                      <SelectTrigger
                                        className="h-7 w-full rounded border border-border bg-background px-1 text-[10px]"
                                        aria-label={`Size ${c.name || 'mẫu'}`}
                                      >
                                        <SelectValue placeholder="Size" />
                                      </SelectTrigger>
                                      <SelectContent
                                        position="popper"
                                        side="bottom"
                                        align="start"
                                        sideOffset={4}
                                        className="z-[300] max-h-56 min-w-[var(--radix-select-trigger-width)]"
                                      >
                                        <SelectItem value="__empty__" className="py-1.5 text-[10px]">
                                          Size
                                        </SelectItem>
                                        {sizeList.map((s) => (
                                          <SelectItem key={s} value={s} className="py-1.5 text-[10px]">
                                            {s}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                ) : null}
                              </>
                            ) : null}
                          </div>
                        )
                      })}
                      </div>
                    </div>
                  ) : null}
                  <textarea
                    className="min-h-[56px] w-full rounded-md border border-border bg-background px-2 py-1 text-[12px]"
                    placeholder="Ghi chú"
                    value={orderNote}
                    onChange={(e) => setOrderNote(e.target.value)}
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Tiền đặt cọc được tính tự động theo cài đặt của shop.
                    {orderPreview.paletteDetail || orderPreview.qty !== 1 ? (
                      <>
                        {' '}
                        Tạm tính ({orderPreview.qty} sản phẩm
                        {orderPreview.paletteDetail ? `: ${orderPreview.paletteDetail}` : ''}).
                      </>
                    ) : null}
                  </p>
                  <div className="space-y-0.5 rounded-md border border-violet-200 bg-violet-50/70 px-2 py-1.5 text-[11px] leading-snug text-violet-900">
                    <p className="tabular-nums">
                      Tổng đơn: {new Intl.NumberFormat('vi-VN').format(orderPreview.subtotal)}đ
                      {!orderPreview.canCompute ? (
                        <span className="text-[10px] font-normal text-violet-800">
                          {' '}
                          (chưa xác định được giá sản phẩm để tạm tính)
                        </span>
                      ) : null}
                    </p>
                    <p className="tabular-nums">
                      {orderPreview.depositUi.kind === 'none' ? (
                        <>Không thanh toán trước — đặt cọc 0đ</>
                      ) : orderPreview.depositUi.kind === 'percent' ? (
                        <>
                          Đặt cọc {orderPreview.depositUi.policyPercent}%:{' '}
                          {new Intl.NumberFormat('vi-VN').format(orderPreview.prepay)}đ
                        </>
                      ) : orderPreview.depositUi.kind === 'fixed' ? (
                        <>
                          Đặt cọc (cố định{' '}
                          {new Intl.NumberFormat('vi-VN').format(orderPreview.depositUi.policyFixed)}đ):{' '}
                          {new Intl.NumberFormat('vi-VN').format(orderPreview.prepay)}đ
                        </>
                      ) : (
                        <>
                          Đặt cọc 20%: {new Intl.NumberFormat('vi-VN').format(orderPreview.prepay)}đ
                          <span className="text-[10px] font-normal text-violet-800">
                            {' '}
                            (mức cố định vượt tổng đơn)
                          </span>
                        </>
                      )}
                    </p>
                    <p className="tabular-nums">
                      Thanh toán khi nhận hàng: {new Intl.NumberFormat('vi-VN').format(orderPreview.cod)}đ
                    </p>
                  </div>
                  <div className="flex gap-1.5">
                    <Button
                      type="button"
                      size="sm"
                      className="h-8 text-[11px]"
                      disabled={orderFormBusy}
                      onClick={() => void submitOrderCheckout()}
                    >
                      {orderFormBusy
                        ? (orderPreview.prepay > 0 ? 'Đang tạo QR...' : 'Đang tạo đơn...')
                        : (orderPreview.prepay > 0 ? 'Tạo đơn và QR' : 'Tạo đơn (thanh toán khi nhận hàng)')}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 text-[11px]"
                      disabled={orderFormBusy}
                      onClick={addActiveOrderSelectionToCart}
                    >
                      <ShoppingCart className="mr-1.5 h-3.5 w-3.5" />
                      Thêm vào giỏ
                    </Button>
                  </div>
                </div>
              ) : null}
              </div>
            </div>
          ) : null}
          </div>

            <div
              className={`space-y-2 border-t border-border bg-background px-2 pt-2 sm:px-3 ${
                guestChatNarrowLayout
                  ? 'relative z-40 w-full shrink-0 shadow-[0_-8px_32px_rgba(0,0,0,0.12)] backdrop-blur-sm supports-[backdrop-filter]:bg-background/95 dark:shadow-[0_-8px_32px_rgba(0,0,0,0.45)]'
                  : 'shrink-0 shadow-[0_-6px_28px_rgba(0,0,0,0.1)] dark:shadow-[0_-6px_28px_rgba(0,0,0,0.45)]'
              }`}
              style={{
                /**
                 * WebView/Facebook in-app có máy không co layout khi bàn phím mở:
                 * dịch toàn bộ composer lên trên bàn phím để ô nhập không bị che.
                 */
                transform:
                  guestChatShouldTranslateComposer
                    ? `translateY(calc(-1 * (min(${guestChatKeyboardLiftPx}px, ${guestChatKeyboardUaProfile.transformCapVh}vh) + 3mm)))`
                    : undefined,
                willChange: guestChatShouldTranslateComposer ? 'transform' : undefined,
                paddingBottom:
                  guestChatShouldTranslateComposer
                    ? '0px'
                    : 'max(0.5rem, env(safe-area-inset-bottom, 0px))',
              }}
            >
            {birthdayPromoDiscountPct != null && birthdayPromoDiscountPct > 0 ? (
              <div
                role="status"
                className="rounded-lg border border-violet-200/90 bg-violet-50/95 px-3 py-2 text-center text-[13px] font-medium text-violet-950 dark:border-violet-800/60 dark:bg-violet-950/50 dark:text-violet-100"
              >
                {t.birthdayPromoComposerHint.replace('{percent}', String(birthdayPromoDiscountPct))}
              </div>
            ) : null}
            <input
              ref={galleryInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              multiple
              className="hidden"
              onChange={onPickGallery}
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={onPickCamera}
            />

            {pendingUrlPageContextChip && hasWidgetPageContextSeed(pendingUrlPageContextChip) ? (
              <div className="relative w-full max-w-full rounded-xl border border-violet-200/80 bg-violet-50/90 shadow-sm dark:border-violet-800/60 dark:bg-violet-950/40">
                <button
                  type="button"
                  className="absolute right-1 top-1 z-10 flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-background/90 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/80 dark:hover:bg-violet-900/60"
                  aria-label={t.urlProductContextChipDismissAria}
                  title={t.urlProductContextChipDismissAria}
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    pageContextRef.current = null
                    setPendingUrlPageContextChip(null)
                    contextSeededRef.current = true
                  }}
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
                <button
                  type="button"
                  disabled={
                    sending ||
                    uploading ||
                    tryOnBusy
                  }
                  className="flex w-full max-w-full items-center gap-3 px-3 py-2.5 pr-11 text-left transition-colors hover:bg-violet-100/90 disabled:pointer-events-none disabled:opacity-60 dark:hover:bg-violet-900/45"
                  aria-label={t.urlProductContextChipAria}
                  title={t.urlProductContextChipAria}
                  onClick={() => {
                    if (sending) return
                    attachUrlPageContextRef.current = true
                    enqueueGuestSend(async () => {
                      await submitGuestMessage('')
                    })
                  }}
                >
                  <span className="relative flex h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-border/60 bg-background shadow-sm">
                    {(() => {
                      const u = (pendingUrlPageContextChip.imageUrl ?? '').trim()
                      const u2 = (pendingUrlPageContextChip.imageUrl2 ?? '').trim()
                      const pick =
                        u && /^https?:\/\//i.test(u) && !isLikelyVideoOrStreamUrl(u)
                          ? u
                          : u2 && /^https?:\/\//i.test(u2) && !isLikelyVideoOrStreamUrl(u2)
                            ? u2
                            : ''
                      return pick ? (
                        <Image
                          src={msgImgSrc(pick)}
                          alt=""
                          width={48}
                          height={48}
                          unoptimized
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center text-muted-foreground">
                          <Package className="h-6 w-6" aria-hidden />
                        </span>
                      )
                    })()}
                  </span>
                  <span className="min-w-0 flex-1 text-[15px] font-medium leading-snug text-foreground sm:text-base">
                    {t.urlProductContextChipLabel}
                  </span>
                </button>
              </div>
            ) : null}

            <div className="space-y-1.5 rounded-xl border-2 border-border bg-background p-1.5">
              {imagePreviewUrls.length > 0 ? (
                <div className="space-y-1.5 overflow-hidden rounded-xl border bg-muted/30 p-1.5">
                  <div className="flex flex-wrap gap-1">
                    {imageStoragePaths.slice(0, 4).map((path, idx) => {
                      const preview = imagePreviewUrls[idx] ?? ''
                      return (
                        <div key={`${path}-${idx}`} className="relative h-12 w-12">
                          {preview ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={msgImgSrc(preview)} alt="" className="h-12 w-12 rounded-md object-cover" />
                          ) : (
                            <div className="h-12 w-12 rounded-md bg-muted" />
                          )}
                          <Button
                            type="button"
                            variant="secondary"
                            size="icon"
                            className="absolute -right-1 -top-1 z-10 h-5 w-5 rounded-full border border-border/70 bg-background/90 p-0 backdrop-blur"
                            onClick={() => removeAttachmentAt(idx)}
                            disabled={sending || uploading}
                            aria-label={t.guestRemoveAttachment}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      )
                    })}
                  </div>
                  {imageStoragePaths.length <= 1 ? (
                    <p className="text-[11px] text-muted-foreground">
                      {imageStoragePaths.length}/4 ảnh đã đính kèm
                    </p>
                  ) : null}
                  {tryOnResultInComposer && imagePreviewUrls[0] && !tryOnComposerLargeOpen ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 w-full text-[11px] font-medium sm:h-9 sm:text-xs"
                      onClick={() => setTryOnComposerLargeOpen(true)}
                    >
                      {t.tryOnResultViewLarge}
                    </Button>
                  ) : null}
                </div>
              ) : null}
              {imageStoragePaths.length === 1 ? (
                <p className="text-xs text-muted-foreground sm:text-sm">{t.guestCaptionHint}</p>
              ) : null}
                  {proofOrderId && !paidDepositOrderIds.has(proofOrderId) ? (
                <p className="text-xs leading-snug text-muted-foreground sm:text-sm">
                  {proofOrderIsSepay
                    ? `${shopDisplayName.trim() || 'Shop'}: chuyển đúng số tiền và «Nội dung CK» trong khối QR — xác nhận tự động; không cần đính ảnh ở đây.`
                    : 'Biên lai CK: nút «Gửi ảnh giao dịch» dưới mã QR trong chat (không đính ảnh ở đây).'}
                </p>
              ) : null}

              {authMode !== 'account' && authGateRequired ? (
                <div className="rounded-lg border border-border/70 bg-muted/20 px-2.5 py-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-medium text-foreground">{t.loginPromptTitle}</p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-6 w-6 p-0"
                      disabled={guestAuthSending || guestAuthVerifying}
                      onClick={() => setAuthGateRequired(false)}
                      aria-label="Đóng"
                      title="Đóng"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{t.loginPromptDescription}</p>
                  <p className="mt-1 text-[11px] font-medium text-amber-700 dark:text-amber-300">
                    {t.guestAuthRequiredAfterLimit.replace('{count}', '5')}
                  </p>
                  <div className="mt-2 grid grid-cols-1 gap-1.5">
                    <input
                      type="email"
                      value={guestAuthEmail}
                      onChange={(e) => setGuestAuthEmail(e.target.value)}
                      placeholder={t.guestAuthEmailPlaceholder}
                      className="h-8 rounded-md border border-border bg-background px-2 text-[12px]"
                    />
                    <div className="flex flex-wrap gap-1.5">
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        className="h-7 text-[11px]"
                        disabled={guestAuthSending || !guestAuthEmail.trim()}
                        onClick={() => void requestGuestAuthEmail()}
                      >
                        {t.guestAuthSendOtp}
                      </Button>
                    </div>
                    <label className="flex items-start gap-2 text-[11px] text-muted-foreground">
                      <input
                        type="checkbox"
                        className="mt-0.5 h-3.5 w-3.5"
                        checked={guestAuthRememberDevice}
                        onChange={(e) => {
                          const next = e.target.checked
                          setGuestAuthRememberDevice(next)
                          writeGuestAuthRememberDevicePreference(next)
                        }}
                      />
                      <span>{t.guestAuthRememberDeviceHint}</span>
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      <input
                        type="text"
                        value={guestAuthOtp}
                        onChange={(e) => setGuestAuthOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder={t.guestAuthOtpPlaceholder}
                        inputMode="numeric"
                        maxLength={6}
                        className="h-8 min-w-[150px] flex-1 rounded-md border border-border bg-background px-2 text-[12px]"
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 text-[11px]"
                        disabled={guestAuthVerifying || !guestAuthEmail.trim() || guestAuthOtp.trim().length !== 6}
                        onClick={() => void verifyGuestOtp()}
                      >
                        {t.guestAuthVerifyOtp}
                      </Button>
                    </div>
                    {guestAuthVerifying ? (
                      <p className="text-[11px] text-muted-foreground">{t.guestAuthVerifyingProgress}</p>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {tryOnOpen ? (
                <div className="space-y-2 rounded-lg border border-border/70 bg-muted/20 p-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-medium text-foreground">{t.tryOnTitle}</p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0"
                      onClick={() => setTryOnOpen(false)}
                      aria-label={t.guestRemoveAttachment}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  {tryOnOpenedViaEmbedQuery && !tryOnUserFile ? (
                    <p className="text-[11px] leading-snug text-muted-foreground">{t.tryOnEmbedOnlyFlowHint}</p>
                  ) : null}
                  <input
                    ref={tryOnUserInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      void setTryOnUserFromFile(e.target.files?.[0] ?? null)
                    }}
                  />
                  <input
                    ref={tryOnGarmentInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      void addTryOnGarmentFile(e.target.files?.[0] ?? null)
                      if (tryOnGarmentInputRef.current) tryOnGarmentInputRef.current.value = ''
                    }}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <p className="text-[11px] font-medium text-foreground">{t.tryOnModelPhoto}</p>
                      <button
                        type="button"
                        className="relative h-14 w-14 overflow-hidden rounded-md border border-border/80 bg-background/70 transition-colors hover:border-violet-400/70"
                        disabled={tryOnBusy}
                        onClick={() => tryOnUserInputRef.current?.click()}
                      >
                        {tryOnUserPreviewUrl ? (
                          <Image
                            src={tryOnUserPreviewUrl}
                            alt=""
                            width={56}
                            height={56}
                            unoptimized
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                            <ImagePlus className="h-4 w-4" />
                          </div>
                        )}
                        {tryOnUserPreviewUrl ? (
                          <button
                            type="button"
                            className="absolute right-0 top-0 rounded-bl bg-black/55 px-1 text-[10px] text-white"
                            onClick={(e) => {
                              e.stopPropagation()
                              removeTryOnUserPortrait()
                            }}
                            aria-label={t.guestRemoveAttachment}
                          >
                            ×
                          </button>
                        ) : null}
                      </button>
                      <p className="line-clamp-1 text-[11px] text-muted-foreground">{tryOnUserFile?.name ?? '—'}</p>
                    </div>

                    <div className="space-y-1">
                      <p className="text-[11px] font-medium text-foreground">
                        {t.tryOnGarmentPhoto} ({tryOnGarmentFiles.length}/{MAX_TRY_ON_GARMENTS})
                      </p>
                      <div className="grid grid-cols-2 gap-1">
                        {Array.from({ length: MAX_TRY_ON_GARMENTS }).map((_, idx) => {
                          const item = tryOnGarmentFiles[idx]
                          if (item) {
                            return (
                              <div
                                key={`${item.file?.name ?? item.sourceUrl ?? `garment-${idx}`}-${idx}`}
                                className="relative h-12 w-12 overflow-hidden rounded-md border bg-background/70"
                              >
                                <Image
                                  src={msgImgSrc(item.previewUrl)}
                                  alt=""
                                  width={48}
                                  height={48}
                                  unoptimized
                                  className="h-full w-full object-cover"
                                />
                                <button
                                  type="button"
                                  className="absolute right-0 top-0 rounded-bl bg-black/55 px-1 text-[10px] text-white"
                                  onClick={() => removeTryOnGarmentAt(idx)}
                                  aria-label={t.guestRemoveAttachment}
                                >
                                  ×
                                </button>
                              </div>
                            )
                          }
                          if (idx === tryOnGarmentFiles.length) {
                            return (
                              <button
                                key={`add-slot-${idx}`}
                                type="button"
                                className="flex h-12 w-12 items-center justify-center rounded-md border border-dashed border-border/80 bg-background/70 text-muted-foreground transition-colors hover:border-violet-400/70"
                                disabled={tryOnBusy}
                                onClick={() => setTryOnGarmentPickerOpen((v) => !v)}
                              >
                                <ImagePlus className="h-4 w-4" />
                              </button>
                            )
                          }
                          return <div key={`empty-slot-${idx}`} className="h-12 w-12 rounded-md border border-dashed border-border/70 bg-background/40" />
                        })}
                      </div>
                      {tryOnGarmentPickerOpen ? (
                        <div className="mt-2 space-y-2 rounded-md border border-border/70 bg-background/70 p-2">
                          <p className="text-[11px] font-medium text-foreground">{t.tryOnGarmentSourceTitle}</p>
                          <div className="grid grid-cols-1 gap-1">
                            <button
                              type="button"
                              className="flex h-8 items-center justify-center rounded-md border border-border/70 bg-background text-[11px] text-foreground transition-colors hover:border-violet-400/70"
                              disabled={tryOnBusy}
                              onClick={() => tryOnGarmentInputRef.current?.click()}
                            >
                              {t.tryOnGarmentSourceDevice}
                            </button>
                            <div className="space-y-1">
                              <p className="text-[10px] text-muted-foreground">{t.tryOnGarmentSourceRecent}</p>
                              {recentSuggestedGarmentImages.length === 0 ? (
                                <p className="text-[10px] text-muted-foreground">{t.tryOnGarmentRecentEmpty}</p>
                              ) : (
                                <div className="-mx-0.5 flex snap-x snap-mandatory gap-1 overflow-x-auto px-0.5 pb-1 [scrollbar-width:thin]">
                                  {recentSuggestedGarmentImages.map((item) => {
                                    const isPicked = tryOnGarmentFiles.some((x) => x.sourceUrl === item.imageUrl)
                                    return (
                                      <button
                                        key={item.imageUrl}
                                        type="button"
                                        className={`h-12 w-12 shrink-0 snap-start overflow-hidden rounded-md border bg-background transition-all ${
                                          isPicked
                                            ? 'border-violet-500 ring-2 ring-violet-400/70 ring-offset-1 ring-offset-background'
                                            : 'border-border/70 hover:border-violet-400/70'
                                        }`}
                                        disabled={tryOnBusy}
                                        onClick={() => addTryOnGarmentFromRecent(item.imageUrl, item.name)}
                                        title={item.name}
                                        aria-pressed={isPicked}
                                      >
                                        <Image
                                          src={msgImgSrc(item.imageUrl)}
                                          alt={item.name}
                                          width={48}
                                          height={48}
                                          unoptimized
                                          className="h-full w-full object-cover"
                                        />
                                      </button>
                                    )
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-1.5">
                    <Button
                      type="button"
                      size="sm"
                      className="gap-1.5"
                      disabled={tryOnBusy || !tryOnUserFile || tryOnGarmentFiles.length === 0}
                      onClick={() => void runTryOn()}
                    >
                      {tryOnBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                      {tryOnBusy
                        ? t.tryOnPreparing
                        : t.tryOnGenerateWithCost.replace('{credits}', formatCredits(TRY_ON_COST_2K))}
                    </Button>
                    <div className="ml-auto flex items-center gap-1.5">
                      <span className="inline-flex h-7 items-center rounded-md border border-border/70 bg-background/70 px-2 text-[10px] font-medium text-muted-foreground sm:text-[11px]">
                        {t.tryOnCreditsBalanceLabel.replace(
                          '{credits}',
                          tryOnCreditsLoading
                            ? '...'
                            : (typeof tryOnCreditsBalance === 'number'
                              ? formatCredits(tryOnCreditsBalance)
                              : '--')
                        )}
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-[10px] sm:text-[11px]"
                        onClick={() => void openTopUpPopup()}
                      >
                        {t.tryOnTopUpCredits}
                      </Button>
                    </div>
                  </div>
                </div>
              ) : null}

              <GuestChatDraftComposer
                submitGuestMessage={submitGuestMessage}
                enqueueGuestSend={enqueueGuestSend}
                attachmentCount={imageStoragePaths.length}
                uploading={uploading}
                sending={sending}
                tryOnBusy={tryOnBusy}
                onDraftPaste={onDraftPaste}
                onToggleTryOn={toggleTryOnPanel}
                galleryInputRef={galleryInputRef}
                cameraInputRef={cameraInputRef}
                showCameraButton={showCameraButton}
                onOpenProductShelf={() => {
                  setProductShelfShuffleNonce((n) => n + 1)
                  setRecentProductsOpen(true)
                }}
                productShelfButtonLabel={t.productShelfButton}
                showCommerceShortcuts={false}
                onOpenMyOrders={() => setEmbedMyOrdersOpen(true)}
                onOpenCart={() => setCartOpen(true)}
                cartItemCount={cartItems.length}
                ordersShortcutLabel={orderDetailT.composerOrdersLabel}
                cartShortcutLabel={t.widgetShoppingCart}
                onComposerFocusChange={setGuestChatFormFieldFocused}
                labels={draftComposerLabels}
              />
            </div>
          </div>
        </CardContent>
      </Card>
      {topUpModal}
      <Dialog
        open={guestCreditAuthDialogOpen}
        onOpenChange={(open) => {
          setGuestCreditAuthDialogOpen(open)
          if (!open) setPendingTopUpAfterAuth(false)
        }}
      >
        <DialogContent
          className="z-[230] max-h-[min(90dvh,560px)] overflow-y-auto sm:max-w-md"
          overlayClassName="z-[220] bg-black/70"
        >
          <DialogHeader>
            <DialogTitle>{t.guestCreditWalletLoginTitle}</DialogTitle>
            <DialogDescription>{t.guestCreditWalletLoginDescription}</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-2">
            <input
              type="email"
              value={guestAuthEmail}
              onChange={(e) => setGuestAuthEmail(e.target.value)}
              placeholder={t.guestAuthEmailPlaceholder}
              className="h-9 rounded-md border border-border bg-background px-2 text-[13px]"
              autoComplete="email"
            />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="text-xs"
                disabled={guestAuthSending || !guestAuthEmail.trim()}
                onClick={() => void requestGuestAuthEmail()}
              >
                {t.guestAuthSendOtp}
              </Button>
            </div>
            <label className="flex items-start gap-2 text-[11px] text-muted-foreground">
              <input
                type="checkbox"
                className="mt-0.5 h-3.5 w-3.5"
                checked={guestAuthRememberDevice}
                onChange={(e) => {
                  const next = e.target.checked
                  setGuestAuthRememberDevice(next)
                  writeGuestAuthRememberDevicePreference(next)
                }}
              />
              <span>{t.guestAuthRememberDeviceHint}</span>
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={guestAuthOtp}
                onChange={(e) => setGuestAuthOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder={t.guestAuthOtpPlaceholder}
                inputMode="numeric"
                maxLength={6}
                className="h-9 min-w-[140px] flex-1 rounded-md border border-border bg-background px-2 text-[13px]"
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-9 text-xs"
                disabled={guestAuthVerifying || !guestAuthEmail.trim() || guestAuthOtp.trim().length !== 6}
                onClick={() => void verifyGuestOtp()}
              >
                {t.guestAuthVerifyOtp}
              </Button>
            </div>
            {guestAuthVerifying ? (
              <p className="text-[11px] text-muted-foreground">{t.guestAuthVerifyingProgress}</p>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )

  return (
    <>
      {metaViewContent ? <MetaPixelViewContentTracker payload={metaViewContent} /> : null}
      <div
        className="h-[100dvh] w-full min-h-0 overflow-hidden bg-background sm:bg-muted/20"
        style={
          guestChatShellHeightPx != null
            ? { height: guestChatShellHeightPx, minHeight: 0 }
            : undefined
        }
      >
      <div className="mx-auto grid h-full w-full max-w-[1800px] grid-cols-1 gap-3 px-2 py-2 sm:px-3 lg:grid-cols-[minmax(240px,300px)_minmax(0,1fr)]">
        <aside className="hidden min-h-0 flex-col overflow-hidden rounded-2xl border border-border/70 bg-background shadow-sm lg:flex">
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-3 [scrollbar-width:thin]">
            {showNanoSiteNav ? (
              <section className="space-y-2">
                <Link
                  href="/"
                  className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted/70"
                >
                  <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
                  {t.backHome}
                </Link>
                <div>
                  <p className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {t.exploreToolsTitle}
                  </p>
                  <nav className="mt-1 space-y-0.5" aria-label={t.exploreToolsTitle}>
                    {CREATION_SIDEBAR_POPULAR_LINKS.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="block rounded-lg px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
                      >
                        {toolT[item.labelKey]}
                      </Link>
                    ))}
                  </nav>
                </div>
              </section>
            ) : null}
            <section className="space-y-2">
              <div className="flex items-start gap-2">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-violet-600" aria-hidden />
                <div className="min-w-0">
                  <p className="text-sm font-semibold leading-tight">{t.pageTitleSuffix}</p>
                  <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{t.subline}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <span className="rounded-md border border-border/60 bg-muted/40 px-2 py-1 text-[11px] text-foreground/90">
                  {t.tryOnOpen}
                </span>
                <span className="rounded-md border border-border/60 bg-muted/40 px-2 py-1 text-[11px] text-foreground/90">
                  {t.guestAttachPhoto}
                </span>
              </div>
              <div className="space-y-2">
                <Link
                  href="/messaging/my-chats"
                  className="block rounded-lg border border-violet-200/90 bg-violet-50/90 px-3 py-2 text-center text-sm font-medium text-violet-900 shadow-sm hover:bg-violet-100 dark:border-violet-800 dark:bg-violet-950/50 dark:text-violet-50"
                >
                  {t.linkMyShops}
                </Link>
                <button
                  type="button"
                  onClick={() => setEmbedMyOrdersOpen(true)}
                  className="block w-full rounded-lg border border-violet-200/90 bg-violet-50/90 px-3 py-2 text-center text-sm font-medium text-violet-900 shadow-sm transition-colors hover:bg-violet-100 dark:border-violet-800 dark:bg-violet-950/50 dark:text-violet-50 dark:hover:bg-violet-900/40"
                >
                  {t.linkMyOrders}
                </button>
              </div>
            </section>

            <section className="flex min-h-0 flex-1 flex-col border-t border-border/60 pt-3">
              <div className="mb-2 flex items-center gap-2">
                <MessageSquareText className="h-4 w-4 shrink-0 text-violet-600" aria-hidden />
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t.shopLabel}</p>
              </div>
              <div className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-0.5 [scrollbar-width:thin]">
                {activeChatList.length === 0 ? (
                  <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-3 text-sm text-muted-foreground">
                    {t.emptyThread}
                  </div>
                ) : (
                  activeChatList.map((row) => {
                    const active = row.slug === slug
                    return (
                      <Link
                        key={row.conversationId}
                        href={`/messaging/p/${encodeURIComponent(row.slug)}`}
                        className={`block rounded-xl border px-3 py-2 transition-colors ${
                          active
                            ? 'border-violet-300/70 bg-violet-50/70 dark:border-violet-700/70 dark:bg-violet-950/30'
                            : 'border-border/60 bg-background hover:bg-muted/40'
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <Store className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{row.shopName}</p>
                            {row.lastMessagePreview ? (
                              <p className="line-clamp-2 text-xs text-muted-foreground">{row.lastMessagePreview}</p>
                            ) : null}
                            {row.lastMessageAt ? (
                              <p className="text-[11px] text-muted-foreground">
                                {new Date(row.lastMessageAt).toLocaleString()}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </Link>
                    )
                  })
                )}
              </div>
            </section>

            <p className="text-[10px] leading-snug text-muted-foreground">{t.pollNote}</p>
          </div>
        </aside>

        <div className="min-h-0 min-w-0 h-full overflow-hidden">{chatPane}</div>
      </div>
      <Dialog
        open={guestProfileOpen}
        onOpenChange={(next) => {
          if (next) setGuestProfileOpen(true)
        }}
      >
        <DialogContent
          className={isEmbedUi || guestInIframe ? 'z-[210] sm:max-w-md' : 'sm:max-w-md'}
          overlayClassName={isEmbedUi || guestInIframe ? 'z-[200]' : undefined}
          showCloseButton={false}
          onPointerDownOutside={(e) => {
            if (isRadixSelectOutsideDialog(e.target)) return
            e.preventDefault()
          }}
          onInteractOutside={(e) => {
            if (isRadixSelectOutsideDialog(e.target)) {
              e.preventDefault()
            }
          }}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>{t.guestProfileDialogTitle}</DialogTitle>
            <DialogDescription className="text-left text-sm leading-relaxed">
              {t.guestProfileDialogDescription}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <span className="text-sm font-medium leading-none">{t.guestProfileBirthLabel}</span>
              <div className="grid grid-cols-3 gap-2">
                <Select
                  value={guestBirthDay || undefined}
                  onValueChange={setGuestBirthDay}
                >
                  <SelectTrigger className="h-10 w-full min-w-0" aria-label={t.guestProfileBirthDayPlaceholder}>
                    <SelectValue placeholder={t.guestProfileBirthDayPlaceholder} />
                  </SelectTrigger>
                  <SelectContent
                    position="popper"
                    className="z-[300] max-h-[min(280px,50dvh)]"
                  >
                    {Array.from({ length: guestBirthMaxDay }, (_, i) => i + 1).map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={guestBirthMonth || undefined}
                  onValueChange={setGuestBirthMonth}
                >
                  <SelectTrigger className="h-10 w-full min-w-0" aria-label={t.guestProfileBirthMonthPlaceholder}>
                    <SelectValue placeholder={t.guestProfileBirthMonthPlaceholder} />
                  </SelectTrigger>
                  <SelectContent
                    position="popper"
                    className="z-[300] max-h-[min(280px,50dvh)]"
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={guestBirthYear || undefined}
                  onValueChange={setGuestBirthYear}
                >
                  <SelectTrigger className="h-10 w-full min-w-0" aria-label={t.guestProfileBirthYearPlaceholder}>
                    <SelectValue placeholder={t.guestProfileBirthYearPlaceholder} />
                  </SelectTrigger>
                  <SelectContent
                    position="popper"
                    className="z-[300] max-h-[min(280px,50dvh)]"
                  >
                    {guestBirthYearOptions.map((y) => (
                      <SelectItem key={y} value={String(y)}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <span className="text-sm font-medium leading-none">{t.guestProfileGenderLabel}</span>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ['male', t.guestProfileGenderMale],
                    ['female', t.guestProfileGenderFemale],
                  ] as const
                ).map(([value, label]) => (
                  <Button
                    key={value}
                    type="button"
                    variant={guestProfileGender === value ? 'default' : 'outline'}
                    size="sm"
                    className="rounded-full"
                    onClick={() => setGuestProfileGender(value)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="ghost" disabled={guestProfileSaving} onClick={dismissGuestProfilePrompt}>
              {t.guestProfileRemindLater}
            </Button>
            <Button
              type="button"
              disabled={guestProfileSaving}
              className="inline-flex items-center gap-2"
              onClick={() => void saveGuestProfile()}
            >
              {guestProfileSaving ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden /> : null}
              {t.guestProfileSave}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Sheet open={nanoToolsSheetOpen} onOpenChange={setNanoToolsSheetOpen}>
        <SheetContent side="bottom" className="z-[260] max-h-[85vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{t.exploreToolsTitle}</SheetTitle>
          </SheetHeader>
          <nav className="mt-4 space-y-1" aria-label={t.exploreToolsTitle}>
            {CREATION_SIDEBAR_POPULAR_LINKS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block rounded-lg px-3 py-2.5 text-sm font-medium transition-colors hover:bg-muted/80"
                onClick={() => setNanoToolsSheetOpen(false)}
              >
                {toolT[item.labelKey]}
              </Link>
            ))}
          </nav>
        </SheetContent>
      </Sheet>
      <Sheet open={cartOpen} onOpenChange={setCartOpen}>
        <SheetContent side="bottom" className="z-[260] max-h-[85vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{t.widgetShoppingCart}</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-3">
            {cartItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">Giỏ hàng chưa có sản phẩm.</p>
            ) : (
              cartItems.map((item) => (
                <div key={item.id} className="rounded-lg border border-border p-2">
                  <div className="flex gap-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={msgImgSrc(item.variantLineImages?.[0] || item.card.image_url)}
                      alt=""
                      className="h-14 w-14 rounded object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{item.card.name}</p>
                      <p className="text-xs text-muted-foreground">{item.card.price_hint ?? ''}</p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-[11px]"
                      onClick={() => setCartItems((prev) => prev.filter((x) => x.id !== item.id))}
                    >
                      Xóa
                    </Button>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    <Input
                      className="h-8 text-xs"
                      placeholder="Màu"
                      value={item.color}
                      onChange={(e) =>
                        setCartItems((prev) =>
                          prev.map((x) => (x.id === item.id ? { ...x, color: e.target.value } : x))
                        )
                      }
                    />
                    <Input
                      className="h-8 text-xs"
                      placeholder="Size"
                      value={item.size}
                      onChange={(e) =>
                        setCartItems((prev) =>
                          prev.map((x) => (x.id === item.id ? { ...x, size: e.target.value } : x))
                        )
                      }
                    />
                    <Input
                      className="h-8 text-xs"
                      type="number"
                      min={1}
                      max={99}
                      placeholder="SL"
                      value={item.quantity}
                      onChange={(e) =>
                        setCartItems((prev) =>
                          prev.map((x) =>
                            x.id === item.id
                              ? { ...x, quantity: Math.max(1, Math.min(99, Math.floor(Number(e.target.value) || 1))) }
                              : x
                          )
                        )
                      }
                    />
                  </div>
                </div>
              ))
            )}
            {cartItems.length > 0 ? (
              <>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <Input className="h-9 text-sm" placeholder="Họ tên" value={orderName} onChange={(e) => setOrderName(e.target.value)} />
                  <Input className="h-9 text-sm" placeholder="Số điện thoại" value={orderPhone} onChange={(e) => setOrderPhone(e.target.value)} />
                  <Input className="h-9 text-sm" placeholder="Địa chỉ" value={orderAddress} onChange={(e) => setOrderAddress(e.target.value)} />
                </div>
                <Textarea className="min-h-[64px] text-sm" placeholder="Ghi chú đơn hàng" value={orderNote} onChange={(e) => setOrderNote(e.target.value)} />
                <div className="rounded-lg border border-violet-200 bg-violet-50/70 p-2 text-sm text-violet-950">
                  Tạm tính: {new Intl.NumberFormat('vi-VN').format(cartSubtotal)}đ. Tiền cọc sẽ tính theo cài đặt shop khi tạo đơn.
                </div>
                <Button className="w-full" disabled={cartCheckoutBusy} onClick={() => void submitCartCheckout()}>
                  {cartCheckoutBusy ? 'Đang tạo đơn...' : 'Thanh toán giỏ hàng'}
                </Button>
              </>
            ) : null}
          </div>
        </SheetContent>
      </Sheet>
      <MessageImagePreviewDialog
        src={chatImageLightboxUrl}
        onOpenChange={(open) => {
          if (!open) setChatImageLightboxUrl(null)
        }}
      />
      <MessageImagePreviewDialog
        src={
          tryOnComposerLargeOpen && tryOnResultInComposer && imagePreviewUrls[0]
            ? imagePreviewUrls[0]
            : null
        }
        onOpenChange={(open) => {
          if (!open) setTryOnComposerLargeOpen(false)
        }}
        download={{
          label: t.tryOnResultDownload,
          filename: 'try-on-result.png',
        }}
      />
      <Sheet open={recentProductsOpen} onOpenChange={setRecentProductsOpen}>
        <SheetContent
          side="bottom"
          className="flex max-h-[88dvh] flex-col gap-0 overflow-hidden rounded-t-2xl p-0 sm:max-w-lg sm:mx-auto"
        >
          <div className="shrink-0 border-b border-border/60 bg-background px-3 pb-3 pl-3 pr-11 pt-10 text-left sm:pr-12 sm:pt-11">
            <SheetHeader className="space-y-0 p-0 text-left">
              <SheetTitle className="text-sm font-semibold leading-snug sm:text-base">{t.productShelfTitle}</SheetTitle>
            </SheetHeader>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Input
                value={productShelfSearchQuery}
                onChange={(e) => setProductShelfSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    runProductShelfTextSearch()
                  }
                }}
                placeholder={t.productShelfSearchPlaceholder}
                disabled={productShelfSearchLoading}
                className="h-9 min-w-0 flex-1 text-sm sm:max-w-[min(100%,20rem)]"
                aria-label={t.productShelfSearchPlaceholder}
              />
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="h-9 shrink-0 gap-1"
                disabled={productShelfSearchLoading || productShelfSearchQuery.trim().length < 2}
                onClick={() => runProductShelfTextSearch()}
              >
                {productShelfSearchLoading ? (
                  <span className="text-xs">{t.productShelfSearching}</span>
                ) : (
                  <>
                    <Search className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    {t.productShelfSearchButton}
                  </>
                )}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="h-9 shrink-0 gap-1"
                disabled={productShelfSearchLoading}
                onClick={() => productShelfImageInputRef.current?.click()}
              >
                <LucideImage className="h-3.5 w-3.5 shrink-0" aria-hidden />
                {t.productShelfSearchImage}
              </Button>
              {productShelfVectorRows !== null ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-9 shrink-0"
                  onClick={() => {
                    setProductShelfVectorRows(null)
                    setProductShelfSearchQuery('')
                  }}
                >
                  {t.productShelfSearchClear}
                </Button>
              ) : null}
              <input
                ref={productShelfImageInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={onProductShelfImageFile}
              />
            </div>
          </div>
          <div
            ref={productShelfScrollRef}
            className="min-h-0 flex-1 overflow-y-auto px-3 pb-6 pt-3"
          >
          {productShelfSimilarLoading && productShelfVectorRows === null ? (
            <p className="text-sm text-muted-foreground">{t.productShelfSearching}</p>
          ) : productShelfDisplayRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {productShelfVectorRows !== null ? t.productShelfSearchNoResults : t.productShelfEmpty}
            </p>
          ) : (
            <>
            <div className="grid grid-cols-2 gap-2.5">
              {productShelfDisplayRows.slice(0, productShelfVisibleCount).map((row) => {
                const href = row.card.product_url.trim()
                const priceLabel = formatVndPriceWithBirthday(row.card.price_hint, birthdayPromoDiscountPct)
                return (
                  <div
                    key={`${row.sourceMessageId}-${href}`}
                    className="flex flex-col gap-1.5 rounded-lg border border-border/70 bg-muted/15 p-2 [content-visibility:auto] supports-[content-visibility:auto]:[contain-intrinsic-size:12rem]"
                  >
                    {/^https?:\/\//i.test(href) ? (
                      <a
                        href={href}
                        rel="noopener noreferrer"
                        className="relative block aspect-square w-full overflow-hidden rounded-md border border-border/50 bg-background outline-none ring-offset-background transition-opacity hover:opacity-95 active:opacity-90 focus-visible:ring-2 focus-visible:ring-ring"
                        aria-label={`${row.card.name.trim() || t.visionProductViewDetails} — ${t.visionProductViewDetails}`}
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          openGuestProductDetailUrl(href)
                        }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element -- URL ngoài từ shop */}
                        <img
                          src={msgImgSrc(row.card.image_url.trim())}
                          alt=""
                          className="h-full w-full object-contain"
                          loading="lazy"
                          decoding="async"
                          fetchPriority="low"
                        />
                      </a>
                    ) : (
                      <button
                        type="button"
                        className="relative block aspect-square w-full cursor-zoom-in overflow-hidden rounded-md border border-border/50 bg-background outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        onClick={(e) => {
                          e.stopPropagation()
                          const src = msgImgSrc(row.card.image_url.trim())
                          if (src) setChatImageLightboxUrl(src)
                        }}
                        aria-label="Xem ảnh lớn"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element -- URL ngoài từ shop */}
                        <img
                          src={msgImgSrc(row.card.image_url.trim())}
                          alt=""
                          className="h-full w-full object-contain"
                          loading="lazy"
                          decoding="async"
                          fetchPriority="low"
                        />
                      </button>
                    )}
                    <p className="line-clamp-2 min-h-[2.25rem] text-[11px] font-medium leading-snug text-foreground">
                      {row.card.name.trim() || '—'}
                    </p>
                    {priceLabel ? (
                      <p className="text-[11px] font-semibold tabular-nums text-violet-700 dark:text-violet-300">
                        {priceLabel}
                      </p>
                    ) : null}
                    <div className="flex flex-col gap-1.5">
                      <div className="grid grid-cols-2 gap-1.5">
                        <Button
                          type="button"
                          size="sm"
                          className="h-8 w-full px-1 text-[11px]"
                          disabled={sending}
                          onClick={() =>
                            void openGuestProductOrderFormFromCard(row.card).then(() => setRecentProductsOpen(false))
                          }
                        >
                          {t.productShelfBuy}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          className="h-8 w-full px-1 text-[11px]"
                          disabled={sending}
                          onClick={() => {
                            setRecentProductsOpen(false)
                            scrollGuestChatToBottomOnce('smooth')
                            void submitProductCardPick(row.card, row.sourceMessageId)
                          }}
                        >
                          {t.visionProductLink}
                        </Button>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 w-full px-1 text-[11px]"
                        onClick={() => {
                          if (!/^https?:\/\//i.test(href)) return
                          openGuestProductDetailUrl(href)
                        }}
                      >
                        {t.visionProductViewDetails}
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
            {productShelfVisibleCount < productShelfDisplayRows.length ? (
              <div
                ref={productShelfSentinelRef}
                className="h-4 w-full shrink-0"
                aria-hidden
              />
            ) : null}
            </>
          )}
          </div>
        </SheetContent>
      </Sheet>
      <GuestWidgetOrderDetailDialog
        open={Boolean(embedOrderDetailId)}
        onOpenChange={(open) => {
          if (!open) setEmbedOrderDetailId(null)
        }}
        slug={slug}
        orderId={embedOrderDetailId}
        t={orderDetailT}
        authHeaders={authHeaders}
        captureGuestSessionFromResponse={captureGuestSessionFromResponse}
        loadErrorLabel={orderDetailT.loadFailed}
        depositBusyOrderId={paymentProofBusyOrderId}
        onDepositPickProof={pickAndVerifyPaymentProof}
        dataRefreshNonce={embedWidgetDataNonce}
      />
      <GuestWidgetMyOrdersDialog
        open={embedMyOrdersOpen}
        onOpenChange={setEmbedMyOrdersOpen}
        slug={slug}
        t={orderDetailT}
        detailActionLabel={t.visionProductViewDetails}
        onSelectOrderId={(id) => setEmbedOrderDetailId(id)}
        authHeaders={authHeaders}
        captureGuestSessionFromResponse={captureGuestSessionFromResponse}
        loadErrorLabel={orderDetailT.loadFailed}
        depositBusyOrderId={paymentProofBusyOrderId}
        onDepositPickProof={pickAndVerifyPaymentProof}
        dataRefreshNonce={embedWidgetDataNonce}
        shopDisplayName={shopDisplayName}
        embedUi={isEmbedUi || guestInIframe}
      />
    </div>
    </>
  )
}
