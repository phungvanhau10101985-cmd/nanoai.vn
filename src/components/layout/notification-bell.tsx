'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, Loader2 } from 'lucide-react'
import {
  getPushVapidPublicKey,
  requestPushPermissionAndSubscribe,
  syncPushSubscriptionWithServer,
} from '@/lib/pwa/push-subscribe-client'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import type { WebLocale } from '@/lib/i18n/config'
import { formatWebRelativeTime } from '@/lib/i18n/format-relative-time'

type NotificationMeta = {
  curriculum_id?: string
  slide_index?: number
  action?: string
  push_url?: string
  [key: string]: unknown
}

type Notification = {
  id: string
  type: string
  title: string
  body: string
  read_at: string | null
  created_at: string
  meta?: NotificationMeta | null
}

interface NotificationBellProps {
  t: Dictionary
  locale: WebLocale
}

function safePushPath(meta: NotificationMeta | null | undefined): string | null {
  const u = meta?.push_url
  if (typeof u !== 'string' || !u.startsWith('/') || u.startsWith('//')) return null
  return u
}

export function NotificationBell({ t, locale }: NotificationBellProps) {
  const router = useRouter()
  const [items, setItems] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [pushSubscribed, setPushSubscribed] = useState<boolean | null>(null)
  const [pushBusy, setPushBusy] = useState(false)
  const [pushClientOk, setPushClientOk] = useState(false)

  const vapidPublic = getPushVapidPublicKey()
  const showPushFooter =
    Boolean(vapidPublic) &&
    pushClientOk &&
    process.env.NODE_ENV !== 'development'

  useEffect(() => {
    setPushClientOk(typeof window !== 'undefined' && window.isSecureContext)
  }, [])

  const fetchUnreadCount = () => {
    fetch('/api/notifications/unread-count')
      .then((res) => res.json())
      .then((data) => setUnreadCount(data?.count ?? 0))
      .catch(() => setUnreadCount(0))
  }

  const fetchNotifications = () => {
    setLoading(true)
    fetch('/api/notifications?limit=15')
      .then((res) => res.json())
      .then((data) => setItems(data?.items ?? []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchUnreadCount()
    const interval = setInterval(fetchUnreadCount, 60000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (open) fetchNotifications()
  }, [open])

  useEffect(() => {
    if (!open || !showPushFooter) return
    fetch('/api/push/status', { credentials: 'same-origin' })
      .then((res) => res.json())
      .then((data) => setPushSubscribed(Boolean(data?.subscribed)))
      .catch(() => setPushSubscribed(false))
  }, [open, showPushFooter])

  const markAsRead = async (id: string) => {
    await fetch(`/api/notifications/${id}/read`, { method: 'PATCH' })
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)))
    setUnreadCount((c) => Math.max(0, c - 1))
  }

  const onNotificationActivate = async (n: Notification) => {
    await markAsRead(n.id)
    const path = safePushPath(n.meta ?? undefined)
    if (path) {
      setOpen(false)
      router.push(path)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="relative h-9 w-9 rounded-full"
          aria-label={t.menu.notifications}
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-medium text-white">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 sm:w-96 p-0" align="end" sideOffset={8}>
        <div className="border-b px-4 py-3">
          <h3 className="font-semibold text-sm">{t.menu.notifications}</h3>
        </div>
        <div className="max-h-[320px] overflow-y-auto">
          {loading ? (
            <div className="py-8 flex justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : items.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">{t.menu.noNotifications}</div>
          ) : (
            <div className="divide-y">
              {items.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => void onNotificationActivate(n)}
                  className={cn(
                    'w-full px-4 py-3 text-left hover:bg-muted/50 transition-colors',
                    !n.read_at && 'bg-primary/5',
                    safePushPath(n.meta ?? undefined) && 'cursor-pointer'
                  )}
                >
                  <p className="text-sm font-medium">{n.title}</p>
                  {n.body && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>}
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {formatWebRelativeTime(n.created_at, locale)}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
        {showPushFooter && (
          <div className="border-t px-4 py-3 space-y-2 bg-muted/20">
            {typeof Notification !== 'undefined' && Notification.permission === 'denied' ? (
              <p className="text-[11px] text-muted-foreground leading-snug">{t.push.bellDeniedHint}</p>
            ) : pushSubscribed ? (
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">{t.push.bellSubscribedShort}</p>
            ) : typeof Notification !== 'undefined' && Notification.permission === 'granted' ? (
              <>
                <p className="text-[11px] text-muted-foreground leading-snug">{t.push.bellSyncHint}</p>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="w-full h-8 text-xs"
                  disabled={pushBusy || !vapidPublic}
                  onClick={() => {
                    if (!vapidPublic) return
                    setPushBusy(true)
                    void syncPushSubscriptionWithServer(vapidPublic)
                      .then((ok) => {
                        if (ok) setPushSubscribed(true)
                      })
                      .finally(() => setPushBusy(false))
                  }}
                >
                  {pushBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : t.push.bellEnableButton}
                </Button>
              </>
            ) : (
              <>
                <p className="text-[11px] text-muted-foreground leading-snug">{t.push.bellEnableHint}</p>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="w-full h-8 text-xs"
                  disabled={pushBusy || typeof Notification === 'undefined'}
                  onClick={() => {
                    if (!vapidPublic) return
                    setPushBusy(true)
                    void requestPushPermissionAndSubscribe(vapidPublic)
                      .then((ok) => {
                        if (ok) setPushSubscribed(true)
                      })
                      .finally(() => setPushBusy(false))
                  }}
                >
                  {pushBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : t.push.bellEnableButton}
                </Button>
              </>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
