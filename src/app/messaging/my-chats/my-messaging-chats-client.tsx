'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import { ArrowLeft, MessageCircle } from 'lucide-react'

type Item = {
  conversationId: string
  shopName: string
  slug: string
  lastMessageAt: string | null
  lastMessagePreview: string | null
}

type T = Dictionary['messagingMyChats']

export function MyMessagingChatsClient({
  t,
  initialItems,
  initialError,
}: {
  t: T
  initialItems: Item[]
  initialError?: string
}) {
  return (
    <div className="flex w-full max-w-lg flex-col gap-6 pb-8">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild className="shrink-0">
          <Link href="/" aria-label={t.backHomeAria}>
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t.pageTitle}</h1>
          <p className="text-sm text-muted-foreground">{t.pageDescription}</p>
        </div>
      </div>

      {initialError ? (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {t.loadFailed}: {initialError}
        </p>
      ) : null}

      {initialItems.length === 0 && !initialError ? (
        <Card className="border-border/70 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <MessageCircle className="h-5 w-5 text-violet-600" aria-hidden />
              {t.pageTitle}
            </CardTitle>
            <CardDescription>{t.emptyList}</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {initialItems.map((row) => (
            <li key={row.conversationId}>
              <Card className="overflow-hidden border-border/70 shadow-sm transition-shadow hover:shadow-md">
                <CardHeader className="space-y-1 pb-2">
                  <CardTitle className="text-lg">{row.shopName}</CardTitle>
                  {row.lastMessagePreview ? (
                    <CardDescription className="line-clamp-2 text-sm">{row.lastMessagePreview}</CardDescription>
                  ) : null}
                  {row.lastMessageAt ? (
                    <p className="text-[11px] text-muted-foreground">
                      {t.lastActivity}: {new Date(row.lastMessageAt).toLocaleString()}
                    </p>
                  ) : null}
                </CardHeader>
                <CardContent className="pt-0">
                  <Button asChild className="w-full sm:w-auto">
                    <Link href={`/messaging/p/${encodeURIComponent(row.slug)}`}>{t.openChat}</Link>
                  </Button>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
