'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, ClipboardEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { CustomerCareMessageBody } from '@/components/messaging/customer-care-message-body'
import { useToast } from '@/hooks/use-toast'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import type { Json } from '@/types/database.types'
import { Camera, ImagePlus, Loader2, MessageSquareText, Send, Sparkles, Store, X } from 'lucide-react'
import { aiProductCardsFromPayload } from '@/lib/messaging/partner-ai-product-cards'
import type { PartnerAiProductCard } from '@/lib/messaging/partner-ai-product-cards'
import { buildSePayQrImgUrl } from '@/lib/sepay-qr'
import { CREDIT_UNIT_PRICE_VND } from '@/lib/credit-unit-price'
import {
  MESSAGING_GUEST_SESSION_STORAGE_KEY,
  MESSAGING_GUEST_SESSION_STORAGE_KEY_LEGACY,
} from '@/lib/messaging/guest-auth-session'
import {
  MESSAGING_GUEST_ACCOUNT_STORAGE_KEY,
  MESSAGING_GUEST_ACCOUNT_STORAGE_KEY_LEGACY,
} from '@/lib/messaging/guest-account-session'

type GuestMsg = {
  id: string
  direction: 'inbound' | 'outbound'
  body: string
  created_at: string
  raw_payload?: Json | null
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
        }
        if (pushCard(card)) return out
      }
    }
  }
  return out
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
const MESSAGING_AUTH_SYNC_EVENT_KEY = 'nanoai_messaging_auth_sync'
const FALLBACK_SHOP_TYPING_WAIT_MS = 75_000
const ORDER_PROFILE_STORAGE_PREFIX = 'nanoai_order_profile_v1'
const GUEST_IMAGE_MAX_BYTES = 10 * 1024 * 1024

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
}

function formatCredits(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

export function PartnerGuestChatClient({
  slug,
  shopDisplayName,
  t,
  initialChatList = [],
}: {
  slug: string
  shopDisplayName: string
  t: T
  initialChatList?: ChatRailItem[]
}) {
  const { toast } = useToast()
  const [authReady, setAuthReady] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [messages, setMessages] = useState<GuestMsg[]>([])
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false)
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [authMode, setAuthMode] = useState<'anonymous' | 'account'>('anonymous')
  const [authGateRequired, setAuthGateRequired] = useState(false)
  const [guestAuthEmail, setGuestAuthEmail] = useState('')
  const [guestAuthOtp, setGuestAuthOtp] = useState('')
  const [guestAuthSending, setGuestAuthSending] = useState(false)
  const [guestAuthVerifying, setGuestAuthVerifying] = useState(false)
  const otpLastAutoSubmittedRef = useRef<string>('')
  /** Sau khi gửi tin: server báo AI/FAQ đang trả lời — poll nhanh và hiện “đang soạn tin”. */
  const [shopTyping, setShopTyping] = useState<{ deadline: number; baselineOutbound: number } | null>(null)
  const [uploading, setUploading] = useState(false)
  const [isTouchDevice, setIsTouchDevice] = useState(false)
  const [tryOnOpen, setTryOnOpen] = useState(false)
  const [tryOnBusy, setTryOnBusy] = useState(false)
  const [tryOnCreditsBalance, setTryOnCreditsBalance] = useState<number | null>(null)
  const [tryOnCreditsLoading, setTryOnCreditsLoading] = useState(false)
  const [topUpOpen, setTopUpOpen] = useState(false)
  const [topUpLoading, setTopUpLoading] = useState(false)
  const [topUpAmount, setTopUpAmount] = useState(String(CREDIT_UNIT_PRICE_VND))
  const [topUpConfigs, setTopUpConfigs] = useState<TopUpPaymentConfig[]>([])
  const [topUpSelectedBank, setTopUpSelectedBank] = useState('')
  const [topUpPayment, setTopUpPayment] = useState<TopUpPayment | null>(null)
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null)
  const [orderFormOpen, setOrderFormOpen] = useState(false)
  const [orderFormBusy, setOrderFormBusy] = useState(false)
  const [buyOptionsOpen, setBuyOptionsOpen] = useState(false)
  const [buyOptionsBusy, setBuyOptionsBusy] = useState(false)
  const [buyOptions, setBuyOptions] = useState<BuyProductOption[]>([])
  const [buyPromptMessageId, setBuyPromptMessageId] = useState<string | null>(null)
  const [activeOrderCard, setActiveOrderCard] = useState<PartnerAiProductCard | null>(null)
  const [activePurchaseOptions, setActivePurchaseOptions] = useState<PurchaseOptionsPayload | null>(null)
  const [orderName, setOrderName] = useState('')
  const [orderPhone, setOrderPhone] = useState('')
  const [orderAddress, setOrderAddress] = useState('')
  const [orderColor, setOrderColor] = useState('')
  const [orderSize, setOrderSize] = useState('')
  const [orderQuantity, setOrderQuantity] = useState('1')
  const [orderNote, setOrderNote] = useState('')
  const [proofOrderId, setProofOrderId] = useState<string | null>(null)
  const [tryOnUserFile, setTryOnUserFile] = useState<File | null>(null)
  const [tryOnGarmentFiles, setTryOnGarmentFiles] = useState<SelectedImage[]>([])
  const [tryOnGarmentPickerOpen, setTryOnGarmentPickerOpen] = useState(false)
  const [tryOnUserPreviewUrl, setTryOnUserPreviewUrl] = useState<string | null>(null)
  const [imageStoragePath, setImageStoragePath] = useState<string | null>(null)
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null)
  const [visionPickBusyId, setVisionPickBusyId] = useState<string | null>(null)
  const pageContextRef = useRef<{ sku?: string; imageUrl?: string; productUrl?: string } | null>(null)
  const contextSeededRef = useRef(false)
  const galleryInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const tryOnUserInputRef = useRef<HTMLInputElement>(null)
  const tryOnGarmentInputRef = useRef<HTMLInputElement>(null)
  const scrollAnchorRef = useRef<HTMLDivElement>(null)
  const didInitialAutoScrollRef = useRef(false)
  const draftTextareaRef = useRef<HTMLTextAreaElement>(null)
  const guestSessionIdRef = useRef<string | null>(null)
  const guestAccountIdRef = useRef<string | null>(null)
  const consultedProductUrlsRef = useRef<Set<string>>(new Set())

  const recentSuggestedGarmentImages = useMemo(() => {
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
  }, [messages])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const existing =
      window.localStorage.getItem(MESSAGING_GUEST_SESSION_STORAGE_KEY)?.trim()
      ?? window.localStorage.getItem(MESSAGING_GUEST_SESSION_STORAGE_KEY_LEGACY)?.trim()
      ?? ''
    if (existing) guestSessionIdRef.current = existing
    const accountExisting =
      window.localStorage.getItem(MESSAGING_GUEST_ACCOUNT_STORAGE_KEY)?.trim()
      ?? window.localStorage.getItem(MESSAGING_GUEST_ACCOUNT_STORAGE_KEY_LEGACY)?.trim()
      ?? ''
    if (accountExisting) guestAccountIdRef.current = accountExisting
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const q = new URLSearchParams(window.location.search)
    const sku = (q.get('ctx_sku') || '').trim()
    const imageUrl = (q.get('ctx_image') || '').trim()
    const productUrl = (q.get('ctx_product_url') || '').trim()
    const hasAny = Boolean(sku || imageUrl || productUrl)
    pageContextRef.current = hasAny
      ? {
          ...(sku ? { sku } : {}),
          ...(imageUrl ? { imageUrl } : {}),
          ...(productUrl ? { productUrl } : {}),
        }
      : null
  }, [])

  const authHeaders = useCallback((): Record<string, string> => {
    const h: Record<string, string> = {}
    const sessionId = guestSessionIdRef.current?.trim() ?? ''
    if (sessionId) h['x-guest-session-id'] = sessionId
    const accountId = guestAccountIdRef.current?.trim() ?? ''
    if (accountId) h['x-guest-account-id'] = accountId
    return h
  }, [])

  const captureGuestSessionFromResponse = useCallback((res: Response) => {
    const sid = res.headers.get('x-guest-session-id')?.trim() ?? ''
    if (!sid) return
    guestSessionIdRef.current = sid
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(MESSAGING_GUEST_SESSION_STORAGE_KEY, sid)
      window.localStorage.setItem(MESSAGING_GUEST_SESSION_STORAGE_KEY_LEGACY, sid)
    }
  }, [])

  const captureGuestAccountFromResponse = useCallback((res: Response) => {
    const aid = res.headers.get('x-guest-account-id')?.trim() ?? ''
    if (!aid) return
    guestAccountIdRef.current = aid
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(MESSAGING_GUEST_ACCOUNT_STORAGE_KEY, aid)
      window.localStorage.setItem(MESSAGING_GUEST_ACCOUNT_STORAGE_KEY_LEGACY, aid)
    }
  }, [])

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
        const me = await fetch('/api/auth/me', { credentials: 'same-origin' })
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
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/messaging/guest/${encodeURIComponent(slug)}`, {
        credentials: 'same-origin',
        headers: { ...authHeaders() },
      })
      captureGuestSessionFromResponse(res)
      captureGuestAccountFromResponse(res)
      const data = (await res.json()) as {
        messages?: GuestMsg[]
        error?: string
        authMode?: 'anonymous' | 'account'
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
      const authRequiredFromMessages = next.some(
        (m) => m.direction === 'outbound' && /^AUTH_REQUIRED_/i.test(String(m.body ?? '').trim())
      )
      const normalizedMessages = next.map((m) => {
        if (m.direction !== 'outbound') return m
        if (!/^AUTH_REQUIRED_/i.test(String(m.body ?? '').trim())) return m
        return {
          ...m,
          body: t.guestAuthRequiredAfterLimit.replace('{count}', '5'),
        }
      })
      if (authRequiredFromMessages) {
        setAuthGateRequired(true)
        setAuthMode('anonymous')
      }
      setMessages(normalizedMessages)
      setAuthMode(data.authMode === 'account' ? 'account' : 'anonymous')
      if (data.authMode === 'account') setAuthGateRequired(false)
      setHasLoadedOnce(true)
      setShopTyping((prev) => {
        if (!prev) return null
        const out = next.filter((m) => m.direction === 'outbound').length
        if (out > prev.baselineOutbound) return null
        if (Date.now() > prev.deadline) return null
        return prev
      })
    } catch {
      toast({ title: t.loadError, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [slug, toast, t.guestAuthRequiredAfterLimit, t.loadError, authHeaders, captureGuestSessionFromResponse, captureGuestAccountFromResponse])

  const refreshAuthAndReload = useCallback(async () => {
    try {
      const me = await fetch('/api/auth/me', { credentials: 'same-origin' })
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
  }, [load])

  useEffect(() => {
    if (authReady) void load()
  }, [authReady, load])

  useEffect(() => {
    didInitialAutoScrollRef.current = false
  }, [slug, userId])

  useEffect(() => {
    const id = window.setInterval(() => void load(), 18000)
    return () => window.clearInterval(id)
  }, [load])

  useEffect(() => {
    if (!shopTyping) return
    const id = window.setInterval(() => void load(), 2500)
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
      void load()
    }
    sp.delete('auth')
    const next = `${window.location.pathname}${sp.toString() ? `?${sp.toString()}` : ''}`
    window.history.replaceState(null, '', next)
  }, [load, slug])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const onStorage = (e: StorageEvent) => {
      if (e.key !== MESSAGING_AUTH_SYNC_EVENT_KEY) return
      void refreshAuthAndReload()
    }
    const onFocus = () => {
      if (document.visibilityState === 'hidden') return
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

  const autoResizeDraft = useCallback(() => {
    const el = draftTextareaRef.current
    if (!el) return
    el.style.height = '0px'
    const minHeight = 15
    const maxHeight = 48
    const next = Math.min(Math.max(el.scrollHeight, minHeight), maxHeight)
    el.style.height = `${next}px`
    el.style.overflowY = el.scrollHeight > maxHeight ? 'auto' : 'hidden'
  }, [])

  useEffect(() => {
    autoResizeDraft()
  }, [draft, autoResizeDraft])

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
    const anchor = scrollAnchorRef.current
    if (!anchor) return
    if (!messages.length && !shopTyping) return
    anchor.scrollIntoView({
      block: 'end',
      behavior: didInitialAutoScrollRef.current ? 'smooth' : 'auto',
    })
    didInitialAutoScrollRef.current = true
  }, [messages.length, shopTyping, shopTyping?.deadline])

  const setTryOnUserFromFile = async (file: File | null) => {
    if (!file) {
      setTryOnUserFile(null)
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

  const clearAttachment = () => {
    setImageStoragePath(null)
    setImagePreviewUrl(null)
    setTryOnGarmentPickerOpen(false)
    if (galleryInputRef.current) galleryInputRef.current.value = ''
    if (cameraInputRef.current) cameraInputRef.current.value = ''
  }

  const submitVisionPick = async (messageId: string, inventoryId: string) => {
    setVisionPickBusyId(messageId)
    const outboundBaseline = messages.filter((m) => m.direction === 'outbound').length
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
        baselineOutbound: outboundBaseline,
      })
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
    return out
  }, [])

  const openOrderFormByOption = useCallback(
    async (x: BuyProductOption) => {
      const card = toCardFromBuyOption(x)
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
        setOrderSize('')
        setOrderQuantity('1')
        setOrderNote('')
        setActiveOrderId(oid)
        setOrderFormOpen(true)
        setBuyOptionsOpen(false)
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
      toast,
    ]
  )

  const maybeOpenBuyOptionsFromInbound = useCallback(async () => {
    if (buyOptionsBusy || orderFormOpen) return
    if (authGateRequired && authMode !== 'account') return
    const inbound = [...messages].reverse().find((m) => m.direction === 'inbound')
    if (!inbound) return
    if (buyPromptMessageId === inbound.id) return
    const intent = classifyOrderIntent(inbound.body ?? '')
    if (intent !== 'purchase') return
    const recent = collectRecentSuggestedCardsFromMessages(messages, 80, inbound.id)
    if (!recent.length) {
      setBuyOptions([])
      setBuyOptionsOpen(false)
      setBuyPromptMessageId(inbound.id)
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
      if (data.products.length > 0) {
        toast({ title: 'Anh/chị muốn mua sản phẩm nào? Mình gợi ý 20 mẫu liên quan nhất.' })
      } else {
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

  const submitProductCardPick = async (card: PartnerAiProductCard) => {
    const latestInboundText = [...messages].reverse().find((m) => m.direction === 'inbound')?.body ?? ''
    const intent = classifyOrderIntent(latestInboundText)
    const label = card.name?.trim() || 'mau san pham'
    const productUrl = card.product_url.trim()
    const productKey = productUrl.toLowerCase()
    if (intent !== 'purchase') {
      if (productUrl && consultedProductUrlsRef.current.has(productKey)) {
        if (typeof window !== 'undefined') {
          const opened = window.open(productUrl, '_blank', 'noopener,noreferrer')
          if (!opened) window.location.href = productUrl
        }
        return
      }
      setBuyOptionsOpen(false)
      const ask =
        intent === 'shipping_policy'
          ? `Mình quan tâm mẫu này: ${label}. Shop tư vấn giúp mình chính sách vận chuyển, phí ship và thời gian giao nhé.`
          : `Mình quan tâm mẫu này: ${label}. Shop tư vấn chi tiết giúp mình nhé.`
      setSending(true)
      try {
        const res = await fetch(`/api/messaging/guest/${encodeURIComponent(slug)}`, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify({ text: ask }),
        })
        captureGuestSessionFromResponse(res)
        captureGuestAccountFromResponse(res)
        const data = (await res.json().catch(() => null)) as { error?: string } | null
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
        if (productUrl) consultedProductUrlsRef.current.add(productKey)
        await load()
      } catch {
        toast({ title: t.sendError, variant: 'destructive' })
      } finally {
        setSending(false)
      }
      return
    }

    await openOrderFormByOption({
      name: card.name,
      image_url: card.image_url,
      product_url: card.product_url,
      price_hint: card.price_hint,
      sku: null,
    })
  }

  const submitOrderCheckout = async () => {
    const oid = activeOrderId
    if (!oid) return
    const missing: string[] = []
    if (!orderName.trim()) missing.push('Họ tên')
    if (!orderPhone.trim()) missing.push('Số điện thoại')
    if (!orderAddress.trim()) missing.push('Địa chỉ')
    if (!orderColor.trim()) missing.push('Màu')
    if (!orderSize.trim()) missing.push('Size')
    const qty = Math.max(0, parseInt(orderQuantity || '0', 10) || 0)
    if (qty <= 0) missing.push('Số lượng')
    if (missing.length > 0) {
      toast({
        title: `Vui lòng điền đầy đủ thông tin bắt buộc: ${missing.join(', ')}`,
        variant: 'destructive',
      })
      return
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
            color: orderColor,
            size: orderSize,
            quantity: qty,
            note: orderNote,
          },
        }),
      })
      captureGuestSessionFromResponse(res)
      captureGuestAccountFromResponse(res)
      const data = (await res.json()) as {
        ok?: boolean
        error?: string
        order?: { id?: string; required_amount?: number }
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
      saveLocalOrderProfile({
        customerName: orderName,
        customerPhone: orderPhone,
        shippingAddress: orderAddress,
      })
      setOrderFormOpen(false)
      const requiredAmount = Math.max(0, Math.round(Number(data.order?.required_amount) || 0))
      if (requiredAmount > 0) {
        setProofOrderId(String(data.order?.id ?? oid))
      } else {
        setProofOrderId(null)
      }
      await load()
      toast({
        title:
          requiredAmount > 0
            ? 'Đã tạo đơn hàng thành công và tạo QR thanh toán. Vui lòng gửi ảnh chứng từ để xác nhận.'
            : 'Đã tạo đơn hàng thành công. Đơn này không yêu cầu đặt cọc trước, khách thanh toán khi nhận hàng.',
      })
    } catch {
      toast({ title: 'Không cập nhật được đơn hàng. Vui lòng thử lại.', variant: 'destructive' })
    } finally {
      setOrderFormBusy(false)
    }
  }

  const submitPaymentProof = async () => {
    const oid = proofOrderId
    if (!oid || !imageStoragePath) return
    setSending(true)
    try {
      const res = await fetch(`/api/messaging/guest/${encodeURIComponent(slug)}/order/verify-payment`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          orderId: oid,
          proofImageStoragePath: imageStoragePath,
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
      await load()
      clearAttachment()
      setProofOrderId(null)
    } catch {
      toast({ title: 'Không đối chiếu được thanh toán.', variant: 'destructive' })
    } finally {
      setSending(false)
    }
  }

  const uploadFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast({ title: t.guestImageInvalidType, variant: 'destructive' })
      return
    }
    setUploading(true)
    try {
      if (file.size > GUEST_IMAGE_MAX_BYTES) {
        toast({ title: t.guestImageTooLarge, variant: 'destructive' })
        clearAttachment()
        return
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
        return
      }
      if (!res.ok || !data.path) {
        const msg = data.error || t.sendError
        if (/large|too large|lớn/i.test(msg)) toast({ title: t.guestImageTooLarge, variant: 'destructive' })
        else if (/type|unsupported|hỗ trợ/i.test(msg)) toast({ title: t.guestImageInvalidType, variant: 'destructive' })
        else toast({ title: msg, variant: 'destructive' })
        clearAttachment()
        return
      }
      setImageStoragePath(data.path)
      setImagePreviewUrl(data.publicUrl ?? null)
    } catch {
      toast({ title: t.sendError, variant: 'destructive' })
      clearAttachment()
    } finally {
      setUploading(false)
    }
  }

  const onPickGallery = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) void uploadFile(f)
  }

  const onPickCamera = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) void uploadFile(f)
  }

  const onDraftPaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    if (uploading || sending || tryOnBusy) return
    const cd = e.clipboardData
    if (!cd) return
    const attachFirstImage = (f: File | null) => {
      if (!f?.type.startsWith('image/')) return false
      e.preventDefault()
      void uploadFile(f)
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
    if (!userId) {
      toast({ title: t.loginPromptTitle, description: t.loginPromptDescription })
      return
    }
    if (!tryOnUserFile || tryOnGarmentFiles.length === 0) {
      toast({ title: t.tryOnNeedBoth, variant: 'destructive' })
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
      setImagePreviewUrl(data.resultUrl)

      const imgRes = await fetch(data.resultUrl)
      const blob = await imgRes.blob()
      const file = new File([blob], `try-on-${Date.now()}.png`, { type: blob.type || 'image/png' })
      await uploadFile(file)
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
      })
      if (!res.ok) {
        setTryOnCreditsBalance(null)
        if (res.status === 401) {
          setAuthGateRequired(true)
          setAuthMode('anonymous')
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

  const buildTransferContent = useCallback(() => {
    const suffix = `${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`
    return `SEVQR DH${suffix}`
  }, [])

  const openTopUpPopup = useCallback(async () => {
    setTopUpOpen(true)
    setTopUpPayment(null)
    try {
      const authRes = await fetch('/api/account/credits', {
        method: 'GET',
        credentials: 'same-origin',
        cache: 'no-store',
      })
      if (authRes.status === 401) {
        setAuthGateRequired(true)
        setAuthMode('anonymous')
        setTopUpOpen(false)
        toast({
          title: 'Vui lòng đăng nhập Gmail để nạp credit.',
          variant: 'destructive',
        })
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
  }, [loadTryOnCreditsBalance, toast])

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
        headers: { 'Content-Type': 'application/json' },
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
        setAuthGateRequired(true)
        setAuthMode('anonymous')
        toast({ title: 'Vui lòng đăng nhập Gmail để nạp credit.', variant: 'destructive' })
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
  }, [buildTransferContent, loadTryOnCreditsBalance, toast, topUpAmount, topUpConfigs, topUpSelectedBank])

  const send = async () => {
    const text = draft.trim()
    if (authGateRequired && authMode !== 'account') {
      toast({
        title: t.guestAuthRequiredAfterLimit.replace('{count}', '5'),
        variant: 'destructive',
      })
      return
    }
    if (!text && !imageStoragePath) return
    if (text) {
      // Customer continues with normal consultation instead of choosing from buy rail.
      setBuyOptionsOpen(false)
    }
    const outboundBaseline = messages.filter((m) => m.direction === 'outbound').length
    setSending(true)
    try {
      const res = await fetch(`/api/messaging/guest/${encodeURIComponent(slug)}`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          text:
            text ||
            (!contextSeededRef.current && pageContextRef.current
              ? [
                  pageContextRef.current.sku ? `Khách đang xem mã sản phẩm: ${pageContextRef.current.sku}` : '',
                  pageContextRef.current.productUrl ? `Link sản phẩm: ${pageContextRef.current.productUrl}` : '',
                ]
                  .filter(Boolean)
                  .join('\n')
              : undefined),
          imageStoragePath: imageStoragePath || undefined,
          pageContext:
            !contextSeededRef.current && pageContextRef.current
              ? {
                  sku: pageContextRef.current.sku,
                  imageUrl: pageContextRef.current.imageUrl,
                  productUrl: pageContextRef.current.productUrl,
                  source: 'widget_page',
                }
              : undefined,
        }),
      })
      captureGuestSessionFromResponse(res)
      const data = (await res.json()) as {
        ok?: boolean
        error?: string
        shopTyping?: { maxWaitMs: number }
        visionPickRequired?: boolean
        requireAuth?: boolean
        authMode?: 'anonymous' | 'account'
      }
      if (res.status === 401) {
        setUserId(null)
        return
      }
      if (!res.ok) {
        if (data.requireAuth) {
          setAuthGateRequired(true)
          toast({
            title: t.guestAuthRequiredAfterLimit.replace('{count}', '5'),
            variant: 'destructive',
          })
          return
        }
        if (data.error?.startsWith('AUTH_REQUIRED_')) {
          setAuthGateRequired(true)
          toast({
            title: t.guestAuthRequiredAfterLimit.replace('{count}', '5'),
            variant: 'destructive',
          })
          return
        }
        const msg = data.error || t.sendError
        if (/large|too large|lớn/i.test(msg)) toast({ title: t.guestImageTooLarge, variant: 'destructive' })
        else if (/type|Unsupported|hỗ trợ/i.test(msg)) toast({ title: t.guestImageInvalidType, variant: 'destructive' })
        else toast({ title: msg, variant: 'destructive' })
        return
      }
      setDraft('')
      clearAttachment()
      if (pageContextRef.current) contextSeededRef.current = true
      if (data.authMode === 'account') {
        setAuthMode('account')
        setAuthGateRequired(false)
        void refreshAuthAndReload()
      }
      // For image-first flow waiting for customer product selection, do not show "shop is typing" yet.
      if (data.visionPickRequired === true) {
        setShopTyping(null)
      } else {
        const waitMs =
          data.shopTyping?.maxWaitMs && data.shopTyping.maxWaitMs > 0
            ? data.shopTyping.maxWaitMs
            : FALLBACK_SHOP_TYPING_WAIT_MS
        setShopTyping({
          deadline: Date.now() + waitMs,
          baselineOutbound: outboundBaseline,
        })
      }
      await load()
    } catch {
      toast({ title: t.sendError, variant: 'destructive' })
    } finally {
      setSending(false)
    }
  }

  const canSend = Boolean((draft.trim() || imageStoragePath) && !uploading && !(authGateRequired && authMode !== 'account'))
  const showCameraButton = isTouchDevice

  const requestGuestAuthEmail = async () => {
    const email = guestAuthEmail.trim().toLowerCase()
    if (!email) return
    setGuestAuthSending(true)
    try {
      const res = await fetch(`/api/messaging/guest/${encodeURIComponent(slug)}/auth/email/request`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ email }),
      })
      captureGuestSessionFromResponse(res)
      const data = (await res.json()) as { ok?: boolean; error?: string; retry_after_sec?: number; accountId?: string }
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
    setGuestAuthVerifying(true)
    try {
      const res = await fetch(`/api/messaging/guest/${encodeURIComponent(slug)}/auth/email/verify-otp`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ email, otp }),
      })
      captureGuestSessionFromResponse(res)
      const data = (await res.json()) as { ok?: boolean; error?: string; retry_after_sec?: number; accountId?: string }
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
      await load()
    } catch {
      toast({ title: t.guestAuthOtpInvalid, variant: 'destructive' })
    } finally {
      setGuestAuthVerifying(false)
    }
  }, [
    authHeaders,
    captureGuestSessionFromResponse,
    guestAuthEmail,
    guestAuthOtp,
    load,
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
    const qty = Math.max(1, Math.min(99, Math.floor(Number(orderQuantity) || 1)))
    const unit = parseVndFromHint(activePurchaseOptions?.price_hint || activeOrderCard?.price_hint)
    const subtotal = Math.max(0, unit * qty)
    const policyMode = activePurchaseOptions?.deposit_policy?.mode ?? 'percent'
    const policyPercent = Math.max(0, Math.min(100, Math.round(Number(activePurchaseOptions?.deposit_policy?.percent) || 30)))
    const policyFixed = Math.max(0, Math.round(Number(activePurchaseOptions?.deposit_policy?.fixed_amount) || 0))
    if (policyMode === 'none') {
      return {
        qty,
        subtotal,
        prepay: 0,
        cod: subtotal,
        text: 'Không đặt cọc trước (thanh toán khi nhận hàng)',
        canCompute: subtotal > 0,
      }
    }
    if (policyMode === 'fixed_amount') {
      const fallback20 = policyFixed > subtotal && subtotal > 0
      const required = fallback20 ? Math.ceil(subtotal * 0.2) : policyFixed
      return {
        qty,
        subtotal,
        prepay: required,
        cod: Math.max(0, subtotal - required),
        text: fallback20
          ? 'Tiền cọc vượt tổng đơn, hệ thống áp dụng 20% giá trị đơn'
          : `Đặt cọc cố định ${new Intl.NumberFormat('vi-VN').format(policyFixed)}đ`,
        canCompute: subtotal > 0,
      }
    }
    const required = Math.ceil((subtotal * policyPercent) / 100)
    return {
      qty,
      subtotal,
      prepay: required,
      cod: Math.max(0, subtotal - required),
      text: `Đặt cọc theo cài đặt shop: ${policyPercent}%`,
      canCompute: subtotal > 0,
    }
  }, [activeOrderCard?.price_hint, activePurchaseOptions?.deposit_policy?.fixed_amount, activePurchaseOptions?.deposit_policy?.mode, activePurchaseOptions?.deposit_policy?.percent, activePurchaseOptions?.price_hint, orderQuantity])

  if (!authReady) {
    return (
      <div className="flex w-full max-w-lg justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden />
      </div>
    )
  }

  const chatPane = (
      <Card className="flex h-full min-h-0 flex-col overflow-hidden bg-background rounded-none border-0 shadow-none sm:rounded-2xl sm:border sm:border-border sm:shadow-md">
        <h1 className="sr-only">{shopDisplayName}</h1>
        <CardContent className="flex min-h-0 flex-1 flex-col p-0">
          <div
            className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain bg-muted/20 px-3 py-2"
            role="log"
            aria-live="polite"
            aria-relevant="additions"
          >
            {loading && !hasLoadedOnce ? (
              <div className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              </div>
            ) : messages.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">{t.emptyThread}</p>
            ) : (
              messages.map((m) => {
                const isMe = m.direction === 'inbound'
                return (
                  <div
                    key={m.id}
                    className={`max-w-[92%] rounded-2xl px-3.5 py-2.5 text-base shadow-sm ${
                      isMe
                        ? 'ml-auto rounded-br-md bg-gradient-to-br from-violet-600 to-violet-700 text-white'
                        : 'mr-auto rounded-bl-md border border-border/60 bg-card text-foreground'
                    }`}
                  >
                    <div className={isMe ? '[&_a]:text-white/90 [&_img]:border-white/25' : ''}>
                      <CustomerCareMessageBody
                        row={{ body: m.body, raw_payload: m.raw_payload ?? null }}
                        tone={isMe ? 'onViolet' : 'default'}
                        labels={{ productCardOpenProduct: t.visionProductLink }}
                        onProductCardPick={isMe ? undefined : (card) => void submitProductCardPick(card)}
                      />
                    </div>
                    {(() => {
                      const vs = getVisionPickState(m.raw_payload)
                      if (!isMe || vs.candidates.length === 0) return null
                      return (
                        <div className="mt-2 space-y-2 border-t border-white/20 pt-2">
                          <p className="text-[11px] font-medium leading-snug text-white/95">{t.visionMatchTitle}</p>
                          {vs.required && t.visionPickHint.trim() ? (
                            <p className="text-[10px] leading-snug text-white/80">{t.visionPickHint}</p>
                          ) : null}
                          <div className="-mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]">
                            {vs.candidates.map((c) => {
                              const isSelected = vs.selectedInventoryId === c.inventoryId
                              const isBusy = visionPickBusyId === m.id
                              return (
                                <div
                                  key={c.inventoryId}
                                  role="button"
                                  tabIndex={isBusy ? -1 : 0}
                                  aria-disabled={isBusy}
                                  className={`w-36 shrink-0 snap-start overflow-hidden rounded-lg border text-left text-xs text-white transition-all ${
                                    isSelected
                                      ? 'border-white ring-2 ring-white/90 ring-offset-1 ring-offset-violet-700 opacity-100'
                                      : 'border-white/25 hover:border-white/45'
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
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                      src={c.image_url}
                                      alt=""
                                      className="h-28 w-full bg-white/10 object-contain"
                                    />
                                  ) : (
                                    <div className="h-28 w-full bg-white/5" />
                                  )}
                                  <div className="px-2 py-1.5">
                                    <div className="flex items-center justify-between gap-2">
                                      <p className="min-w-0 flex-1 truncate text-[11px] tabular-nums text-white/85">
                                        {formatVndPrice(c.price_hint) ?? ''}
                                      </p>
                                      {c.product_url ? (
                                        <a
                                          href={c.product_url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="inline-flex shrink-0 items-center whitespace-nowrap rounded-md bg-white/20 px-2 py-1 text-[10px] font-semibold leading-none text-white hover:bg-white/30"
                                          onClick={(ev) => ev.stopPropagation()}
                                        >
                                          {t.visionProductLink}
                                        </a>
                                      ) : null}
                                    </div>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                          {visionPickBusyId === m.id ? (
                            <p className="text-[10px] text-white/80">{t.visionPickBusy}</p>
                          ) : null}
                        </div>
                      )
                    })()}
                    <div className={`mt-1.5 text-[10px] ${isMe ? 'text-white/75' : 'text-muted-foreground'}`}>
                      {new Date(m.created_at).toLocaleString()}
                    </div>
                  </div>
                )
              })
            )}
            {shopTyping ? (
              <div
                className="mr-auto flex max-w-[92%] items-center gap-2 rounded-2xl rounded-bl-md border border-border/60 bg-card px-3.5 py-2.5 text-base text-muted-foreground shadow-sm"
                role="status"
                aria-live="polite"
              >
                <span className="tabular-nums">{t.shopTypingHint}</span>
                <span className="inline-flex gap-0.5" aria-hidden>
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/70 [animation-delay:0ms]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/70 [animation-delay:150ms]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/70 [animation-delay:300ms]" />
                </span>
              </div>
            ) : null}
            <div ref={scrollAnchorRef} className="h-px w-full shrink-0" aria-hidden />
          </div>

            <div className="shrink-0 space-y-2 border-t border-border bg-background p-2">
            <input
              ref={galleryInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
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

            <div className="space-y-1.5 rounded-xl border-2 border-border bg-background p-1.5">
              {imagePreviewUrl ? (
                <div className="flex items-center gap-2 overflow-hidden rounded-xl border bg-muted/30 p-1.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imagePreviewUrl}
                    alt=""
                    className="h-12 w-12 shrink-0 rounded-md object-cover"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    className="ml-auto h-7 w-7 shrink-0 rounded-md"
                    onClick={clearAttachment}
                    disabled={sending || uploading}
                    aria-label={t.guestRemoveAttachment}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : null}
              {imageStoragePath ? <p className="text-[11px] text-muted-foreground">{t.guestCaptionHint}</p> : null}
              {proofOrderId && imageStoragePath ? (
                <div className="rounded-lg border border-border/70 bg-muted/20 p-2">
                  <Button
                    type="button"
                    size="sm"
                    className="h-8 text-[11px]"
                    disabled={sending}
                    onClick={() => void submitPaymentProof()}
                  >
                    {sending ? 'Đang đối chiếu thanh toán...' : 'Gửi ảnh giao dịch và đối chiếu thanh toán'}
                  </Button>
                </div>
              ) : null}
              {buyOptionsOpen && buyOptions.length > 0 ? (
                <div className="space-y-1.5 rounded-lg border border-border/70 bg-muted/20 p-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium text-foreground">Anh/chị muốn mua sản phẩm nào?</p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-6 w-6 p-0"
                      disabled={orderFormBusy}
                      onClick={() => setBuyOptionsOpen(false)}
                      aria-label="Đóng"
                      title="Đóng"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {buyOptions.map((item) => (
                      <button
                        key={`${item.product_url}-${item.name}`}
                        type="button"
                        className="w-28 shrink-0 rounded-md border border-border bg-background p-1.5 text-left"
                        disabled={orderFormBusy}
                        onClick={() => void openOrderFormByOption(item)}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={item.image_url}
                          alt={item.name}
                          className="h-16 w-full rounded object-cover"
                        />
                        {item.price_hint ? (
                          <p className="mt-1 text-[10px] text-muted-foreground">{formatVndPrice(item.price_hint)}</p>
                        ) : null}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              {orderFormOpen ? (
                <div className="space-y-2 rounded-lg border border-border/70 bg-muted/20 p-2">
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
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={activeOrderCard.image_url}
                          alt={activeOrderCard.name}
                          className="h-10 w-10 rounded object-cover"
                        />
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
                      className="h-8 rounded-md border border-border bg-background px-2 text-[12px]"
                      placeholder="Địa chỉ"
                      value={orderAddress}
                      onChange={(e) => setOrderAddress(e.target.value)}
                    />
                    {activePurchaseOptions?.colors && activePurchaseOptions.colors.length > 0 ? (
                      <div className="h-8 rounded-md border border-border bg-muted/20 px-2 text-[11px] text-muted-foreground flex items-center">
                        Chọn màu theo ảnh bên dưới
                      </div>
                    ) : (
                      <input
                        type="text"
                        className="h-8 rounded-md border border-border bg-background px-2 text-[12px]"
                        placeholder="Màu"
                        value={orderColor}
                        onChange={(e) => setOrderColor(e.target.value)}
                      />
                    )}
                    {activePurchaseOptions?.sizes && activePurchaseOptions.sizes.length > 0 ? (
                      <select
                        className="h-8 rounded-md border border-border bg-background px-2 text-[12px]"
                        value={orderSize}
                        onChange={(e) => setOrderSize(e.target.value)}
                      >
                        <option value="">Chọn size</option>
                        {activePurchaseOptions.sizes.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        className="h-8 rounded-md border border-border bg-background px-2 text-[12px]"
                        placeholder="Size"
                        value={orderSize}
                        onChange={(e) => setOrderSize(e.target.value)}
                      />
                    )}
                    <input
                      type="text"
                      className="h-8 rounded-md border border-border bg-background px-2 text-[12px]"
                      placeholder="Số lượng"
                      value={orderQuantity}
                      onChange={(e) => setOrderQuantity(e.target.value)}
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Tiền đặt cọc được tính tự động theo cài đặt của shop.
                  </p>
                  <div className="rounded-md border border-violet-200 bg-violet-50/70 px-2 py-1.5 text-[11px] text-violet-900">
                    <p>
                      Tạm tính ({orderPreview.qty} sản phẩm):
                      {' '}Tổng đơn {new Intl.NumberFormat('vi-VN').format(orderPreview.subtotal)}đ
                      {' '}| Thanh toán trước {new Intl.NumberFormat('vi-VN').format(orderPreview.prepay)}đ
                      {' '}| Khi nhận hàng {new Intl.NumberFormat('vi-VN').format(orderPreview.cod)}đ
                    </p>
                    <p className="text-[10px] text-violet-800">
                      Chế độ: {orderPreview.text}
                      {!orderPreview.canCompute ? ' (chưa xác định được giá sản phẩm để tạm tính).' : ''}
                    </p>
                  </div>
                  {activePurchaseOptions?.colors && activePurchaseOptions.colors.length > 0 ? (
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {activePurchaseOptions.colors.map((c) => (
                        <button
                          key={`${c.name}-${c.img}`}
                          type="button"
                          className={`w-16 shrink-0 rounded-md border p-1 ${
                            orderColor === c.name ? 'border-violet-500' : 'border-border'
                          }`}
                          onClick={() => setOrderColor(c.name)}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={c.img} alt={c.name} className="h-10 w-full rounded object-cover" />
                          <p className="mt-0.5 truncate text-[10px] text-foreground">
                            {orderColor === c.name ? 'Da chon' : ''}
                          </p>
                        </button>
                      ))}
                    </div>
                  ) : null}
                  <textarea
                    className="min-h-[56px] w-full rounded-md border border-border bg-background px-2 py-1 text-[12px]"
                    placeholder="Ghi chú"
                    value={orderNote}
                    onChange={(e) => setOrderNote(e.target.value)}
                  />
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
                      className="h-8 w-8 p-0"
                      disabled={orderFormBusy}
                      onClick={() => setOrderFormOpen(false)}
                      aria-label="Đóng"
                      title="Đóng"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
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
                      <p className="text-[11px] text-muted-foreground">Đang đăng nhập, vui lòng chờ...</p>
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
                          <span
                            role="button"
                            className="absolute right-0 top-0 rounded-bl bg-black/55 px-1 text-[10px] text-white"
                            onClick={(e) => {
                              e.stopPropagation()
                              setTryOnUserFile(null)
                              if (tryOnUserInputRef.current) tryOnUserInputRef.current.value = ''
                            }}
                          >
                            ×
                          </span>
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
                                  src={item.previewUrl}
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
                                          src={item.imageUrl}
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

              {topUpOpen ? (
                <div className="space-y-2 rounded-lg border border-border/70 bg-muted/20 p-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-medium text-foreground">Nạp credit</p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => setTopUpOpen(false)}
                      aria-label="Đóng"
                      title="Đóng"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
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
                  <Button
                    type="button"
                    size="sm"
                    disabled={topUpLoading || !topUpSelectedBank || !topUpAmount.trim()}
                    onClick={() => void createTopUpPayment()}
                  >
                    {topUpLoading ? 'Đang tạo mã QR...' : 'Tạo mã QR nạp tiền'}
                  </Button>
                  <p className="text-[11px] text-muted-foreground">
                    Số dư hiện tại:{' '}
                    {tryOnCreditsLoading
                      ? '...'
                      : (typeof tryOnCreditsBalance === 'number'
                        ? formatCredits(tryOnCreditsBalance)
                        : '--')}{' '}
                    credit
                  </p>
                  {topUpPayment ? (
                    <div className="rounded-md border border-border/70 bg-background p-2">
                      <p className="text-[11px] text-muted-foreground">
                        Nạp {new Intl.NumberFormat('vi-VN').format(topUpPayment.amount)}đ
                        {' '}~ {Math.max(1, Math.floor(topUpPayment.amount / CREDIT_UNIT_PRICE_VND))} credit
                      </p>
                      <p className="mt-1 text-[11px] text-foreground">
                        Nội dung chuyển khoản: <span className="font-medium">{topUpPayment.transaction_content || '-'}</span>
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
                </div>
              ) : null}

              <div className="space-y-1.5">
                <div className="relative">
                  <Textarea
                    ref={draftTextareaRef}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onInput={autoResizeDraft}
                    onPaste={onDraftPaste}
                    placeholder={t.placeholder}
                    rows={1}
                    className="resize-none border-0 bg-transparent px-0 pb-8 pt-0.5 pr-10 text-base leading-tight shadow-none focus-visible:ring-0"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        if (canSend && !sending) void send()
                      }
                    }}
                  />
                  <Button
                    type="button"
                    className="absolute right-0 top-0 h-7 w-7 min-w-0 px-0"
                    onClick={() => void send()}
                    disabled={!canSend || sending}
                    aria-label={t.send}
                  >
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                  <div className="absolute bottom-0 left-0 z-10 flex max-w-[calc(100%-2.5rem)] items-center gap-1 overflow-x-auto pr-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="h-6 shrink-0 gap-1 px-2 text-[11px] sm:h-7 sm:text-xs"
                      disabled={uploading || sending || tryOnBusy}
                      onClick={() => setTryOnOpen((v) => !v)}
                    >
                      {tryOnBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                      {t.tryOnOpen}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-6 shrink-0 gap-1 px-2 text-[11px] sm:h-7 sm:text-xs"
                      disabled={uploading || sending}
                      onClick={() => galleryInputRef.current?.click()}
                    >
                      {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
                      {t.guestAttachPhoto}
                    </Button>
                    {showCameraButton ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-6 shrink-0 gap-1 px-2 text-[11px] sm:h-7 sm:text-xs"
                        disabled={uploading || sending}
                        onClick={() => cameraInputRef.current?.click()}
                      >
                        <Camera className="h-3.5 w-3.5" />
                        {t.guestTakePhoto}
                      </Button>
                    ) : null}
                  </div>
                </div>
                {uploading ? <p className="text-[10px] text-muted-foreground">{t.guestUploading}</p> : null}
                <p className="hidden text-[10px] leading-tight text-muted-foreground sm:block">{t.sendKeyboardHint}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
  )

  return (
    <div className="h-[100dvh] w-full overflow-hidden bg-background sm:bg-muted/20">
      <div className="mx-auto flex h-full w-full max-w-[1600px] gap-0 px-0 py-0 sm:gap-3 sm:px-3 sm:py-2">
        <aside className="hidden min-h-0 w-72 shrink-0 flex-col rounded-2xl border border-border/70 bg-background p-3 shadow-sm xl:flex">
          <div className="mb-2 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-violet-600" aria-hidden />
            <p className="text-sm font-semibold">{t.pageTitleSuffix}</p>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">{t.subline}</p>
          <div className="mt-4 space-y-2">
            <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-sm">{t.tryOnOpen}</div>
            <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-sm">{t.guestAttachPhoto}</div>
            <Link
              href="/messaging/my-chats"
              className="block rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-sm hover:bg-muted/50"
            >
              {t.linkMyShops}
            </Link>
          </div>
          <p className="mt-auto text-[11px] text-muted-foreground">{t.pollNote}</p>
        </aside>

        <aside className="hidden min-h-0 w-80 shrink-0 flex-col rounded-2xl border border-border/70 bg-background p-2 shadow-sm lg:flex">
          <div className="mb-2 flex items-center gap-2 px-2">
            <MessageSquareText className="h-4 w-4 text-violet-600" aria-hidden />
            <p className="text-sm font-semibold">{t.linkMyShops}</p>
          </div>
          <div className="min-h-0 flex-1 space-y-1 overflow-y-auto">
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
                          <p className="line-clamp-1 text-xs text-muted-foreground">{row.lastMessagePreview}</p>
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
        </aside>

        <div className="min-h-0 min-w-0 flex-1">{chatPane}</div>
      </div>
    </div>
  )
}
