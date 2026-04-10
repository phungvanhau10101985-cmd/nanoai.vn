'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import type { Database } from '@/types/database.types'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import {
  listPartnerConversations,
  listPartnerMessages,
  removeMyMessagingWorkspace,
  sendPartnerReply,
} from '@/app/dashboard/messaging/actions'
import { CustomerCareMessageBody } from '@/components/messaging/customer-care-message-body'
import {
  CalendarDays,
  Camera,
  ClipboardList,
  Headphones,
  ImagePlus,
  Loader2,
  MessageSquare,
  Phone,
  RefreshCw,
  Search,
  Send,
  Settings,
  StickyNote,
  Trash2,
  Users,
  X,
} from 'lucide-react'

const DELETE_WORKSPACE_CONFIRM_TOKEN = 'XOA'

type ConvRow = Database['public']['Tables']['customer_care_conversations']['Row']
type MsgRow = Database['public']['Tables']['customer_care_messages']['Row']
type PartnerRow = Database['public']['Tables']['messaging_partners']['Row']
type T = Dictionary['partnerMessaging']

function channelLabel(ch: string, t: T) {
  if (ch === 'facebook') return t.channelFacebook
  if (ch === 'zalo') return t.channelZalo
  if (ch === 'widget') return t.channelWidget
  return ch
}

function customerInitials(name: string | null, unknownLabel: string) {
  const s = (name || unknownLabel).trim()
  if (!s) return '?'
  const parts = s.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase().slice(0, 2)
  return s.slice(0, 2).toUpperCase()
}

/** dd.MM — gọn như cột thời gian inbox kiểu Pancake */
function shortThreadDate(iso: string | null) {
  if (!iso) return ''
  const d = new Date(iso)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}.${mm}`
}

export function PartnerMessagingInboxClient({ initialPartners, t }: { initialPartners: PartnerRow[]; t: T }) {
  const router = useRouter()
  const { toast } = useToast()
  const [partners, setPartners] = useState<PartnerRow[]>(initialPartners)
  const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(initialPartners[0]?.id ?? null)
  const [conversations, setConversations] = useState<ConvRow[]>([])
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null)
  const [messages, setMessages] = useState<MsgRow[]>([])
  const [draft, setDraft] = useState('')
  const [pending, startTransition] = useTransition()
  const [loadingMsgs, setLoadingMsgs] = useState(false)
  const [imageStoragePath, setImageStoragePath] = useState<string | null>(null)
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [composerHeight, setComposerHeight] = useState(0)
  const [inboxQuery, setInboxQuery] = useState('')
  const galleryInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const composerRef = useRef<HTMLDivElement>(null)

  const selectedConv = selectedConvId ? conversations.find((c) => c.id === selectedConvId) : undefined

  const filteredConversations = useMemo(() => {
    const q = inboxQuery.trim().toLowerCase()
    if (!q) return conversations
    return conversations.filter(
      (c) =>
        (c.customer_name || '').toLowerCase().includes(q) ||
        (c.last_message_preview || '').toLowerCase().includes(q)
    )
  }, [conversations, inboxQuery])

  const refreshConversations = useCallback(() => {
    if (!selectedPartnerId) return
    startTransition(async () => {
      const res = await listPartnerConversations(selectedPartnerId)
      if ('error' in res && res.error) {
        toast({ title: res.error, variant: 'destructive' })
        return
      }
      if ('rows' in res) setConversations(res.rows ?? [])
    })
  }, [selectedPartnerId, toast])

  useEffect(() => {
    refreshConversations()
  }, [selectedPartnerId, refreshConversations])

  useEffect(() => {
    if (!selectedPartnerId) return
    const id = window.setInterval(() => void refreshConversations(), 26000)
    return () => window.clearInterval(id)
  }, [selectedPartnerId, refreshConversations])

  useEffect(() => {
    if (!selectedPartnerId || !selectedConvId) return
    const id = window.setInterval(() => {
      listPartnerMessages(selectedPartnerId, selectedConvId).then((res) => {
        if ('rows' in res) setMessages(res.rows ?? [])
      })
    }, 14000)
    return () => window.clearInterval(id)
  }, [selectedPartnerId, selectedConvId])

  useEffect(() => {
    if (!partners.length) {
      if (selectedPartnerId !== null) setSelectedPartnerId(null)
      return
    }
    if (selectedPartnerId && partners.some((p) => p.id === selectedPartnerId)) return
    setSelectedPartnerId(partners[0]?.id ?? null)
  }, [partners, selectedPartnerId])

  const clearAttachment = useCallback(() => {
    setImageStoragePath(null)
    setImagePreviewUrl(null)
    if (galleryInputRef.current) galleryInputRef.current.value = ''
    if (cameraInputRef.current) cameraInputRef.current.value = ''
  }, [])

  useEffect(() => {
    clearAttachment()
  }, [selectedConvId, clearAttachment])

  useEffect(() => {
    if (!selectedPartnerId || !selectedConvId) {
      setMessages([])
      return
    }
    setLoadingMsgs(true)
    listPartnerMessages(selectedPartnerId, selectedConvId)
      .then((res) => {
        if ('error' in res && res.error) {
          toast({ title: res.error, variant: 'destructive' })
          setMessages([])
          return
        }
        if ('rows' in res) setMessages(res.rows ?? [])
      })
      .finally(() => setLoadingMsgs(false))
  }, [selectedPartnerId, selectedConvId, toast])

  useLayoutEffect(() => {
    if (!selectedConvId) {
      setComposerHeight(0)
      return
    }
    const el = composerRef.current
    if (!el) return
    const measure = () => setComposerHeight(el.offsetHeight)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [selectedConvId, imagePreviewUrl, draft, uploading])

  const uploadPartnerImage = async (file: File) => {
    if (!selectedPartnerId) return
    if (!file.type.startsWith('image/')) {
      toast({ title: t.partnerImageInvalidType, variant: 'destructive' })
      return
    }
    setUploading(true)
    try {
      const fd = new FormData()
      fd.set('partnerId', selectedPartnerId)
      fd.set('file', file)
      const res = await fetch('/api/messaging/partner/image', { method: 'POST', body: fd, credentials: 'same-origin' })
      const data = (await res.json()) as { path?: string; publicUrl?: string; error?: string }
      if (!res.ok || !data.path) {
        const msg = data.error || 'Upload failed.'
        if (/large|too large|lớn/i.test(msg)) toast({ title: t.partnerImageTooLarge, variant: 'destructive' })
        else if (/type|Unsupported|hỗ trợ|Unsupported image/i.test(msg))
          toast({ title: t.partnerImageInvalidType, variant: 'destructive' })
        else toast({ title: msg, variant: 'destructive' })
        clearAttachment()
        return
      }
      setImageStoragePath(data.path)
      setImagePreviewUrl(data.publicUrl ?? null)
    } catch {
      toast({ title: t.partnerImageInvalidType, variant: 'destructive' })
      clearAttachment()
    } finally {
      setUploading(false)
    }
  }

  const onPickGallery = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) void uploadPartnerImage(f)
  }

  const onPickCamera = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) void uploadPartnerImage(f)
  }

  const onReplyPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    if (!selectedPartnerId || uploading || pending) return
    const cd = e.clipboardData
    if (!cd) return
    const attachFirstImage = (f: File | null) => {
      if (!f?.type.startsWith('image/')) return false
      e.preventDefault()
      void uploadPartnerImage(f)
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

  const canSend = Boolean(selectedPartnerId && selectedConvId && (draft.trim() || imageStoragePath) && !uploading)

  const send = () => {
    if (!selectedPartnerId || !selectedConvId || (!draft.trim() && !imageStoragePath)) return
    startTransition(async () => {
      const res = await sendPartnerReply(
        selectedPartnerId,
        selectedConvId,
        draft,
        imageStoragePath ?? undefined
      )
      if ('error' in res && res.error) {
        const msg = res.error
        if (/large|too large|lớn/i.test(msg)) toast({ title: t.partnerImageTooLarge, variant: 'destructive' })
        else if (/type|Unsupported|Invalid image/i.test(msg)) toast({ title: t.partnerImageInvalidType, variant: 'destructive' })
        else toast({ title: msg, variant: 'destructive' })
        return
      }
      setDraft('')
      clearAttachment()
      const msgs = await listPartnerMessages(selectedPartnerId, selectedConvId)
      if ('rows' in msgs) setMessages(msgs.rows ?? [])
      refreshConversations()
    })
  }

  const removeWorkspace = () => {
    if (!selectedPartnerId) return
    const confirmation = window.prompt(t.deleteWorkspaceConfirm, '')
    if (confirmation === null) return
    if (confirmation.trim().toUpperCase() !== DELETE_WORKSPACE_CONFIRM_TOKEN) {
      toast({ title: `Xac nhan khong dung (${DELETE_WORKSPACE_CONFIRM_TOKEN}).`, variant: 'destructive' })
      return
    }
    const removingId = selectedPartnerId
    startTransition(async () => {
      const res = await removeMyMessagingWorkspace(removingId)
      if ('error' in res && res.error) {
        toast({ title: res.error, variant: 'destructive' })
        return
      }
      setPartners((prev) => {
        const next = prev.filter((p) => p.id !== removingId)
        setSelectedPartnerId(next[0]?.id ?? null)
        return next
      })
      setSelectedConvId(null)
      setMessages([])
      setConversations([])
      toast({ title: t.deleteWorkspaceSuccess })
      router.refresh()
    })
  }

  if (partners.length === 0) {
    return (
      <div className="rounded-xl border border-border/70 bg-card/90 p-6 shadow-sm">
        <p className="text-sm text-muted-foreground mb-4">{t.noWorkspaceInboxCta}</p>
        <Button asChild>
          <Link href="/dashboard/messaging/settings">{t.messagingSettingsLink}</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="relative flex h-full min-h-0 flex-col gap-0.5">
      <div className="flex shrink-0 flex-wrap items-center gap-1 border-b border-border/40 pb-0.5">
        <Select
          value={selectedPartnerId ?? undefined}
          onValueChange={(v) => {
            setSelectedPartnerId(v)
            setSelectedConvId(null)
          }}
        >
          <SelectTrigger className="h-7 w-full max-w-xs bg-background text-[11px]">
            <SelectValue placeholder={t.workspaceLabel} />
          </SelectTrigger>
          <SelectContent>
            {partners.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.display_name} ({p.industry_key || 'fashion'})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 px-2 text-[11px]"
          onClick={refreshConversations}
          disabled={pending || !selectedPartnerId}
        >
          <RefreshCw className="mr-1 h-3 w-3" aria-hidden />
          {t.refresh}
        </Button>
        <Button type="button" variant="secondary" size="sm" asChild className="h-7 gap-1 px-2 text-[11px]">
          <Link href="/dashboard/messaging/settings">
            <Settings className="h-3 w-3" aria-hidden />
            {t.messagingSettingsLink}
          </Link>
        </Button>
        <Button type="button" variant="secondary" size="sm" asChild className="h-7 gap-1 px-2 text-[11px]">
          <Link href="/dashboard/messaging/orders">
            <ClipboardList className="h-3 w-3" aria-hidden />
            Don hang
          </Link>
        </Button>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          className="h-7 gap-1 px-2 text-[11px]"
          onClick={removeWorkspace}
          disabled={pending || !selectedPartnerId}
        >
          <Trash2 className="h-3 w-3" aria-hidden />
          {t.deleteWorkspaceButton}
        </Button>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-[auto_minmax(0,1fr)] divide-y divide-border/60 overflow-hidden overscroll-y-contain rounded-md border border-border/60 bg-muted/20 md:grid-cols-[minmax(0,270px)_1fr] md:grid-rows-1 md:divide-x md:divide-y-0 md:items-stretch lg:grid-cols-[34px_minmax(0,270px)_minmax(0,1fr)_minmax(0,250px)]">
        <aside className="hidden min-h-0 flex-col border-r border-border/60 bg-violet-50/60 lg:flex">
          <div className="flex h-10 items-center justify-center border-b border-border/60">
            <MessageSquare className="h-4 w-4 text-violet-700" aria-hidden />
          </div>
          <div className="flex flex-1 flex-col items-center gap-1.5 py-2">
            <button type="button" className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-violet-600 text-white shadow-sm">
              <Headphones className="h-3.5 w-3.5" aria-hidden />
            </button>
            <button type="button" className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted">
              <Phone className="h-3.5 w-3.5" aria-hidden />
            </button>
            <button type="button" className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted">
              <Users className="h-3.5 w-3.5" aria-hidden />
            </button>
            <button type="button" className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted">
              <CalendarDays className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
        </aside>

        <aside className="flex h-[min(34vh,300px)] min-h-[170px] max-md:shrink-0 flex-col overflow-hidden overscroll-y-contain md:h-full md:min-h-0 md:border-b-0 md:border-r md:border-border/40">
          <div className="shrink-0 space-y-1 border-b border-border/40 bg-muted/15 px-2 py-1">
            <p className="px-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{t.inboxTitle}</p>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                value={inboxQuery}
                onChange={(e) => setInboxQuery(e.target.value)}
                placeholder={t.inboxSearchPlaceholder}
                className="h-8 border-border/60 bg-background pl-8 text-xs"
                aria-label={t.inboxSearchPlaceholder}
              />
            </div>
          </div>
          <ul className="min-h-0 flex-1 space-y-px overflow-y-auto overflow-x-hidden overscroll-contain p-1 text-sm touch-pan-y">
            {conversations.length === 0 ? (
              <li className="px-2 py-5 text-center text-[11px] text-muted-foreground">{t.pickConversation}</li>
            ) : filteredConversations.length === 0 ? (
              <li className="px-2 py-5 text-center text-[11px] text-muted-foreground">{t.inboxNoSearchResults}</li>
            ) : (
              filteredConversations.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedConvId(c.id)}
                    className={`flex w-full gap-2 rounded-md px-2 py-1.5 text-left transition-colors ${
                      selectedConvId === c.id
                        ? 'bg-violet-600/12 ring-1 ring-violet-500/25 dark:bg-violet-950/35'
                        : 'hover:bg-muted/70'
                    }`}
                  >
                    {c.customer_avatar_url ? (
                      <img
                        src={c.customer_avatar_url}
                        alt=""
                        className="mt-0.5 h-8 w-8 shrink-0 rounded-full object-cover ring-1 ring-border/40"
                      />
                    ) : (
                      <div
                        className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground ring-1 ring-border/40"
                        aria-hidden
                      >
                        {customerInitials(c.customer_name, t.unknownUser)}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-1.5">
                        <span className="line-clamp-1 text-xs font-semibold leading-tight text-foreground">
                          {c.customer_name || t.unknownUser}
                        </span>
                        <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                          {shortThreadDate(c.last_message_at || c.updated_at)}
                        </span>
                      </div>
                      <div className="mt-0.5 line-clamp-1 text-[10px] leading-snug text-muted-foreground">
                        {c.last_message_preview || '—'}
                      </div>
                      <Badge variant="outline" className="mt-1 h-4 border-border/50 px-1.5 py-0 text-[8px] font-normal leading-none">
                        {channelLabel(c.channel, t)}
                      </Badge>
                    </div>
                  </button>
                </li>
              ))
            )}
          </ul>
        </aside>

        <section className="flex min-h-0 flex-col overflow-hidden overscroll-y-contain bg-muted/30 md:h-full">
          {!selectedConvId ? (
            <div className="flex min-h-[10rem] flex-1 items-center justify-center px-4 py-6 text-center text-[13px] text-muted-foreground md:min-h-0">
              {t.pickConversation}
            </div>
          ) : (
            <>
              {selectedConv ? (
                <div className="flex shrink-0 items-center gap-1.5 border-b border-border/60 bg-background/95 px-2 py-1">
                  {selectedConv.customer_avatar_url ? (
                    <img
                      src={selectedConv.customer_avatar_url}
                      alt=""
                      className="h-6 w-6 shrink-0 rounded-full object-cover ring-1 ring-border/40"
                    />
                  ) : (
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-[9px] font-semibold text-muted-foreground ring-1 ring-border/40">
                      {customerInitials(selectedConv.customer_name, t.unknownUser)}
                    </div>
                  )}
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <span className="truncate text-xs font-semibold leading-none">
                      {selectedConv.customer_name || t.unknownUser}
                    </span>
                    <Badge variant="secondary" className="max-h-5 shrink-0 px-1 py-0 text-[8px] font-normal leading-tight">
                      {channelLabel(selectedConv.channel, t)}
                    </Badge>
                  </div>
                </div>
              ) : null}
              <div
                className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-2 py-1.5 touch-pan-y sm:px-2.5"
                style={{ paddingBottom: composerHeight > 0 ? composerHeight + 6 : undefined }}
              >
                {loadingMsgs ? (
                  <div className="text-[13px] text-muted-foreground">…</div>
                ) : messages.length === 0 ? (
                  <div className="text-[13px] text-muted-foreground">{t.noMessages}</div>
                ) : (
                  messages.map((m) => (
                    <div
                      key={m.id}
                      className={`mb-1.5 max-w-[min(100%,560px)] ${
                        m.direction === 'outbound'
                          ? 'ml-auto rounded-2xl rounded-br-sm bg-gradient-to-br from-violet-600 to-violet-700 px-2.5 py-1.5 text-[12px] leading-relaxed text-white shadow-md'
                          : 'mr-auto rounded-2xl rounded-bl-sm border border-border/70 bg-card px-2.5 py-1.5 text-[12px] leading-relaxed shadow-sm'
                      }`}
                    >
                      <div className={m.direction === 'outbound' ? '[&_img]:max-w-full [&_img]:rounded-md [&_img]:ring-1 [&_img]:ring-white/25' : '[&_img]:max-w-full [&_img]:rounded-md'}>
                        {m.direction === 'outbound' ? (
                          m.raw_payload ? (
                            <CustomerCareMessageBody
                              row={m}
                              tone="onViolet"
                              labels={{ productCardOpenProduct: t.messageProductCardOpenProduct }}
                            />
                          ) : (
                            <div className="whitespace-pre-wrap break-words">{m.body}</div>
                          )
                        ) : (
                          <CustomerCareMessageBody
                            row={m}
                            labels={{ productCardOpenProduct: t.messageProductCardOpenProduct }}
                          />
                        )}
                      </div>
                      <div
                        className={`mt-1 text-[9px] tabular-nums ${m.direction === 'outbound' ? 'text-white/70' : 'text-muted-foreground'}`}
                      >
                        {new Date(m.created_at).toLocaleString()}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </section>

        <aside className="hidden min-h-0 flex-col border-l border-border/60 bg-background/95 lg:flex">
          <div className="grid grid-cols-2 border-b border-border/40 text-[11px]">
            <div className="border-r border-border/40 bg-muted/25 px-2 py-1.5 text-center font-semibold text-foreground">
                {t.inboxSideInfoTab}
            </div>
            <div className="px-2 py-1.5 text-center text-muted-foreground">{t.inboxSideOrderTab}</div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            <div className="rounded-md border border-border/50 bg-muted/20 p-2">
              <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium text-foreground">
                <StickyNote className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                {selectedConvId ? t.inboxSideNoNotes : t.pickConversation}
              </div>
              <Input
                placeholder={t.inboxSideNotePlaceholder}
                className="h-7 border-border/60 bg-background text-[11px]"
                readOnly={!selectedConvId}
                disabled={!selectedConvId}
              />
            </div>

            <div className="mt-2 rounded-md border border-border/50 bg-muted/20 p-2">
              <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium text-foreground">
                <ClipboardList className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                {t.inboxSideOrderTab}
              </div>
              <p className="text-[11px] text-muted-foreground">{selectedConvId ? t.inboxSideOrderEmpty : t.pickConversation}</p>
              <Button type="button" size="sm" variant="secondary" className="mt-2 h-7 px-2.5 text-[11px]" disabled={!selectedConvId}>
                {t.inboxSideCreateOrder}
              </Button>
            </div>
          </div>
        </aside>
      </div>

      {selectedConvId ? (
        <div
          ref={composerRef}
          className="fixed bottom-[5.5rem] left-0 right-0 z-[45] border-t border-border/70 bg-background/97 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_18px_rgba(0,0,0,0.08)] backdrop-blur-md md:bottom-0"
        >
          <div className="mx-auto w-full max-w-7xl px-2 py-1.5 sm:px-3 lg:px-5 xl:px-6">
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

            <div className="grid grid-cols-1 md:grid-cols-[270px_minmax(0,1fr)] lg:grid-cols-[34px_270px_minmax(0,1fr)_250px]">
              <div className="hidden lg:block" />
              <div className="hidden md:block" />
              <div className="min-w-0">
                {/* Khung soạn tin chỉ nằm trong cột giữa */}
                <div className="rounded-md border border-border/70 bg-muted/5 shadow-sm transition-[box-shadow] focus-within:border-violet-500/55 focus-within:ring-1 focus-within:ring-violet-500/20">
                  {imagePreviewUrl ? (
                    <div className="relative border-b border-border/50 bg-muted/30 p-1">
                      <img src={imagePreviewUrl} alt="" className="mx-auto max-h-[4.5rem] rounded object-contain" />
                      <Button
                        type="button"
                        variant="secondary"
                        size="icon"
                        className="absolute right-1 top-1 h-6 w-6 rounded-full shadow-sm"
                        onClick={clearAttachment}
                        disabled={pending || uploading}
                        aria-label={t.partnerRemoveAttachmentAria}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : null}

                  {imageStoragePath ? (
                    <p className="border-b border-border/50 px-2 py-0.5 text-[9px] leading-tight text-muted-foreground">{t.partnerCaptionHint}</p>
                  ) : null}

                  <div className="relative">
                    <Textarea
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onPaste={onReplyPaste}
                      placeholder={t.replyPlaceholder}
                      rows={2}
                      className="min-h-[2.625rem] resize-none rounded-none border-0 bg-transparent py-1.5 pl-2 pr-[5.75rem] pb-8 text-xs leading-snug text-foreground shadow-none placeholder:text-muted-foreground/80 focus-visible:ring-0 focus-visible:ring-offset-0 sm:min-h-[2.875rem] sm:text-[13px]"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault()
                          if (!pending && canSend) send()
                        }
                      }}
                    />
                    <div className="pointer-events-none absolute bottom-1 right-1 flex items-center gap-px">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="pointer-events-auto h-7 w-7 text-muted-foreground hover:bg-muted hover:text-foreground"
                        disabled={uploading || pending}
                        onClick={() => galleryInputRef.current?.click()}
                        aria-label={t.partnerAttachPhoto}
                      >
                        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="pointer-events-auto h-7 w-7 text-muted-foreground hover:bg-muted hover:text-foreground"
                        disabled={uploading || pending}
                        onClick={() => cameraInputRef.current?.click()}
                        aria-label={t.partnerTakePhoto}
                      >
                        <Camera className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        onClick={send}
                        disabled={pending || !canSend}
                        className="pointer-events-auto h-7 w-7 rounded-full bg-gradient-to-br from-violet-600 to-violet-700 text-white shadow-sm hover:from-violet-600/95 hover:to-violet-700/95 disabled:opacity-40"
                        aria-label={t.send}
                      >
                        <Send className="h-3.5 w-3.5" aria-hidden />
                      </Button>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-1 border-t border-border/50 px-2 py-0.5">
                    <p className="min-w-0 flex-1 truncate text-[9px] text-muted-foreground">{t.replyKeyboardHint}</p>
                    {uploading ? <span className="shrink-0 text-[9px] text-muted-foreground">{t.partnerUploading}</span> : null}
                  </div>
                </div>
              </div>
              <div className="hidden lg:block" />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
