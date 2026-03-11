'use client'

import { useEffect, useState } from 'react'
import { Bell, Loader2 } from 'lucide-react'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Dictionary } from '@/lib/i18n/dictionaries'

type Notification = {
  id: string
  type: string
  title: string
  body: string
  read_at: string | null
  created_at: string
  meta?: { curriculum_id?: string; slide_index?: number; action?: string }
}

interface NotificationBellProps {
  t: Dictionary
}

export function NotificationBell({ t }: NotificationBellProps) {
  const [items, setItems] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

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

  const markAsRead = async (id: string) => {
    await fetch(`/api/notifications/${id}/read`, { method: 'PATCH' })
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)))
    setUnreadCount((c) => Math.max(0, c - 1))
  }

  const formatTime = (iso: string) => {
    try {
      const d = new Date(iso)
      const now = new Date()
      const diff = now.getTime() - d.getTime()
      if (diff < 60000) return 'Vừa xong'
      if (diff < 3600000) return `${Math.floor(diff / 60000)} phút trước`
      if (diff < 86400000) return `${Math.floor(diff / 3600000)} giờ trước`
      return d.toLocaleDateString('vi-VN')
    } catch {
      return iso
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
                  onClick={() => {
                    markAsRead(n.id)
                  }}
                  className={cn(
                    'w-full px-4 py-3 text-left hover:bg-muted/50 transition-colors',
                    !n.read_at && 'bg-primary/5'
                  )}
                >
                  <p className="text-sm font-medium">{n.title}</p>
                  {n.body && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>}
                  <p className="text-[10px] text-muted-foreground mt-1">{formatTime(n.created_at)}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
