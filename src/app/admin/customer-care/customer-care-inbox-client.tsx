'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import type { Database } from '@/types/database.types'
import {
  listCustomerCareConversations,
  listCustomerCareMessages,
  sendCustomerCareReply,
} from '@/app/admin/customer-care/actions'
import { CustomerCareMessageBody } from '@/components/messaging/customer-care-message-body'
import { MessageTextWithLinks } from '@/components/messaging/message-text-with-links'
import type { Dictionary } from '@/lib/i18n/dictionaries'

type ConvRow = Database['public']['Tables']['customer_care_conversations']['Row']
type MsgRow = Database['public']['Tables']['customer_care_messages']['Row']

type T = Dictionary['customerCareAdmin']

function channelLabel(channel: string, t: T) {
  if (channel === 'facebook') return t.channelFacebook
  if (channel === 'zalo') return t.channelZalo
  if (channel === 'widget') return t.channelWidget
  return t.channelInternal
}

export function CustomerCareInboxClient({ initialConversations, t }: { initialConversations: ConvRow[]; t: T }) {
  const { toast } = useToast()
  const [conversations, setConversations] = useState<ConvRow[]>(initialConversations)
  const [selectedId, setSelectedId] = useState<string | null>(initialConversations[0]?.id ?? null)
  const [messages, setMessages] = useState<MsgRow[]>([])
  const [draft, setDraft] = useState('')
  const [pending, startTransition] = useTransition()
  const [loadingMsgs, setLoadingMsgs] = useState(false)

  const refreshList = useCallback(() => {
    startTransition(async () => {
      const res = await listCustomerCareConversations()
      if ('error' in res && res.error) {
        toast({ title: res.error, variant: 'destructive' })
        return
      }
      if ('rows' in res) setConversations(res.rows ?? [])
    })
  }, [toast])

  useEffect(() => {
    if (!selectedId) {
      setMessages([])
      return
    }
    setLoadingMsgs(true)
    listCustomerCareMessages(selectedId)
      .then((res) => {
        if ('error' in res && res.error) {
          toast({ title: res.error, variant: 'destructive' })
          setMessages([])
          return
        }
        if ('rows' in res) setMessages(res.rows ?? [])
      })
      .finally(() => setLoadingMsgs(false))
  }, [selectedId, toast])

  const send = () => {
    if (!selectedId || !draft.trim()) return
    startTransition(async () => {
      const res = await sendCustomerCareReply(selectedId, draft)
      if ('error' in res && res.error) {
        toast({ title: res.error, variant: 'destructive' })
        return
      }
      setDraft('')
      const msgs = await listCustomerCareMessages(selectedId)
      if ('rows' in msgs) setMessages(msgs.rows ?? [])
      refreshList()
    })
  }

  const selected = conversations.find((c) => c.id === selectedId)

  return (
    <div className="grid gap-4 md:grid-cols-[1fr_minmax(0,280px)]">
      <div className="order-2 flex min-h-[420px] flex-col rounded-lg border bg-card md:col-start-1 md:row-start-1">
        {!selectedId ? (
          <div className="flex flex-1 items-center justify-center p-6 text-muted-foreground">{t.pickConversation}</div>
        ) : (
          <>
            <div className="border-b px-4 py-3 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="text-xs font-normal">
                  {channelLabel(selected?.channel ?? 'internal', t)}
                </Badge>
                <span className="font-medium">{selected?.customer_name || t.unknownUser}</span>
              </div>
              <div className="text-xs text-muted-foreground font-mono break-all">
                {selected?.external_thread_id}
              </div>
            </div>
            <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-4">
              {loadingMsgs ? (
                <div className="text-sm text-muted-foreground">…</div>
              ) : messages.length === 0 ? (
                <div className="text-sm text-muted-foreground">{t.noMessages}</div>
              ) : (
                messages.map((m) => (
                  <div
                    key={m.id}
                    className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                      m.direction === 'inbound' ? 'ml-auto bg-muted' : 'mr-auto bg-primary text-primary-foreground'
                    }`}
                  >
                    {m.direction === 'outbound' ? (
                      <MessageTextWithLinks
                        text={m.body}
                        className="whitespace-pre-wrap break-words"
                        linkClassName="break-all text-primary-foreground underline underline-offset-2 opacity-95 hover:opacity-100"
                      />
                    ) : (
                      <CustomerCareMessageBody
                        row={m}
                        labels={{
                          productCardOpenProduct: t.messageProductCardOpenProduct,
                          productCardViewDetails: t.messageProductCardViewDetails,
                        }}
                      />
                    )}
                    <div className="mt-1 text-[10px] opacity-70">
                      {new Date(m.created_at).toLocaleString()}
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="border-t p-3 space-y-2">
              <Textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={t.replyPlaceholder}
                rows={3}
                className="resize-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    if (!pending && draft.trim()) send()
                  }
                }}
              />
              <p className="text-[11px] text-muted-foreground">{t.sendKeyboardHint}</p>
              <Button type="button" onClick={send} disabled={pending || !draft.trim()}>
                {t.send}
              </Button>
            </div>
          </>
        )}
      </div>

      <div className="order-1 flex flex-col gap-2 rounded-lg border bg-card p-3 md:col-start-2 md:row-start-1 md:border-l md:border-border md:pl-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">{t.inboxTitle}</h2>
          <Button type="button" variant="outline" size="sm" onClick={refreshList} disabled={pending}>
            {t.refresh}
          </Button>
        </div>
        <ul className="max-h-[60vh] space-y-1 overflow-y-auto text-sm">
          {conversations.length === 0 ? (
            <li className="text-muted-foreground">{t.pickConversation}</li>
          ) : (
            conversations.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(c.id)}
                  className={`w-full rounded-md px-2 py-2 text-left transition-colors hover:bg-muted ${
                    selectedId === c.id ? 'bg-muted' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium line-clamp-1 min-w-0">{c.customer_name || t.unknownUser}</span>
                    <Badge variant="outline" className="shrink-0 text-[10px] font-normal px-1.5 py-0">
                      {channelLabel(c.channel, t)}
                    </Badge>
                  </div>
                  <div className="line-clamp-2 text-xs text-muted-foreground">{c.last_message_preview || '—'}</div>
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  )
}
