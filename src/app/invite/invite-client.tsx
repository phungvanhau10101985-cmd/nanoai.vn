'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Copy, Gift, UserPlus, Users } from 'lucide-react'
import type { Dictionary } from '@/lib/i18n/dictionaries'

export function InviteClientPage({ inviteUrl, t }: { inviteUrl: string; t: Dictionary['referral'] }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 space-y-8">
      <div className="text-center space-y-2">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300">
          <Gift className="h-7 w-7" aria-hidden />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">{t.headline}</h1>
        <p className="text-muted-foreground text-sm sm:text-base max-w-lg mx-auto">{t.description}</p>
        <div className="flex flex-wrap items-stretch justify-center gap-3 pt-2">
          <div className="flex min-w-[140px] flex-1 max-w-[200px] items-center gap-3 rounded-2xl border border-violet-200/70 bg-violet-50/80 px-4 py-3 text-left dark:border-violet-800/50 dark:bg-violet-950/30">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-background text-violet-600 dark:text-violet-300">
              <Users className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">{t.inviteVisualYou}</p>
              <p className="text-lg font-semibold tabular-nums text-violet-700 dark:text-violet-200">+2</p>
            </div>
          </div>
          <div className="flex min-w-[140px] flex-1 max-w-[200px] items-center gap-3 rounded-2xl border border-border/80 bg-muted/40 px-4 py-3 text-left">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-background text-muted-foreground">
              <UserPlus className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">{t.inviteVisualFriend}</p>
              <p className="text-sm font-medium leading-snug text-muted-foreground">{t.inviteeNoReferralCredit}</p>
            </div>
          </div>
        </div>
      </div>

      <Card className="border-violet-200/60 dark:border-violet-800/40">
        <CardHeader>
          <CardTitle className="text-lg">{t.yourLinkLabel}</CardTitle>
          <CardDescription className="break-all font-mono text-xs sm:text-sm">{inviteUrl}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button type="button" onClick={() => void copy()} className="w-full sm:w-auto gap-2">
            <Copy className="h-4 w-4" />
            {copied ? t.copied : t.copyButton}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t.howItWorksTitle}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            <span className="font-semibold text-foreground">1.</span> {t.step1}
          </p>
          <p>
            <span className="font-semibold text-foreground">2.</span> {t.step2}
          </p>
          <p>
            <span className="font-semibold text-foreground">3.</span> {t.step3}
          </p>
          <p className="pt-2 text-xs border-t">{t.bonusNote}</p>
        </CardContent>
      </Card>
    </div>
  )
}
