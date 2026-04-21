'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Building2, ExternalLink, Settings as SettingsIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { WebLocale } from '@/lib/i18n/config'
import {
  getHospitalityDashboardDictionary,
  type HospitalityDashboardDict,
} from '@/lib/i18n/hospitality-dashboard'

export type HospitalityPartnerCard = {
  id: string
  display_name: string
  slug: string
  brand_name: string | null
  logo_url: string | null
  is_active: boolean
  purge_at: string | null
  created_at: string | null
}

type Report = {
  booking_count_30d: number
  confirmed_count_30d: number
  revenue_paid_30d: number
  pending_holds: number
}

type ReportState =
  | { status: 'loading' }
  | { status: 'ready'; report: Report }
  | { status: 'error' }

const CURRENCY_BY_LOCALE: Record<WebLocale, string> = {
  vi: 'vi-VN',
  en: 'en-US',
  zh: 'zh-CN',
  ja: 'ja-JP',
  ko: 'ko-KR',
}

function formatRevenue(amount: number, locale: WebLocale): string {
  try {
    return new Intl.NumberFormat(CURRENCY_BY_LOCALE[locale] ?? 'vi-VN', {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0,
    }).format(amount)
  } catch {
    return `${Math.round(amount).toLocaleString()} VND`
  }
}

function formatDate(iso: string | null, locale: WebLocale): string {
  if (!iso) return ''
  try {
    return new Intl.DateTimeFormat(CURRENCY_BY_LOCALE[locale] ?? 'vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(iso))
  } catch {
    return iso.slice(0, 10)
  }
}

export function HospitalityDashboardClient({
  partners,
  locale,
}: {
  partners: HospitalityPartnerCard[]
  locale: WebLocale
}) {
  const t = useMemo(() => getHospitalityDashboardDictionary(locale), [locale])

  if (partners.length === 0) {
    return <EmptyState t={t} />
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold tracking-tight">{t.partnersHeading}</h2>
        <p className="text-sm text-muted-foreground">{t.partnersSubheading}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {partners.map((p) => (
          <PartnerCard key={p.id} partner={p} t={t} locale={locale} />
        ))}
      </div>
    </div>
  )
}

function EmptyState({ t }: { t: HospitalityDashboardDict }) {
  return (
    <Card className="border-dashed">
      <CardHeader className="items-center text-center">
        <div className="rounded-full bg-violet-100 p-3 dark:bg-violet-950/40">
          <Building2 className="h-8 w-8 text-violet-600" aria-hidden />
        </div>
        <CardTitle className="text-lg">{t.emptyTitle}</CardTitle>
        <CardDescription className="max-w-md">{t.emptyDescription}</CardDescription>
      </CardHeader>
      <CardContent className="flex justify-center">
        <Button asChild>
          <Link href="/dashboard/messaging">{t.emptyCta}</Link>
        </Button>
      </CardContent>
    </Card>
  )
}

function PartnerCard({
  partner,
  t,
  locale,
}: {
  partner: HospitalityPartnerCard
  t: HospitalityDashboardDict
  locale: WebLocale
}) {
  const [state, setState] = useState<ReportState>({ status: 'loading' })

  const load = useCallback(async () => {
    setState({ status: 'loading' })
    try {
      const res = await fetch(`/api/hospitality/partners/${partner.id}/reports`, {
        credentials: 'same-origin',
      })
      const data = (await res.json().catch(() => null)) as { report?: Report; error?: string } | null
      if (!res.ok || !data?.report) {
        setState({ status: 'error' })
        return
      }
      setState({ status: 'ready', report: data.report })
    } catch {
      setState({ status: 'error' })
    }
  }, [partner.id])

  useEffect(() => {
    void load()
  }, [load])

  const settingsHref = `/dashboard/hospitality/settings?partner=${encodeURIComponent(partner.id)}`
  const guestHref = `/hospitality/p/${encodeURIComponent(partner.slug)}`

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full border bg-muted">
            {partner.logo_url ? (
              <Image
                src={partner.logo_url}
                alt={partner.display_name}
                fill
                sizes="40px"
                className="object-cover"
                unoptimized
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <Building2 className="h-5 w-5 text-muted-foreground" aria-hidden />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <CardTitle className="truncate text-base">{partner.display_name}</CardTitle>
            <CardDescription className="truncate text-[11px]">
              {t.cardSlugLabel}: <code className="font-mono">{partner.slug}</code>
            </CardDescription>
          </div>
          <Badge variant={partner.purge_at ? 'outline' : 'secondary'} className="shrink-0">
            {partner.purge_at ? t.statusPurging : t.statusActive}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex-1 space-y-3">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{t.lastDaysLabel}</div>
        {state.status === 'loading' ? (
          <p className="text-sm text-muted-foreground">{t.statsLoading}</p>
        ) : state.status === 'error' ? (
          <p className="text-sm text-destructive">{t.statsError}</p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <Stat label={t.statBookings} value={String(state.report.booking_count_30d)} />
            <Stat label={t.statConfirmed} value={String(state.report.confirmed_count_30d)} />
            <Stat
              label={t.statRevenue}
              value={formatRevenue(state.report.revenue_paid_30d, locale)}
              highlight
            />
            <Stat label={t.statPendingHolds} value={String(state.report.pending_holds)} />
          </div>
        )}
        {partner.created_at ? (
          <p className="text-[11px] text-muted-foreground">
            {t.createdAt}: {formatDate(partner.created_at, locale)}
          </p>
        ) : null}
      </CardContent>
      <div className="flex flex-wrap gap-2 border-t p-3">
        <Button size="sm" variant="default" asChild className="gap-1">
          <Link href={settingsHref}>
            <SettingsIcon className="h-3.5 w-3.5" aria-hidden />
            {t.cardOpenSettings}
          </Link>
        </Button>
        <Button size="sm" variant="outline" asChild className="gap-1">
          <Link href={guestHref} target="_blank" rel="noreferrer">
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            {t.cardOpenGuestChat}
          </Link>
        </Button>
      </div>
    </Card>
  )
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-md border bg-background/50 p-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={highlight ? 'text-base font-semibold text-violet-700 dark:text-violet-300' : 'text-base font-semibold'}>
        {value}
      </p>
    </div>
  )
}
