'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { CustomerCareMessageBody } from '@/components/messaging/customer-care-message-body'
import { useToast } from '@/hooks/use-toast'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import type { Json } from '@/types/database.types'
import { sanitizeLoginNext } from '@/lib/auth/sanitize-login-next'
import { createClient } from '@/lib/supabase/client'
import { Camera, ImagePlus, Loader2, MessageSquareText, Send, Sparkles, Store, X } from 'lucide-react'

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

type T = Dictionary['partnerGuestChat']
const TRY_ON_COST_2K = 1
const MAX_TRY_ON_GARMENTS = 4

type SelectedImage = {
  file: File
  previewUrl: string
}

type ChatRailItem = {
  conversationId: string
  shopName: string
  slug: string
  lastMessageAt: string | null
  lastMessagePreview: string | null
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
  const pathname = usePathname()
  const [authReady, setAuthReady] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [messages, setMessages] = useState<GuestMsg[]>([])
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false)
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  /** Sau khi gửi tin: server báo AI/FAQ đang trả lời — poll nhanh và hiện “đang soạn tin”. */
  const [shopTyping, setShopTyping] = useState<{ deadline: number; baselineOutbound: number } | null>(null)
  const [uploading, setUploading] = useState(false)
  const [isTouchDevice, setIsTouchDevice] = useState(false)
  const [tryOnOpen, setTryOnOpen] = useState(false)
  const [tryOnBusy, setTryOnBusy] = useState(false)
  const [tryOnUserFile, setTryOnUserFile] = useState<File | null>(null)
  const [tryOnGarmentFiles, setTryOnGarmentFiles] = useState<SelectedImage[]>([])
  const [tryOnUserPreviewUrl, setTryOnUserPreviewUrl] = useState<string | null>(null)
  const [imageStoragePath, setImageStoragePath] = useState<string | null>(null)
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null)
  const [visionPickBusyId, setVisionPickBusyId] = useState<string | null>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const tryOnUserInputRef = useRef<HTMLInputElement>(null)
  const tryOnGarmentInputRef = useRef<HTMLInputElement>(null)
  const scrollAnchorRef = useRef<HTMLDivElement>(null)
  const didInitialAutoScrollRef = useRef(false)
  const draftTextareaRef = useRef<HTMLTextAreaElement>(null)

  const loginHref = `/auth/login?next=${encodeURIComponent(sanitizeLoginNext(pathname || `/messaging/p/${slug}`))}`

  useEffect(() => {
    const supabase = createClient()
    void supabase.auth.getSession().then(({ data }) => {
      setUserId(data.session?.user.id ?? null)
      setAuthReady(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user.id ?? null)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  const load = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/messaging/guest/${encodeURIComponent(slug)}`, { credentials: 'same-origin' })
      const data = (await res.json()) as { messages?: GuestMsg[]; error?: string }
      if (res.status === 401) {
        setUserId(null)
        return
      }
      if (!res.ok) {
        toast({ title: data.error || t.loadError, variant: 'destructive' })
        return
      }
      const next = Array.isArray(data.messages) ? data.messages : []
      setMessages(next)
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
  }, [slug, userId, toast, t.loadError])

  useEffect(() => {
    if (userId) void load()
  }, [userId, load])

  useEffect(() => {
    didInitialAutoScrollRef.current = false
  }, [slug, userId])

  useEffect(() => {
    if (!userId) return
    const id = window.setInterval(() => void load(), 18000)
    return () => window.clearInterval(id)
  }, [userId, load])

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
  }, [shopTyping?.deadline])

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
        URL.revokeObjectURL(item.previewUrl)
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
  }, [messages.length, shopTyping?.deadline])

  const addTryOnGarmentFile = (file: File | null) => {
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
    const previewUrl = URL.createObjectURL(file)
    setTryOnGarmentFiles((prev) => [...prev, { file, previewUrl }])
  }

  const removeTryOnGarmentAt = (index: number) => {
    setTryOnGarmentFiles((prev) => {
      const target = prev[index]
      if (target) URL.revokeObjectURL(target.previewUrl)
      return prev.filter((_, i) => i !== index)
    })
  }

  const clearAttachment = () => {
    setImageStoragePath(null)
    setImagePreviewUrl(null)
    if (galleryInputRef.current) galleryInputRef.current.value = ''
    if (cameraInputRef.current) cameraInputRef.current.value = ''
  }

  const submitVisionPick = async (messageId: string, inventoryId: string) => {
    if (!userId) return
    setVisionPickBusyId(messageId)
    const outboundBaseline = messages.filter((m) => m.direction === 'outbound').length
    try {
      const res = await fetch(`/api/messaging/guest/${encodeURIComponent(slug)}/vision-pick`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId, inventoryId }),
      })
      const data = (await res.json()) as { ok?: boolean; error?: string; shopTyping?: { maxWaitMs: number } }
      if (res.status === 401) {
        setUserId(null)
        return
      }
      if (!res.ok) {
        toast({ title: data.error || t.visionPickError, variant: 'destructive' })
        return
      }
      await load()
      if (data.shopTyping?.maxWaitMs && data.shopTyping.maxWaitMs > 0) {
        setShopTyping({
          deadline: Date.now() + data.shopTyping.maxWaitMs,
          baselineOutbound: outboundBaseline,
        })
      }
    } catch {
      toast({ title: t.visionPickError, variant: 'destructive' })
    } finally {
      setVisionPickBusyId(null)
    }
  }

  const uploadFile = async (file: File) => {
    if (!userId) return
    if (!file.type.startsWith('image/')) {
      toast({ title: t.guestImageInvalidType, variant: 'destructive' })
      return
    }
    setUploading(true)
    try {
      const fd = new FormData()
      fd.set('file', file)
      const res = await fetch(`/api/messaging/guest/${encodeURIComponent(slug)}/image`, {
        method: 'POST',
        body: fd,
        credentials: 'same-origin',
      })
      const data = (await res.json()) as { path?: string; publicUrl?: string; error?: string }
      if (res.status === 401) {
        setUserId(null)
        return
      }
      if (!res.ok || !data.path) {
        toast({ title: data.error || t.sendError, variant: 'destructive' })
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

  const onPickGallery = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) void uploadFile(f)
  }

  const onPickCamera = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) void uploadFile(f)
  }

  const onDraftPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    if (!userId || uploading || sending || tryOnBusy) return
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
    if (!userId) return
    if (!tryOnUserFile || tryOnGarmentFiles.length === 0) {
      toast({ title: t.tryOnNeedBoth, variant: 'destructive' })
      return
    }
    setTryOnBusy(true)
    try {
      const fd = new FormData()
      fd.set('userImage', tryOnUserFile)
      tryOnGarmentFiles.forEach((item, idx) => fd.set(`garmentImage${idx}`, item.file))
      fd.set('garmentCount', String(tryOnGarmentFiles.length))
      fd.set('imageQuality', '2K')

      const res = await fetch(`/api/messaging/guest/${encodeURIComponent(slug)}/try-on`, {
        method: 'POST',
        body: fd,
        credentials: 'same-origin',
      })
      const data = (await res.json()) as {
        ok?: boolean
        resultUrl?: string
        error?: string
        deductedCredits?: number
        creditsRemaining?: number
      }
      if (res.status === 401) {
        setUserId(null)
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
        prev.forEach((item) => URL.revokeObjectURL(item.previewUrl))
        return []
      })
      if (tryOnUserInputRef.current) tryOnUserInputRef.current.value = ''
      if (tryOnGarmentInputRef.current) tryOnGarmentInputRef.current.value = ''
      const remaining =
        typeof data.creditsRemaining === 'number' ? formatCredits(Math.max(0, data.creditsRemaining)) : null
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

  const send = async () => {
    const text = draft.trim()
    if (!userId) return
    if (!text && !imageStoragePath) return
    const outboundBaseline = messages.filter((m) => m.direction === 'outbound').length
    setSending(true)
    try {
      const res = await fetch(`/api/messaging/guest/${encodeURIComponent(slug)}`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text || undefined,
          imageStoragePath: imageStoragePath || undefined,
        }),
      })
      const data = (await res.json()) as {
        ok?: boolean
        error?: string
        shopTyping?: { maxWaitMs: number }
        visionPickRequired?: boolean
      }
      if (res.status === 401) {
        setUserId(null)
        return
      }
      if (!res.ok) {
        const msg = data.error || t.sendError
        if (/large|too large|lớn/i.test(msg)) toast({ title: t.guestImageTooLarge, variant: 'destructive' })
        else if (/type|Unsupported|hỗ trợ/i.test(msg)) toast({ title: t.guestImageInvalidType, variant: 'destructive' })
        else toast({ title: msg, variant: 'destructive' })
        return
      }
      setDraft('')
      clearAttachment()
      await load()
      if (data.shopTyping?.maxWaitMs && data.shopTyping.maxWaitMs > 0) {
        setShopTyping({
          deadline: Date.now() + data.shopTyping.maxWaitMs,
          baselineOutbound: outboundBaseline,
        })
      }
    } catch {
      toast({ title: t.sendError, variant: 'destructive' })
    } finally {
      setSending(false)
    }
  }

  const canSend = Boolean(userId && (draft.trim() || imageStoragePath) && !uploading)
  const showCameraButton = isTouchDevice
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

  if (!authReady) {
    return (
      <div className="flex w-full max-w-lg justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden />
      </div>
    )
  }

  if (!userId) {
    return (
      <div className="w-full max-w-lg">
        <Card className="border-border/70 shadow-md">
          <CardHeader>
            <CardTitle>{t.loginPromptTitle}</CardTitle>
            <CardDescription>{t.loginPromptDescription}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link href={loginHref}>{t.signInWithGoogle}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const chatPane = (
      <Card className="flex h-full min-h-0 flex-col overflow-hidden border-border shadow-md bg-background">
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
                    className={`max-w-[92%] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm ${
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
                      />
                    </div>
                    {(() => {
                      const vs = getVisionPickState(m.raw_payload)
                      if (!isMe || vs.candidates.length === 0) return null
                      return (
                        <div className="mt-2 space-y-2 border-t border-white/20 pt-2">
                          <p className="text-[11px] font-medium leading-snug text-white/95">{t.visionMatchTitle}</p>
                          {vs.required ? (
                            <p className="text-[10px] leading-snug text-white/80">{t.visionPickHint}</p>
                          ) : null}
                          <div className="-mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]">
                            {vs.candidates.map((c) => {
                              const isSelected = vs.selectedInventoryId === c.inventoryId
                              return (
                                <button
                                  key={c.inventoryId}
                                  type="button"
                                  disabled={visionPickBusyId === m.id}
                                  className={`w-36 shrink-0 snap-start overflow-hidden rounded-lg border text-left text-xs text-white transition-all disabled:opacity-50 ${
                                    isSelected
                                      ? 'border-white ring-2 ring-white/90 ring-offset-1 ring-offset-violet-700 opacity-100'
                                      : 'border-white/25 hover:border-white/45'
                                  }`}
                                  onClick={() => void submitVisionPick(m.id, c.inventoryId)}
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
                                </button>
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
                className="mr-auto flex max-w-[92%] items-center gap-2 rounded-2xl rounded-bl-md border border-border/60 bg-card px-3.5 py-2.5 text-sm text-muted-foreground shadow-sm"
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
                    onChange={(e) => setTryOnUserFile(e.target.files?.[0] ?? null)}
                  />
                  <input
                    ref={tryOnGarmentInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      addTryOnGarmentFile(e.target.files?.[0] ?? null)
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
                          <img src={tryOnUserPreviewUrl} alt="" className="h-full w-full object-cover" />
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
                              <div key={`${item.file.name}-${idx}`} className="relative h-12 w-12 overflow-hidden rounded-md border bg-background/70">
                                <img src={item.previewUrl} alt="" className="h-full w-full object-cover" />
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
                                onClick={() => tryOnGarmentInputRef.current?.click()}
                              >
                                <ImagePlus className="h-4 w-4" />
                              </button>
                            )
                          }
                          return <div key={`empty-slot-${idx}`} className="h-12 w-12 rounded-md border border-dashed border-border/70 bg-background/40" />
                        })}
                      </div>
                    </div>
                  </div>
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
                    className="resize-none border-0 bg-transparent px-0 pb-8 pt-0.5 pr-10 text-sm leading-tight shadow-none focus-visible:ring-0"
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
                  <div className="absolute bottom-0 left-0 z-10 flex max-w-[calc(100%-2.5rem)] flex-wrap items-center gap-1">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="h-7 gap-1 px-2 text-xs"
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
                      className="h-7 gap-1 px-2 text-xs"
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
                        className="h-7 gap-1 px-2 text-xs"
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
                <p className="text-[10px] leading-tight text-muted-foreground">{t.sendKeyboardHint}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
  )

  return (
    <div className="h-[100dvh] w-full overflow-hidden bg-muted/20">
      <div className="mx-auto flex h-full w-full max-w-[1600px] gap-3 px-2 py-2 sm:px-3">
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
