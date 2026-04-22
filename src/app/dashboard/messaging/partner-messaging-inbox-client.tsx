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
  cancelMessagingWorkspaceDeletionSchedule,
  confirmMessagingWorkspaceDeletionWithOtp,
  createMessagingWorkspaceProfile,
  getPartnerAiComposingForConversation,
  listPartnerConversations,
  listPartnerMessages,
  requestMessagingWorkspaceDeletionOtp,
  sendPartnerReply,
} from '@/app/dashboard/messaging/actions'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { CustomerCareMessageBody } from '@/components/messaging/customer-care-message-body'
import { MessageTextWithLinks } from '@/components/messaging/message-text-with-links'
import {
  CalendarDays,
  Camera,
  ChevronLeft,
  ClipboardList,
  Headphones,
  ImagePlus,
  Building2,
  Loader2,
  MessageSquare,
  Phone,
  Plus,
  Search,
  Send,
  Settings,
  StickyNote,
  Trash2,
  Users,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'

function useMatchMediaMaxMd() {
  const [match, setMatch] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const apply = () => setMatch(mq.matches)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])
  return match
}

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

export function PartnerMessagingInboxClient({
  initialPartners,
  hotelCount = 0,
  t,
}: {
  initialPartners: PartnerRow[]
  hotelCount?: number
  t: T
}) {
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
  const [shopAiComposing, setShopAiComposing] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteOtpStep, setDeleteOtpStep] = useState<'send' | 'confirm'>('send')
  const [deleteOtpInput, setDeleteOtpInput] = useState('')
  const [createChannelOpen, setCreateChannelOpen] = useState(false)
  const [channelKind, setChannelKind] = useState<'fashion' | 'hotel' | 'food' | 'other'>('fashion')
  const [channelDisplayName, setChannelDisplayName] = useState('')
  const [channelBrandName, setChannelBrandName] = useState('')
  const [channelLogoUrl, setChannelLogoUrl] = useState('')
  const [creatingChannel, setCreatingChannel] = useState(false)
  const galleryInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const composerRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const isMobileLayout = useMatchMediaMaxMd()

  const selectedConv = selectedConvId ? conversations.find((c) => c.id === selectedConvId) : undefined
  const selectedPartner = useMemo(
    () => partners.find((p) => p.id === selectedPartnerId) ?? null,
    [partners, selectedPartnerId]
  )

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

  const resetCreateChannelForm = useCallback(() => {
    setChannelKind('fashion')
    setChannelDisplayName('')
    setChannelBrandName('')
    setChannelLogoUrl('')
  }, [])

  const submitCreateChannel = useCallback(async () => {
    const name = channelDisplayName.trim()
    const brand = channelBrandName.trim() || name
    if (!name) {
      toast({ title: 'Vui lòng nhập tên kênh kinh doanh.', variant: 'destructive' })
      return
    }
    setCreatingChannel(true)
    try {
      const res = await createMessagingWorkspaceProfile({
        displayName: name,
        brandName: brand,
        industryKey: channelKind,
        logoUrl: channelLogoUrl.trim(),
      })
      if ('error' in res && res.error) {
        toast({ title: res.error, variant: 'destructive' })
        return
      }
      if (!('partner' in res) || !res.partner) return
      const created = res.partner as PartnerRow
      if (channelKind === 'hotel') {
        toast({ title: `Đã tạo khách sạn «${created.display_name}». Đang mở dashboard khách sạn...` })
        setCreateChannelOpen(false)
        resetCreateChannelForm()
        router.push('/dashboard/hospitality')
        return
      }
      setPartners((prev) => [created, ...prev])
      setSelectedPartnerId(created.id)
      toast({ title: `Đã tạo kênh «${created.display_name}».` })
      setCreateChannelOpen(false)
      resetCreateChannelForm()
    } finally {
      setCreatingChannel(false)
    }
  }, [channelBrandName, channelDisplayName, channelKind, channelLogoUrl, resetCreateChannelForm, router, toast])

  useEffect(() => {
    refreshConversations()
  }, [selectedPartnerId, refreshConversations])

  useEffect(() => {
    if (!selectedPartnerId) return
    const id = window.setInterval(() => void refreshConversations(), 26000)
    return () => window.clearInterval(id)
  }, [selectedPartnerId, refreshConversations])

  const refreshAiComposing = useCallback(() => {
    if (!selectedPartnerId || !selectedConvId) return
    void getPartnerAiComposingForConversation(selectedPartnerId, selectedConvId).then((res) => {
      if ('composing' in res) setShopAiComposing(Boolean(res.composing))
    })
  }, [selectedPartnerId, selectedConvId])

  useEffect(() => {
    if (!selectedPartnerId || !selectedConvId) {
      setShopAiComposing(false)
      return
    }
    refreshAiComposing()
    const id = window.setInterval(() => refreshAiComposing(), 2500)
    return () => window.clearInterval(id)
  }, [selectedPartnerId, selectedConvId, refreshAiComposing])

  useEffect(() => {
    if (!selectedPartnerId || !selectedConvId) return
    const id = window.setInterval(() => {
      listPartnerMessages(selectedPartnerId, selectedConvId).then((res) => {
        if ('rows' in res) setMessages(res.rows ?? [])
        refreshAiComposing()
      })
    }, 14000)
    return () => window.clearInterval(id)
  }, [selectedPartnerId, selectedConvId, refreshAiComposing])

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
        refreshAiComposing()
      })
      .finally(() => setLoadingMsgs(false))
  }, [selectedPartnerId, selectedConvId, toast, refreshAiComposing])

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

  useEffect(() => {
    if (!selectedConvId || loadingMsgs) return
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, selectedConvId, loadingMsgs, shopAiComposing])

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

  const openDeleteWorkspaceDialog = () => {
    if (!selectedPartnerId || selectedPartner?.purge_at) return
    setDeleteOtpStep('send')
    setDeleteOtpInput('')
    setDeleteDialogOpen(true)
  }

  const sendDeleteOtp = () => {
    if (!selectedPartnerId) return
    startTransition(async () => {
      const res = await requestMessagingWorkspaceDeletionOtp(selectedPartnerId)
      if ('error' in res && res.error) {
        toast({ title: res.error, variant: 'destructive' })
        return
      }
      toast({ title: t.deleteWorkspaceOtpSentToast })
      setDeleteOtpStep('confirm')
    })
  }

  const confirmDeleteWorkspaceWithOtp = () => {
    if (!selectedPartnerId) return
    const otp = deleteOtpInput.replace(/\D/g, '').trim()
    if (otp.length !== 6) {
      toast({ title: 'Nhap du 6 so OTP.', variant: 'destructive' })
      return
    }
    startTransition(async () => {
      const res = await confirmMessagingWorkspaceDeletionWithOtp(selectedPartnerId, otp)
      if ('error' in res && res.error) {
        toast({ title: res.error, variant: 'destructive' })
        return
      }
      if ('purge_at' in res && res.purge_at) {
        setPartners((prev) =>
          prev.map((p) => (p.id === selectedPartnerId ? { ...p, purge_at: res.purge_at } : p))
        )
      }
      setDeleteDialogOpen(false)
      setDeleteOtpInput('')
      toast({
        title:
          'Da len lich xoa workspace. Shop khong nhan tin khach cho den khi hoan tat hoac ban huy lich.',
      })
      router.refresh()
    })
  }

  const cancelScheduledDeletion = () => {
    if (!selectedPartnerId) return
    startTransition(async () => {
      const res = await cancelMessagingWorkspaceDeletionSchedule(selectedPartnerId)
      if ('error' in res && res.error) {
        toast({ title: res.error, variant: 'destructive' })
        return
      }
      setPartners((prev) =>
        prev.map((p) => (p.id === selectedPartnerId ? { ...p, purge_at: null, deletion_requested_at: null } : p))
      )
      toast({ title: t.deleteWorkspaceScheduleCancelled })
      router.refresh()
    })
  }

  if (partners.length === 0) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-border/70 bg-card/90 p-6 shadow-sm">
          <p className="mb-3 text-sm text-muted-foreground">{t.noWorkspaceInboxCta}</p>
          <Button asChild>
            <Link href="/dashboard/messaging/settings">{t.messagingSettingsLink}</Link>
          </Button>
        </div>
        <div className="rounded-xl border border-violet-200/80 bg-violet-50/50 p-6 shadow-sm dark:border-violet-900/50 dark:bg-violet-950/25">
          <p className="text-sm font-medium text-foreground">{t.customerCareShopSetupGuideTitle}</p>
          <p className="mt-3 max-h-[min(50vh,22rem)] overflow-y-auto text-sm leading-relaxed text-muted-foreground whitespace-pre-line [scrollbar-width:thin]">
            {t.customerCareShopSetupGuideBody}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative flex h-full min-h-0 flex-col gap-1 max-md:gap-1.5">
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t.deleteWorkspaceButton}</DialogTitle>
            <DialogDescription className="text-left">{t.deleteWorkspaceOtpIntro}</DialogDescription>
          </DialogHeader>
          {deleteOtpStep === 'send' ? (
            <DialogFooter className="gap-2 sm:justify-end">
              <Button type="button" variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                {t.cancelAddWorkspace}
              </Button>
              <Button type="button" onClick={sendDeleteOtp} disabled={pending}>
                {t.deleteWorkspaceOtpSend}
              </Button>
            </DialogFooter>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="ws-del-otp">
                  {t.deleteWorkspaceOtpLabel}
                </label>
                <Input
                  id="ws-del-otp"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={8}
                  value={deleteOtpInput}
                  onChange={(e) => setDeleteOtpInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                />
              </div>
              <DialogFooter className="gap-2 sm:justify-end">
                <Button type="button" variant="outline" onClick={() => setDeleteOtpStep('send')}>
                  {t.deleteWorkspaceOtpSend}
                </Button>
                <Button type="button" variant="destructive" onClick={confirmDeleteWorkspaceWithOtp} disabled={pending}>
                  {t.deleteWorkspaceOtpConfirm}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={createChannelOpen}
        onOpenChange={(next) => {
          setCreateChannelOpen(next)
          if (!next) resetCreateChannelForm()
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Tạo kênh kinh doanh mới</DialogTitle>
            <DialogDescription className="text-left">
              Mỗi kênh là một workspace độc lập: shop thời trang, nhà nghỉ/khách sạn, nhà hàng... mỗi loại có luồng tư vấn và quản lý riêng.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <label className="text-sm font-medium">Loại kênh</label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {(
                  [
                    { value: 'fashion', label: 'Shop thời trang', hint: 'Bán lẻ · tư vấn size/màu' },
                    { value: 'hotel', label: 'Nhà nghỉ / khách sạn', hint: 'Đặt phòng · quản lý booking' },
                    { value: 'food', label: 'Nhà hàng / ăn uống', hint: 'Menu · đặt bàn' },
                    { value: 'other', label: 'Khác', hint: 'Tư vấn chung' },
                  ] as const
                ).map((opt) => {
                  const active = channelKind === opt.value
                  return (
                    <button
                      type="button"
                      key={opt.value}
                      onClick={() => setChannelKind(opt.value)}
                      className={cn(
                        'rounded-md border px-3 py-2 text-left text-xs transition',
                        active
                          ? 'border-violet-500 bg-violet-50 text-violet-900 dark:bg-violet-950/40 dark:text-violet-100'
                          : 'hover:bg-muted'
                      )}
                    >
                      <p className="text-sm font-medium">{opt.label}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">{opt.hint}</p>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="create-channel-name">
                {channelKind === 'hotel'
                  ? 'Tên khách sạn / nhà nghỉ'
                  : channelKind === 'food'
                  ? 'Tên nhà hàng'
                  : 'Tên shop / kênh hiển thị'}
              </label>
              <Input
                id="create-channel-name"
                value={channelDisplayName}
                onChange={(e) => setChannelDisplayName(e.target.value)}
                placeholder={
                  channelKind === 'hotel'
                    ? 'VD: Khách sạn Bình Minh'
                    : channelKind === 'food'
                    ? 'VD: Nhà hàng Hương Việt'
                    : 'VD: Shop 188.com.vn'
                }
                maxLength={120}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="create-channel-brand">
                Tên thương hiệu <span className="text-muted-foreground">(không bắt buộc)</span>
              </label>
              <Input
                id="create-channel-brand"
                value={channelBrandName}
                onChange={(e) => setChannelBrandName(e.target.value)}
                placeholder="Để trống sẽ dùng tên phía trên"
                maxLength={120}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="create-channel-logo">
                Logo URL <span className="text-muted-foreground">(không bắt buộc)</span>
              </label>
              <Input
                id="create-channel-logo"
                value={channelLogoUrl}
                onChange={(e) => setChannelLogoUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setCreateChannelOpen(false)} disabled={creatingChannel}>
              Hủy
            </Button>
            <Button
              type="button"
              onClick={() => void submitCreateChannel()}
              disabled={creatingChannel || !channelDisplayName.trim()}
            >
              {creatingChannel ? 'Đang tạo...' : 'Tạo kênh'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {hotelCount > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-violet-300/60 bg-violet-50/60 px-3 py-2 text-xs text-violet-950 dark:border-violet-800/50 dark:bg-violet-950/20 dark:text-violet-100">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 shrink-0" aria-hidden />
            <span>
              Bạn có <strong>{hotelCount}</strong> workspace khách sạn. Quản lý phòng và booking ở dashboard riêng.
            </span>
          </div>
          <Button type="button" variant="outline" size="sm" className="h-7 shrink-0 border-violet-600/40 px-2 text-[11px]" asChild>
            <Link href="/dashboard/hospitality">Mở dashboard khách sạn</Link>
          </Button>
        </div>
      ) : null}

      {selectedPartner?.purge_at ? (
        <div className="rounded-lg border border-amber-500/50 bg-amber-50/90 px-3 py-2 text-xs text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex-1">{t.deleteWorkspaceScheduledBanner}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 border-amber-700/40"
              onClick={cancelScheduledDeletion}
              disabled={pending}
            >
              {t.deleteWorkspaceCancelSchedule}
            </Button>
          </div>
        </div>
      ) : null}

      <div className="flex shrink-0 flex-col gap-1.5 border-b border-border/40 pb-1.5 md:flex-row md:flex-wrap md:items-center md:gap-1 md:pb-0.5">
        <Select
          value={selectedPartnerId ?? undefined}
          onValueChange={(v) => {
            setSelectedPartnerId(v)
            setSelectedConvId(null)
          }}
        >
          <SelectTrigger className="h-9 w-full bg-background text-xs md:h-7 md:w-full md:max-w-xs md:text-[11px]">
            <SelectValue placeholder={t.workspaceLabel} />
          </SelectTrigger>
          <SelectContent>
            {partners.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.display_name} ({p.industry_key || 'fashion'})
                {p.purge_at ? ' — chờ xóa' : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-1 md:hidden">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 min-w-0 flex-1 px-2 text-xs"
            onClick={() => setCreateChannelOpen(true)}
          >
            <Plus className="mr-1 h-3.5 w-3.5 shrink-0" aria-hidden />
            Tạo kênh
          </Button>
          <Button type="button" variant="secondary" size="icon" className="h-9 w-9 shrink-0" asChild title={t.messagingSettingsLink}>
            <Link href="/dashboard/messaging/settings" aria-label={t.messagingSettingsLink}>
              <Settings className="h-4 w-4" aria-hidden />
            </Link>
          </Button>
          <Button type="button" variant="secondary" size="icon" className="h-9 w-9 shrink-0" asChild title="Đơn hàng">
            <Link href="/dashboard/messaging/orders" aria-label="Đơn hàng">
              <ClipboardList className="h-4 w-4" aria-hidden />
            </Link>
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={openDeleteWorkspaceDialog}
            disabled={pending || !selectedPartnerId || Boolean(selectedPartner?.purge_at)}
            title={t.deleteWorkspaceButton}
            aria-label={t.deleteWorkspaceButton}
          >
            <Trash2 className="h-4 w-4" aria-hidden />
          </Button>
        </div>
        <div className="hidden flex-wrap items-center gap-1 md:flex">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 px-2 text-[11px]"
            onClick={() => setCreateChannelOpen(true)}
          >
            <Plus className="mr-1 h-3 w-3" aria-hidden />
            Tạo kênh
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
            onClick={openDeleteWorkspaceDialog}
            disabled={pending || !selectedPartnerId || Boolean(selectedPartner?.purge_at)}
          >
            <Trash2 className="h-3 w-3" aria-hidden />
            {t.deleteWorkspaceButton}
          </Button>
        </div>
      </div>

      <div
        className={cn(
          'min-h-0 flex-1 overflow-hidden overscroll-y-contain rounded-md border border-border/60 bg-muted/20',
          'flex flex-col',
          'md:grid md:grid-cols-[minmax(0,270px)_minmax(0,1fr)] md:items-stretch md:gap-0 md:divide-x md:divide-y-0 md:divide-border/60',
          'lg:grid-cols-[34px_minmax(0,270px)_minmax(0,1fr)_minmax(0,250px)]'
        )}
      >
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

        <aside
          className={cn(
            'flex min-h-0 flex-col overflow-hidden overscroll-y-contain md:h-full md:min-h-0 md:border-b-0 md:border-r md:border-border/40',
            'max-md:min-h-0 max-md:flex-1',
            isMobileLayout && selectedConvId && 'hidden'
          )}
        >
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
                      /* eslint-disable-next-line @next/next/no-img-element -- avatar URL from partner/customer profile */
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

        <section
          className={cn(
            'flex min-h-0 flex-col overflow-hidden overscroll-y-contain bg-muted/30 md:h-full',
            'max-md:min-h-0 max-md:flex-1',
            isMobileLayout && !selectedConvId && 'hidden'
          )}
        >
          {!selectedConvId ? (
            <div className="flex min-h-[10rem] flex-1 items-center justify-center px-4 py-6 text-center text-[13px] text-muted-foreground md:min-h-0">
              {t.pickConversation}
            </div>
          ) : (
            <>
              {selectedConv ? (
                <div className="flex shrink-0 items-center gap-1 border-b border-border/60 bg-background/95 px-1.5 py-1.5 md:gap-1.5 md:px-2 md:py-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 shrink-0 md:hidden"
                    onClick={() => setSelectedConvId(null)}
                    aria-label={t.inboxMobileBackAria}
                  >
                    <ChevronLeft className="h-5 w-5" aria-hidden />
                  </Button>
                  {selectedConv.customer_avatar_url ? (
                    /* eslint-disable-next-line @next/next/no-img-element -- avatar URL from partner/customer profile */
                    <img
                      src={selectedConv.customer_avatar_url}
                      alt=""
                      className="h-7 w-7 shrink-0 rounded-full object-cover ring-1 ring-border/40 md:h-6 md:w-6"
                    />
                  ) : (
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground ring-1 ring-border/40 md:h-6 md:w-6 md:text-[9px]">
                      {customerInitials(selectedConv.customer_name, t.unknownUser)}
                    </div>
                  )}
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <span className="truncate text-sm font-semibold leading-none md:text-xs">
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
                      className={`mb-1.5 w-full max-w-[min(100%,560px)] max-md:max-w-[calc(100vw-1.25rem)] ${
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
                              labels={{
                                productCardOpenProduct: t.messageProductCardOpenProduct,
                                productCardViewDetails: t.messageProductCardViewDetails,
                              }}
                            />
                          ) : (
                            <MessageTextWithLinks
                              text={m.body}
                              className="whitespace-pre-wrap break-words"
                              linkClassName="break-all text-white/90 underline underline-offset-2 hover:text-white"
                            />
                          )
                        ) : (
                          <CustomerCareMessageBody
                            row={m}
                            labels={{
                              productCardOpenProduct: t.messageProductCardOpenProduct,
                              productCardViewDetails: t.messageProductCardViewDetails,
                            }}
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
                {shopAiComposing ? (
                  <div
                    className="mb-1.5 mr-auto flex w-full max-w-[min(100%,560px)] max-md:max-w-[calc(100vw-1.25rem)] items-center gap-2 rounded-2xl rounded-bl-md border border-violet-500/35 bg-violet-500/10 px-3 py-2 text-[12px] font-medium text-violet-950 dark:text-violet-100"
                    role="status"
                    aria-live="polite"
                  >
                    <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-violet-600 dark:text-violet-300" aria-hidden />
                    <span className="tabular-nums">{t.inboxShopDrafting}</span>
                    <span className="inline-flex gap-0.5" aria-hidden>
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-violet-600/80 dark:bg-violet-300/80 [animation-delay:0ms]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-violet-600/80 dark:bg-violet-300/80 [animation-delay:150ms]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-violet-600/80 dark:bg-violet-300/80 [animation-delay:300ms]" />
                    </span>
                  </div>
                ) : null}
                <div ref={messagesEndRef} className="h-px w-full shrink-0 scroll-mt-4" aria-hidden />
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
                      {/* eslint-disable-next-line @next/next/no-img-element -- local preview blob/object URL */}
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
