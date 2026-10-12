'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { History, Loader2, Trash2, X } from 'lucide-react'
import { useWebLocaleFromDocumentCookie } from '@/hooks/use-web-locale-from-cookie'
import { subscribeToUrlChanges } from '@/lib/client-history-navigation'
import type { HubChatThreadSummary } from '@/lib/db/hub-chat-pg'
import {
  dispatchHubHistoryOpenThread,
  dispatchHubHistoryThreadDeleted,
} from '@/lib/hub-chat/hub-history-events'
import { clearHubThreadId, readHubThreadId, saveHubThreadId } from '@/lib/hub-chat/hub-chat-prefill'
import { presetTitle } from '@/lib/hub-chat/hub-studio-presets'
import { getDictionary } from '@/lib/i18n/dictionaries'
import type { WebLocale } from '@/lib/i18n/config'
import { useToast } from '@/hooks/use-toast'

/** Cùng chỗ với nút lịch sử trên thẻ Trợ lý NanoAI (dưới header, lệch trái). */
const HISTORY_DOCK_STYLE = {
  top: 'calc(var(--site-header-height, 3rem) + 1px + 1.25rem + 1px + 0.75rem + 0.125rem)',
  left: 'calc(0.75rem + 1px + 0.75rem)',
} as const

function formatThreadUpdatedAt(iso: string, locale: WebLocale): string {
  try {
    return new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : locale, {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(iso))
  } catch {
    return iso.slice(0, 16)
  }
}

function threadListLabel(thread: HubChatThreadSummary, locale: WebLocale): string {
  const title = thread.projectTitle?.trim() || thread.title.trim()
  if (title && title !== 'NanoAI chat') return title
  if (thread.presetId) return presetTitle(locale, thread.presetId)
  if (thread.lastMessagePreview) return thread.lastMessagePreview.slice(0, 80)
  return thread.title.trim() || 'NanoAI chat'
}

export function MobileHubHistoryButton() {
  const router = useRouter()
  const { toast } = useToast()
  const uiLocale = useWebLocaleFromDocumentCookie()
  const hc = useMemo(() => getDictionary(uiLocale).hubChat, [uiLocale])
  const [pathname, setPathname] = useState('/')
  const [open, setOpen] = useState(false)
  const [threads, setThreads] = useState<HubChatThreadSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [loginRequired, setLoginRequired] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const hide = pathname.startsWith('/auth')

  useEffect(() => {
    const syncPath = () => setPathname(window.location.pathname || '/')
    syncPath()
    return subscribeToUrlChanges(syncPath)
  }, [])

  const loadThreads = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/hub-chat/threads', { credentials: 'same-origin' })
      if (res.status === 401) {
        setLoginRequired(true)
        setThreads([])
        return
      }
      setLoginRequired(false)
      const data = (await res.json().catch(() => ({}))) as { threads?: HubChatThreadSummary[] }
      if (!res.ok) {
        toast({ title: hc.chatHistoryLoadFailed, variant: 'destructive' })
        return
      }
      setThreads(data.threads ?? [])
    } catch {
      toast({ title: hc.chatHistoryLoadFailed, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [hc.chatHistoryLoadFailed, toast])

  useEffect(() => {
    if (!open) return
    void loadThreads()
  }, [loadThreads, open])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const openThread = useCallback(
    (id: string) => {
      setOpen(false)
      saveHubThreadId(id)
      if ((window.location.pathname || '/') === '/') {
        dispatchHubHistoryOpenThread(id)
        return
      }
      router.push('/')
    },
    [router]
  )

  const deleteThread = useCallback(
    async (id: string) => {
      if (deletingId) return
      setDeletingId(id)
      try {
        const res = await fetch(`/api/hub-chat/threads?threadId=${encodeURIComponent(id)}`, {
          method: 'DELETE',
          credentials: 'same-origin',
        })
        if (res.status === 401) {
          toast({ title: hc.loginRequired, variant: 'destructive' })
          return
        }
        if (!res.ok) throw new Error('delete failed')
        setThreads((prev) => prev.filter((thread) => thread.id !== id))
        if (readHubThreadId() === id) clearHubThreadId()
        dispatchHubHistoryThreadDeleted(id)
        toast({ title: hc.chatHistoryDeleted })
      } catch {
        toast({ title: hc.chatHistoryDeleteFailed, variant: 'destructive' })
      } finally {
        setDeletingId(null)
      }
    },
    [deletingId, hc.chatHistoryDeleteFailed, hc.chatHistoryDeleted, hc.loginRequired, toast]
  )

  if (hide) return null

  return (
    <>
      {open ? (
        <button
          type="button"
          className="fixed inset-0 z-[45] bg-slate-900/20 lg:hidden"
          aria-label={hc.chatHistoryClose}
          onClick={() => setOpen(false)}
        />
      ) : (
        <button
          type="button"
          className="fixed z-[46] flex h-9 w-9 items-center justify-center rounded-md border border-indigo-200 bg-white text-indigo-700 shadow-md lg:hidden dark:border-indigo-800 dark:bg-slate-950 dark:text-indigo-200"
          style={HISTORY_DOCK_STYLE}
          aria-expanded={false}
          aria-controls="hub-chat-history-drawer"
          aria-label={hc.chatHistory}
          onClick={() => setOpen(true)}
        >
          <History className="h-4 w-4" />
        </button>
      )}
      {open ? (
        <div
          id="hub-chat-history-drawer"
          className="fixed z-[46] flex w-[min(19rem,88%)] flex-col overflow-hidden rounded-xl border border-indigo-100 bg-white shadow-xl lg:hidden dark:border-indigo-900 dark:bg-slate-950"
          style={{
            ...HISTORY_DOCK_STYLE,
            height: 'min(36rem, calc(100dvh - var(--site-header-height, 3rem) - 8rem))',
          }}
        >
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-3">
            <div className="mb-2 flex shrink-0 items-center justify-between gap-2">
              <p className="text-xs font-medium text-indigo-900 dark:text-indigo-100">
                {hc.chatHistory}
                {threads.length > 0 ? ` (${threads.length})` : ''}
              </p>
              <button
                type="button"
                className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-indigo-100 dark:hover:bg-indigo-950/50"
                aria-label={hc.chatHistoryClose}
                onClick={() => setOpen(false)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {loginRequired ? (
              <p className="py-2 text-xs text-muted-foreground">{hc.loginRequired}</p>
            ) : loading ? (
              <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {hc.thinking}
              </div>
            ) : threads.length === 0 ? (
              <p className="py-2 text-xs text-muted-foreground">{hc.chatHistoryEmpty}</p>
            ) : (
              <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto">
                {threads.map((thread) => {
                  const subtitle =
                    thread.presetId && thread.projectTitle
                      ? presetTitle(uiLocale, thread.presetId)
                      : thread.lastMessagePreview?.slice(0, 100) ?? null
                  return (
                    <li key={thread.id} className="flex items-stretch gap-0.5">
                      <button
                        type="button"
                        disabled={deletingId === thread.id}
                        onClick={() => openThread(thread.id)}
                        className="flex min-w-0 flex-1 flex-col rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-indigo-50 disabled:opacity-60 dark:hover:bg-indigo-950/30"
                      >
                        <span className="line-clamp-1 font-medium">{threadListLabel(thread, uiLocale)}</span>
                        <span className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">
                          {formatThreadUpdatedAt(thread.updatedAt, uiLocale)}
                          {subtitle ? ` · ${subtitle}` : null}
                        </span>
                      </button>
                      <button
                        type="button"
                        aria-label={hc.chatHistoryDelete}
                        title={hc.chatHistoryDelete}
                        disabled={deletingId === thread.id}
                        onClick={() => void deleteThread(thread.id)}
                        className="flex shrink-0 items-center justify-center rounded-md px-2 text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-950/30 dark:hover:text-red-400"
                      >
                        {deletingId === thread.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </>
  )
}
