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
import {
  STUDENT_STUDY_INCLUDES,
  STUDENT_STUDY_TRIAL_DAYS,
  studentStudyPackageCopy,
  studentStudyPlanLabel,
  type StudentStudyPlanId,
} from '@/lib/student-study-package'

const NUMBER_LOCALE: Record<WebLocale, string> = {
  vi: 'vi-VN',
  en: 'en-US',
  zh: 'zh-CN',
  ja: 'ja-JP',
  ko: 'ko-KR',
}

type StudentPlanOption = {
  id: StudentStudyPlanId
  days: number
  priceVnd: number
  credits: number
}

type StudentProduct = {
  accessGranted: boolean
  trialStarted: boolean
  trialActive: boolean
  trialEndsAt: string | null
  trialDaysRemaining: number
  accessEndsAt: string | null
  plans: StudentPlanOption[]
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
    started: boolean
    startedAt: string | null
    active: boolean
    endsAt: string | null
    daysRemaining: number
  }
  products: {
    curriculum: ProductRow
    student: StudentProduct
  }
}

function isStudentPlanId(value: unknown): value is StudentStudyPlanId {
  return value === 'month' || value === 'quarter' || value === 'year'
}

function parseStudentProduct(value: unknown): StudentProduct | null {
  if (!value || typeof value !== 'object') return null
  const o = value as Record<string, unknown>
  if (!Array.isArray(o.plans)) return null
  const plans: StudentPlanOption[] = []
  for (const item of o.plans) {
    if (!item || typeof item !== 'object') return null
    const row = item as Record<string, unknown>
    if (!isStudentPlanId(row.id)) return null
    const days = Number(row.days)
    const priceVnd = Number(row.priceVnd)
    const credits = Number(row.credits)
    if (!Number.isFinite(days) || !Number.isFinite(priceVnd) || !Number.isFinite(credits)) return null
    plans.push({ id: row.id, days, priceVnd, credits })
  }
  if (plans.length !== 3) return null
  return {
    accessGranted: Boolean(o.accessGranted),
    trialStarted: Boolean(o.trialStarted),
    trialActive: Boolean(o.trialActive),
    trialEndsAt: typeof o.trialEndsAt === 'string' ? o.trialEndsAt : null,
    trialDaysRemaining: Math.max(0, Math.floor(Number(o.trialDaysRemaining) || 0)),
    accessEndsAt: typeof o.accessEndsAt === 'string' ? o.accessEndsAt : null,
    plans,
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
  const student = parseStudentProduct(p.student)
  if (!isProductRow(cur) || !student) return null
  return {
    ok: true,
    period,
    signupBonusCredits: Number.isFinite(signupBonusCredits) ? signupBonusCredits : 0,
    freeTrialDays: Number.isFinite(freeTrialDays) ? freeTrialDays : 0,
    freeTrial: {
      started: Boolean(f.started),
      startedAt: typeof f.startedAt === 'string' ? f.startedAt : null,
      active: Boolean(f.active),
      endsAt: typeof f.endsAt === 'string' ? f.endsAt : null,
      daysRemaining: Math.max(0, Math.floor(Number(f.daysRemaining) || 0)),
    },
    products: { curriculum: cur, student },
  }
}

function ProductBlock({
  title,
  row,
  period,
  freeTrialActive,
  trialNotStarted,
  t,
  webLocale,
}: {
  title: string
  row: ProductRow
  period: string
  freeTrialActive: boolean
  trialNotStarted: boolean
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
  } else if (trialNotStarted) {
    status = t.statusTrialPending
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
  const [buyingPlan, setBuyingPlan] = useState<StudentStudyPlanId | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [buyNote, setBuyNote] = useState<string | null>(null)
  const studentCopy = studentStudyPackageCopy(webLocale)

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

  const buyStudentPlan = useCallback(async (planId: StudentStudyPlanId) => {
    setBuyingPlan(planId)
    setBuyNote(null)
    try {
      const res = await fetch('/api/account/monthly-service-credits', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product: 'student', plan: planId }),
      })
      const json = (await res.json().catch(() => ({}))) as {
        error?: string
        code?: string
        alreadyCharged?: boolean
        charged?: boolean
        requiredCredits?: number
        priceVnd?: number
        accessEndsAt?: string
      }
      if (res.status === 401) {
        window.location.assign('/auth/login?next=/account/plan')
        return
      }
      const price = (json.priceVnd ?? 0).toLocaleString(NUMBER_LOCALE[webLocale] ?? 'vi-VN')
      const until =
        typeof json.accessEndsAt === 'string' ? formatSessionIsoDateTime(json.accessEndsAt, webLocale) : ''
      if (json.alreadyCharged) {
        setBuyNote(studentCopy.buyAlready)
      } else if (res.status === 402 || json.code === 'INSUFFICIENT_CREDITS') {
        setBuyNote(
          fillI18nTemplate(studentCopy.buyInsufficient, {
            credits: String(json.requiredCredits ?? ''),
            price,
          })
        )
      } else if (!res.ok) {
        setBuyNote(json.error || t.errorLoad)
      } else if (json.charged) {
        setBuyNote(fillI18nTemplate(studentCopy.buySuccess, { datetime: until }))
      }
      await load()
    } catch {
      setBuyNote(t.errorLoad)
    } finally {
      setBuyingPlan(null)
    }
  }, [load, studentCopy, t.errorLoad, webLocale])

  useEffect(() => {
    void load()
  }, [load])

  const trialEndStr =
    data?.freeTrial?.endsAt != null
      ? formatSessionIsoDateTime(data.freeTrial.endsAt, webLocale)
      : ''
  const includeText = {
    homework_help: studentCopy.homework,
    ai_tutor: studentCopy.tutor,
  } as const
  const studentAccessUntil =
    data?.products.student.accessEndsAt != null
      ? formatSessionIsoDateTime(data.products.student.accessEndsAt, webLocale)
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
              ) : data.freeTrial.started ? (
                <CardDescription>{t.trialNotActive}</CardDescription>
              ) : (
                <CardDescription>
                  {fillI18nTemplate(t.trialNotStarted, { days: String(data.freeTrialDays) })}
                </CardDescription>
              )}
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{studentCopy.title}</CardTitle>
              <CardDescription className="space-y-1 text-left">
                <p>{studentCopy.lead}</p>
                <p>{studentCopy.audience}</p>
                <p>{fillI18nTemplate(studentCopy.trialNote, { days: String(STUDENT_STUDY_TRIAL_DAYS) })}</p>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm font-semibold text-foreground">{studentCopy.includesTitle}</p>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {STUDENT_STUDY_INCLUDES.map((item) => (
                    <li key={item.id}>
                      <Link href={item.href} className="text-foreground underline-offset-4 hover:underline">
                        {includeText[item.id]}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
              <p className="text-sm text-muted-foreground">{studentCopy.excludesLanguage}</p>
              {data.products.student.trialActive ? (
                <Badge variant="secondary">
                  {fillI18nTemplate(studentCopy.trialActive, {
                    days: String(data.products.student.trialDaysRemaining),
                  })}
                </Badge>
              ) : data.products.student.trialStarted ? null : (
                <p className="text-sm text-muted-foreground">{studentCopy.trialWaiting}</p>
              )}
              {studentAccessUntil ? (
                <p className="text-sm text-foreground">
                  {fillI18nTemplate(studentCopy.accessUntil, { datetime: studentAccessUntil })}
                </p>
              ) : null}
              <div className="grid gap-2 sm:grid-cols-3">
                {data.products.student.plans.map((plan) => (
                  <Button
                    key={plan.id}
                    type="button"
                    variant={plan.id === 'year' ? 'default' : 'outline'}
                    disabled={buyingPlan != null}
                    onClick={() => void buyStudentPlan(plan.id)}
                  >
                    <span className="flex flex-col items-start gap-0.5">
                      <span>{buyingPlan === plan.id ? studentCopy.buying : studentStudyPlanLabel(webLocale, plan.id)}</span>
                      <span className="text-xs font-normal opacity-80">
                        {fillI18nTemplate(studentCopy.priceLine, {
                          price: plan.priceVnd.toLocaleString(NUMBER_LOCALE[webLocale] ?? 'vi-VN'),
                          credits: String(plan.credits),
                        })}
                      </span>
                    </span>
                  </Button>
                ))}
              </div>
              {buyNote ? <p className="text-sm text-muted-foreground">{buyNote}</p> : null}
            </CardContent>
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
                trialNotStarted={!data.freeTrial.started}
                t={t}
                webLocale={webLocale}
              />
            </CardContent>
          </Card>

          <Card className="border-dashed bg-muted/20">
            <CardContent className="pt-6 text-sm text-muted-foreground space-y-3">
              {data.signupBonusCredits > 0 ? (
                <p>{fillI18nTemplate(t.noteSignupBonus, { credits: String(data.signupBonusCredits) })}</p>
              ) : null}
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
