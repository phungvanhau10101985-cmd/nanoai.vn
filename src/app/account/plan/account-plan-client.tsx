'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Package, RefreshCw } from 'lucide-react'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import type { WebLocale } from '@/lib/i18n/config'
import { fillI18nTemplate } from '@/lib/i18n/fill-template'
import { formatSessionIsoDateTime } from '@/lib/datetime/format-session-iso-local'

const NUMBER_LOCALE: Record<WebLocale, string> = {
  vi: 'vi-VN',
  en: 'en-US',
  zh: 'zh-CN',
  ja: 'ja-JP',
  ko: 'ko-KR',
}

type ProductRow = {
  creditsRequired: number
  estimatedVnd: number
  chargedThisPeriod: boolean
  accessGranted: boolean
}

type PlanPayload = {
  ok: true
  period: string
  signupBonusCredits: number
  freeTrialDays: number
  freeTrial: {
    active: boolean
    endsAt: string | null
    daysRemaining: number
    userCreatedAt: string | null
  }
  products: {
    curriculum: ProductRow
  }
}

function isProductRow(x: unknown): x is ProductRow {
  if (!x || typeof x !== 'object') return false
  const o = x as Record<string, unknown>
  return (
    typeof o.creditsRequired === 'number' &&
    typeof o.estimatedVnd === 'number' &&
    typeof o.chargedThisPeriod === 'boolean' &&
    typeof o.accessGranted === 'boolean'
  )
}

function parsePlanPayload(json: unknown): PlanPayload | null {
  if (!json || typeof json !== 'object') return null
  const o = json as Record<string, unknown>
  if (o.ok !== true) return null
  const period = typeof o.period === 'string' ? o.period : ''
  if (!period) return null
  const signupBonusCredits = Number(o.signupBonusCredits)
  const freeTrialDays = Number(o.freeTrialDays)
  const ft = o.freeTrial
  if (!ft || typeof ft !== 'object') return null
  const f = ft as Record<string, unknown>
  const products = o.products
  if (!products || typeof products !== 'object') return null
  const p = products as Record<string, unknown>
  const cur = p.curriculum
  if (!isProductRow(cur)) return null
  return {
    ok: true,
    period,
    signupBonusCredits: Number.isFinite(signupBonusCredits) ? signupBonusCredits : 0,
    freeTrialDays: Number.isFinite(freeTrialDays) ? freeTrialDays : 0,
    freeTrial: {
      active: Boolean(f.active),
      endsAt: typeof f.endsAt === 'string' ? f.endsAt : null,
      daysRemaining: Math.max(0, Math.floor(Number(f.daysRemaining) || 0)),
      userCreatedAt: typeof f.userCreatedAt === 'string' ? f.userCreatedAt : null,
    },
    products: { curriculum: cur },
  }
}

function ProductBlock({
  title,
  row,
  period,
  freeTrialActive,
  t,
  webLocale,
}: {
  title: string
  row: ProductRow
  period: string
  freeTrialActive: boolean
  t: Dictionary['accountPlan']
  webLocale: WebLocale
}) {
  const vndFmt = row.estimatedVnd.toLocaleString(NUMBER_LOCALE[webLocale] ?? 'vi-VN')
  const costLine = fillI18nTemplate(t.monthlyCostLine, {
    credits: String(row.creditsRequired),
    vnd: vndFmt,
  })

  let status: string
  let variant: 'default' | 'secondary' | 'outline' = 'outline'
  if (!row.accessGranted) {
    status = fillI18nTemplate(t.statusPendingPayment, {
      credits: String(row.creditsRequired),
      period,
    })
    variant = 'outline'
  } else if (row.chargedThisPeriod) {
    status = fillI18nTemplate(t.statusPaidMonth, { period })
    variant = 'default'
  } else if (freeTrialActive) {
    status = t.statusViaTrial
    variant = 'secondary'
  } else {
    status = t.statusAccessOn
    variant = 'secondary'
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border bg-card/50 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 space-y-1">
        <p className="font-semibold text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">{costLine}</p>
      </div>
      <Badge variant={variant} className="w-fit shrink-0 whitespace-normal text-left sm:max-w-[min(100%,280px)]">
        {status}
      </Badge>
    </div>
  )
}

export function AccountPlanClientPage({
  t,
  webLocale,
}: {
  t: Dictionary['accountPlan']
  webLocale: WebLocale
}) {
  const [data, setData] = useState<PlanPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setErr(null)
    try {
      const res = await fetch('/api/account/monthly-service-credits', { cache: 'no-store', credentials: 'include' })
      if (res.status === 401) {
        window.location.assign('/auth/login?next=/account/plan')
        return
      }
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (res.status === 503) setErr(t.errorConfig)
        else setErr(t.errorLoad)
        setData(null)
        return
      }
      const parsed = parsePlanPayload(json)
      if (parsed) setData(parsed)
      else setErr(t.errorLoad)
    } catch {
      setErr(t.errorLoad)
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [t.errorConfig, t.errorLoad])

  useEffect(() => {
    void load()
  }, [load])

  const trialEndStr =
    data?.freeTrial?.endsAt != null
      ? formatSessionIsoDateTime(data.freeTrial.endsAt, webLocale)
      : ''

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 space-y-6">
      <div className="text-center space-y-2">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Package className="h-7 w-7" aria-hidden />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">{t.headline}</h1>
        <p className="text-sm text-muted-foreground">
          <Link href="/dashboard" className="underline-offset-4 hover:underline text-foreground/80">
            {t.backDashboard}
          </Link>
        </p>
      </div>

      <div className="flex justify-end">
        <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden />
          {t.refresh}
        </Button>
      </div>

      {loading && !data ? (
        <p className="text-center text-muted-foreground">{t.loading}</p>
      ) : err ? (
        <p className="text-center text-destructive text-sm">{err}</p>
      ) : data ? (
        <>
          <p className="text-center text-sm text-muted-foreground">
            {fillI18nTemplate(t.billingPeriod, { period: data.period })}
          </p>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t.trialSectionTitle}</CardTitle>
              {data.freeTrial.active ? (
                <CardDescription className="space-y-2 text-left">
                  <p>{t.trialActiveLine}</p>
                  <p>{fillI18nTemplate(t.trialTotalDaysNote, { days: String(data.freeTrialDays) })}</p>
                  <p>{fillI18nTemplate(t.trialDaysLeft, { days: String(data.freeTrial.daysRemaining) })}</p>
                  {trialEndStr ? <p>{fillI18nTemplate(t.trialEndsAtLine, { datetime: trialEndStr })}</p> : null}
                </CardDescription>
              ) : (
                <CardDescription>{t.trialNotActive}</CardDescription>
              )}
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t.productEnglishCoach}</CardTitle>
              <CardDescription className="text-left">{t.englishCoachPayPerLesson}</CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t.servicesSectionTitle}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <ProductBlock
                title={t.productCurriculum}
                row={data.products.curriculum}
                period={data.period}
                freeTrialActive={data.freeTrial.active}
                t={t}
                webLocale={webLocale}
              />
            </CardContent>
          </Card>

          <Card className="border-dashed bg-muted/20">
            <CardContent className="pt-6 text-sm text-muted-foreground space-y-3">
              <p>{fillI18nTemplate(t.noteSignupBonus, { credits: String(data.signupBonusCredits) })}</p>
              <p>{t.noteAiCredits}</p>
              <p>
                <Link href="/wallet" className="font-medium text-primary underline-offset-4 hover:underline">
                  {t.linkWallet}
                </Link>
              </p>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  )
}
