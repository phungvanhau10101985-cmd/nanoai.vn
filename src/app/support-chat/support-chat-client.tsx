'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { CustomerCareMessageBody } from '@/components/messaging/customer-care-message-body'
import { useToast } from '@/hooks/use-toast'
import { sanitizeLoginNext } from '@/lib/auth/sanitize-login-next'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import type { Database } from '@/types/database.types'
import { Headphones, Loader2, LogIn, MessageCircle, Send } from 'lucide-react'

type MsgRow = Database['public']['Tables']['customer_care_messages']['Row']
type TSupport = Dictionary['supportChat']

const LOGIN_NEXT = '/support-chat'

export function SupportChatClient({ initialLoggedIn, t }: { initialLoggedIn: boolean; t: TSupport }) {
  const { toast } = useToast()
  const [loggedIn, setLoggedIn] = useState(initialLoggedIn)
  const [messages, setMessages] = useState<MsgRow[]>([])
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const scrollAnchorRef = useRef<HTMLDivElement>(null)

  const loginHref = `/auth/login?next=${encodeURIComponent(sanitizeLoginNext(LOGIN_NEXT))}`

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/customer-care/internal/thread', { credentials: 'same-origin' })
      if (res.status === 401) {
        setLoggedIn(false)
        setMessages([])
        return
      }
      const data = (await res.json()) as { messages?: MsgRow[]; error?: string }
      if (!res.ok) {
        toast({ title: data.error || t.loadError, variant: 'destructive' })
        return
      }
      setLoggedIn(true)
      setMessages(Array.isArray(data.messages) ? data.messages : [])
    } catch {
      toast({ title: t.loadError, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [toast, t.loadError])

  useEffect(() => {
    if (initialLoggedIn) void load()
  }, [initialLoggedIn, load])

  useEffect(() => {
    if (!loggedIn) return
    const id = window.setInterval(() => void load(), 18000)
    return () => window.clearInterval(id)
  }, [loggedIn, load])

  useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages])

  const send = async () => {
    const text = draft.trim()
    if (!text) return
    setSending(true)
    try {
      const res = await fetch('/api/customer-care/internal/thread', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      if (res.status === 401) {
        setLoggedIn(false)
        toast({ title: t.loginRequired, variant: 'destructive' })
        return
      }
      const data = (await res.json()) as { ok?: boolean; error?: string }
      if (!res.ok) {
        toast({ title: data.error || t.sendError, variant: 'destructive' })
        return
      }
      setDraft('')
      await load()
    } catch {
      toast({ title: t.sendError, variant: 'destructive' })
    } finally {
      setSending(false)
    }
  }

  if (!loggedIn) {
    return (
      <div className="flex flex-1 flex-col justify-center gap-6">
        <div className="text-center sm:text-left">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-violet-200/80 bg-violet-100/50 px-3 py-1 text-xs font-medium text-violet-800 dark:border-violet-800/60 dark:bg-violet-950/40 dark:text-violet-200">
            <Headphones className="h-3.5 w-3.5" aria-hidden />
            {t.brandBadge}
          </div>
          <h1 className="text-balance text-3xl font-bold tracking-tight text-foreground">{t.headline}</h1>
          <p className="mt-3 max-w-md text-pretty text-sm leading-relaxed text-muted-foreground">{t.subline}</p>
        </div>

        <Card className="border-border/70 shadow-md">
          <CardHeader className="space-y-1 pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <MessageCircle className="h-5 w-5 text-violet-600" aria-hidden />
              {t.loginRequired}
            </CardTitle>
            <CardDescription className="text-xs leading-relaxed">{t.loginSupportingLine}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild size="lg" className="w-full gap-2 sm:w-auto">
              <Link href={loginHref}>
                <LogIn className="h-4 w-4" aria-hidden />
                {t.loginLink}
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5">
      <div className="text-center sm:text-left">
        <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-violet-200/80 bg-violet-100/50 px-3 py-1 text-xs font-medium text-violet-800 dark:border-violet-800/60 dark:bg-violet-950/40 dark:text-violet-200">
          <Headphones className="h-3.5 w-3.5" aria-hidden />
          {t.brandBadge}
        </div>
        <h1 className="text-balance text-2xl font-bold tracking-tight sm:text-3xl">{t.headline}</h1>
        <p className="mt-2 max-w-md text-pretty text-sm text-muted-foreground">{t.subline}</p>
        <p className="mt-1.5 text-[11px] text-muted-foreground/90">{t.pollNote}</p>
      </div>

      <Card className="flex max-h-[min(85vh,640px)] min-h-[280px] flex-1 flex-col overflow-hidden border-border/70 shadow-md">
        <CardContent className="flex min-h-0 flex-1 flex-col gap-0 p-0">
          <div
            className="min-h-0 flex-1 overflow-y-auto bg-muted/25 px-3 py-4"
            role="log"
            aria-live="polite"
            aria-relevant="additions"
          >
            {loading && messages.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 py-12 text-sm text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin text-violet-600/80" aria-hidden />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 py-10 text-center">
                <MessageCircle className="h-10 w-10 text-muted-foreground/40" aria-hidden />
                <p className="max-w-xs text-sm text-muted-foreground">{t.emptyThread}</p>
              </div>
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

          <div className="shrink-0 space-y-3 border-t bg-background p-4">
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
                    if (!sending && draft.trim()) void send()
                  }
                }}
              />
              <p className="text-[11px] text-muted-foreground">{t.sendKeyboardHint}</p>
            </div>
            <Button
              type="button"
              className="w-full gap-2 sm:w-auto"
              onClick={() => void send()}
              disabled={sending || !draft.trim()}
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
              {t.send}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
