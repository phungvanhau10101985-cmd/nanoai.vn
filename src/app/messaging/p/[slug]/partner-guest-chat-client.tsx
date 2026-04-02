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
import { Camera, ImagePlus, Loader2, List, Send, X } from 'lucide-react'

type GuestMsg = {
  id: string
  direction: 'inbound' | 'outbound'
  body: string
  created_at: string
  raw_payload?: Json | null
}

type T = Dictionary['partnerGuestChat']

export function PartnerGuestChatClient({ slug, shopDisplayName, t }: { slug: string; shopDisplayName: string; t: T }) {
  const { toast } = useToast()
  const pathname = usePathname()
  const [authReady, setAuthReady] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [messages, setMessages] = useState<GuestMsg[]>([])
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [imageStoragePath, setImageStoragePath] = useState<string | null>(null)
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const scrollAnchorRef = useRef<HTMLDivElement>(null)

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
      setMessages(Array.isArray(data.messages) ? data.messages : [])
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
    if (!userId) return
    const id = window.setInterval(() => void load(), 18000)
    return () => window.clearInterval(id)
  }, [userId, load])

  const clearAttachment = () => {
    setImageStoragePath(null)
    setImagePreviewUrl(null)
    if (galleryInputRef.current) galleryInputRef.current.value = ''
    if (cameraInputRef.current) cameraInputRef.current.value = ''
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

  const send = async () => {
    const text = draft.trim()
    if (!userId) return
    if (!text && !imageStoragePath) return
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
      const data = (await res.json()) as { ok?: boolean; error?: string }
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
    } catch {
      toast({ title: t.sendError, variant: 'destructive' })
    } finally {
      setSending(false)
    }
  }

  const canSend = Boolean(userId && (draft.trim() || imageStoragePath) && !uploading)

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

  return (
    <div className="flex w-full flex-col gap-5 pb-8">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button variant="outline" size="sm" asChild className="gap-1.5">
          <Link href="/messaging/my-chats">
            <List className="h-4 w-4" aria-hidden />
            {t.linkMyShops}
          </Link>
        </Button>
      </div>

      <Card className="overflow-hidden border-border/70 shadow-md">
        <CardHeader className="space-y-1 border-b bg-gradient-to-r from-violet-600/10 via-background to-cyan-600/10 pb-4">
          <CardDescription className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t.shopLabel}</CardDescription>
          <CardTitle className="text-2xl font-bold tracking-tight text-foreground">{shopDisplayName}</CardTitle>
          <p className="text-sm leading-relaxed text-muted-foreground">{t.subline}</p>
          <p className="text-[11px] text-muted-foreground/90">{t.pollNote}</p>
        </CardHeader>
        <CardContent className="p-0">
          <div
            className="flex max-h-[min(52vh,480px)] min-h-[220px] flex-col gap-2 overflow-y-auto bg-muted/20 px-3 py-4"
            role="log"
            aria-live="polite"
            aria-relevant="additions"
          >
            {loading && messages.length === 0 ? (
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
                      <CustomerCareMessageBody row={{ body: m.body, raw_payload: m.raw_payload ?? null }} />
                    </div>
                    <div className={`mt-1.5 text-[10px] ${isMe ? 'text-white/75' : 'text-muted-foreground'}`}>
                      {new Date(m.created_at).toLocaleString()}
                    </div>
                  </div>
                )
              })
            )}
            <div ref={scrollAnchorRef} className="h-px w-full shrink-0" aria-hidden />
          </div>

          <div className="space-y-3 border-t bg-background p-4">
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

            {imagePreviewUrl ? (
              <div className="relative overflow-hidden rounded-xl border bg-muted/30 p-2">
                <img src={imagePreviewUrl} alt="" className="mx-auto max-h-40 rounded-lg object-contain" />
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  className="absolute right-2 top-2 h-8 w-8 rounded-full shadow-md"
                  onClick={clearAttachment}
                  disabled={sending || uploading}
                  aria-label={t.guestRemoveAttachment}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                disabled={uploading || sending}
                onClick={() => galleryInputRef.current?.click()}
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                {t.guestAttachPhoto}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                disabled={uploading || sending}
                onClick={() => cameraInputRef.current?.click()}
              >
                <Camera className="h-4 w-4" />
                {t.guestTakePhoto}
              </Button>
              {uploading ? <span className="text-xs text-muted-foreground">{t.guestUploading}</span> : null}
            </div>

            {imageStoragePath ? <p className="text-[11px] text-muted-foreground">{t.guestCaptionHint}</p> : null}

            <div className="space-y-1.5">
              <Textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={t.placeholder}
                rows={3}
                className="resize-none border-border/80 bg-background text-sm"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    if (canSend && !sending) void send()
                  }
                }}
              />
              <p className="text-[11px] text-muted-foreground">{t.sendKeyboardHint}</p>
            </div>
            <div className="flex justify-end">
              <Button type="button" className="min-w-[100px] gap-2" onClick={() => void send()} disabled={!canSend || sending}>
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {t.send}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
