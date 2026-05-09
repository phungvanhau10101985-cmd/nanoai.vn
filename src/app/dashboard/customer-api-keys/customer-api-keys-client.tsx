'use client'

import { useEffect, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import {
  checkCustomerGeminiApiKeyAction,
  createByokPlanPaymentAction,
  deleteCustomerGeminiApiKeyAction,
  getByokPlanPaymentAction,
  saveCustomerGeminiApiKeyAction,
  setCustomerGeminiApiKeyEnabledAction,
} from './actions'
import type { UserAiApiKeyPublicRow } from '@/lib/db/user-ai-api-keys-pg'
import type { ByokPlanPaymentRow, ByokSubscriptionRow } from '@/lib/db/user-ai-api-key-billing-pg'

export type CustomerApiKeyPlanCopy = {
  id: 'basic' | 'pro' | 'business'
  name: string
  audience: string
  monthlyPriceVnd: number
  features: string[]
  recommended?: boolean
}

export type CustomerApiKeysCopy = {
  title: string
  subtitle: string
  overviewTitle: string
  overviewBody: string
  geminiTitle: string
  geminiDescription: string
  apiKeyLabel: string
  apiKeyPlaceholder: string
  saveAndCheck: string
  checkConnection: string
  deleteKey: string
  enabled: string
  noKey: string
  keyHint: string
  status: string
  valid: string
  invalid: string
  unchecked: string
  lastChecked: string
  lastError: string
  guideTitle: string
  guideSteps: string[]
  securityTitle: string
  securityItems: string[]
  scopeTitle: string
  scopeBody: string
  pricingTitle: string
  pricingSubtitle: string
  firstMonthSaleBadge: string
  originalPriceLabel: string
  firstMonthPriceLabel: string
  perMonthLabel: string
  choosePlan: string
  pricingNote: string
  currentPlanTitle: string
  noActivePlan: string
  activeUntil: string
  pendingPaymentTitle: string
  transferContent: string
  paymentAmount: string
  scanQr: string
  paymentCompleted: string
  plans: CustomerApiKeyPlanCopy[]
  successSaved: string
  successChecked: string
  successDeleted: string
  successUpdated: string
}

const FIRST_MONTH_DISCOUNT_PERCENT = 30

function formatVnd(value: number): string {
  return `${Math.round(value).toLocaleString('vi-VN')}đ`
}

function discountedFirstMonthPrice(price: number): number {
  return Math.round(price * (100 - FIRST_MONTH_DISCOUNT_PERCENT) / 100)
}

export function CustomerApiKeysClient({
  initialRow,
  initialSubscription,
  initialPayments,
  copy,
}: {
  initialRow: UserAiApiKeyPublicRow | null
  initialSubscription: ByokSubscriptionRow | null
  initialPayments: ByokPlanPaymentRow[]
  copy: CustomerApiKeysCopy
}) {
  const [row, setRow] = useState(initialRow)
  const [subscription, setSubscription] = useState(initialSubscription)
  const [payments, setPayments] = useState(initialPayments)
  const [activePayment, setActivePayment] = useState<ByokPlanPaymentRow | null>(
    initialPayments.find((p) => p.status === 'pending') ?? null
  )
  const [apiKey, setApiKey] = useState('')
  const [isPending, startTransition] = useTransition()
  const { toast } = useToast()

  const refreshStatus = async () => {
    const res = await fetch('/api/account/customer-api-keys/gemini', { credentials: 'same-origin' })
    const j = (await res.json().catch(() => ({}))) as {
      row?: UserAiApiKeyPublicRow | null
      subscription?: ByokSubscriptionRow | null
      payments?: ByokPlanPaymentRow[]
    }
    setRow(j.row ?? null)
    setSubscription(j.subscription ?? null)
    setPayments(j.payments ?? [])
  }

  const showResult = async (result: { ok: true } | { error: string }, success: string) => {
    await refreshStatus()
    if ('error' in result) {
      toast({ title: copy.invalid, description: result.error, variant: 'destructive' })
      return
    }
    toast({ title: success })
  }

  const handleSave = () => {
    startTransition(async () => {
      const result = await saveCustomerGeminiApiKeyAction(apiKey)
      if ('ok' in result) setApiKey('')
      await showResult(result, copy.successSaved)
    })
  }

  const handleCheck = () => {
    startTransition(async () => {
      await showResult(await checkCustomerGeminiApiKeyAction(), copy.successChecked)
    })
  }

  const handleDelete = () => {
    startTransition(async () => {
      const result = await deleteCustomerGeminiApiKeyAction()
      if ('ok' in result) setRow(null)
      await showResult(result, copy.successDeleted)
    })
  }

  const handleToggle = (enabled: boolean) => {
    setRow((cur) => (cur ? { ...cur, is_enabled: enabled } : cur))
    startTransition(async () => {
      await showResult(await setCustomerGeminiApiKeyEnabledAction(enabled), copy.successUpdated)
    })
  }

  const handleChoosePlan = (planId: CustomerApiKeyPlanCopy['id']) => {
    startTransition(async () => {
      const result = await createByokPlanPaymentAction(planId)
      if ('error' in result) {
        toast({ title: copy.invalid, description: result.error, variant: 'destructive' })
        return
      }
      setActivePayment(result.payment)
      setPayments((cur) => [result.payment, ...cur.filter((p) => p.id !== result.payment.id)])
      await refreshStatus()
    })
  }

  const handleRefreshPayment = () => {
    if (!activePayment) return
    startTransition(async () => {
      const result = await getByokPlanPaymentAction(activePayment.id)
      if ('error' in result) {
        toast({ title: copy.invalid, description: result.error, variant: 'destructive' })
        return
      }
      setActivePayment(result.payment.status === 'pending' ? result.payment : null)
      setPayments((cur) => [result.payment, ...cur.filter((p) => p.id !== result.payment.id)])
      await refreshStatus()
      if (result.payment.status === 'completed') toast({ title: copy.paymentCompleted })
    })
  }

  useEffect(() => {
    if (!activePayment || activePayment.status !== 'pending') return
    const timer = window.setInterval(() => {
      void getByokPlanPaymentAction(activePayment.id).then(async (result) => {
        if ('error' in result) return
        setActivePayment(result.payment.status === 'pending' ? result.payment : null)
        setPayments((cur) => [result.payment, ...cur.filter((p) => p.id !== result.payment.id)])
        if (result.payment.status === 'completed') {
          await refreshStatus()
          toast({ title: copy.paymentCompleted })
        }
      })
    }, 5000)
    return () => window.clearInterval(timer)
  }, [activePayment, copy.paymentCompleted, toast])

  const status = row?.status ?? 'unchecked'
  const statusLabel = status === 'valid' ? copy.valid : status === 'invalid' ? copy.invalid : copy.unchecked
  const badgeVariant = status === 'valid' ? 'default' : status === 'invalid' ? 'destructive' : 'secondary'
  const subscriptionEnd = subscription?.current_period_end ? new Date(subscription.current_period_end) : null
  const hasActiveSubscription =
    subscription?.status === 'active' && subscriptionEnd != null && !Number.isNaN(subscriptionEnd.getTime()) && subscriptionEnd > new Date()

  return (
    <div className="app-shell container max-w-5xl space-y-6 py-6">
      <div className="section-surface space-y-2">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{copy.title}</h1>
        <p className="text-sm text-muted-foreground sm:text-base">{copy.subtitle}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <Card className="tool-tile">
          <CardHeader>
            <CardTitle>{copy.geminiTitle}</CardTitle>
            <CardDescription>{copy.geminiDescription}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-2">
              <Label htmlFor="gemini-api-key">{copy.apiKeyLabel}</Label>
              <Input
                id="gemini-api-key"
                type="password"
                value={apiKey}
                placeholder={copy.apiKeyPlaceholder}
                onChange={(e) => setApiKey(e.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={handleSave} disabled={isPending || !apiKey.trim()}>
                {copy.saveAndCheck}
              </Button>
              <Button type="button" variant="outline" onClick={handleCheck} disabled={isPending || !row}>
                {copy.checkConnection}
              </Button>
              <Button type="button" variant="destructive" onClick={handleDelete} disabled={isPending || !row}>
                {copy.deleteKey}
              </Button>
            </div>
            <div className="rounded-lg border bg-muted/30 p-4 text-sm">
              {row ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="font-medium">{copy.keyHint}: {row.key_hint}</div>
                      <div className="text-muted-foreground">{copy.status}: <Badge variant={badgeVariant}>{statusLabel}</Badge></div>
                    </div>
                    <Label className="flex items-center gap-2">
                      <Switch checked={row.is_enabled} onCheckedChange={handleToggle} disabled={isPending} />
                      {copy.enabled}
                    </Label>
                  </div>
                  {row.last_checked_at && (
                    <p className="text-muted-foreground">{copy.lastChecked}: {new Date(row.last_checked_at).toLocaleString()}</p>
                  )}
                  {row.last_error && <p className="text-red-600">{copy.lastError}: {row.last_error}</p>}
                </div>
              ) : (
                <p className="text-muted-foreground">{copy.noKey}</p>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="tool-tile">
            <CardHeader>
              <CardTitle>{copy.overviewTitle}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">{copy.overviewBody}</CardContent>
          </Card>
          <Card className="tool-tile">
            <CardHeader>
              <CardTitle>{copy.scopeTitle}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">{copy.scopeBody}</CardContent>
          </Card>
          <Card className="tool-tile">
            <CardHeader>
              <CardTitle>{copy.currentPlanTitle}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {hasActiveSubscription && subscription ? (
                <>
                  <Badge variant="success">{subscription.plan_id.toUpperCase()}</Badge>
                  <p className="text-muted-foreground">
                    {copy.activeUntil}: {subscriptionEnd?.toLocaleString()}
                  </p>
                </>
              ) : (
                <p className="text-muted-foreground">{copy.noActivePlan}</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="tool-tile">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>{copy.pricingTitle}</CardTitle>
              <CardDescription>{copy.pricingSubtitle}</CardDescription>
            </div>
            <Badge variant="success">{copy.firstMonthSaleBadge}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            {copy.plans.map((plan) => {
              const firstMonthPrice = discountedFirstMonthPrice(plan.monthlyPriceVnd)
              return (
                <div
                  key={plan.id}
                  className={`rounded-xl border p-4 ${plan.recommended ? 'border-violet-500 bg-violet-50/50 dark:bg-violet-950/20' : 'bg-background'}`}
                >
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-lg font-semibold">{plan.name}</h3>
                      <p className="text-xs text-muted-foreground">{plan.audience}</p>
                    </div>
                    {plan.recommended ? <Badge>{copy.choosePlan}</Badge> : null}
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground line-through">
                      {copy.originalPriceLabel}: {formatVnd(plan.monthlyPriceVnd)}
                    </p>
                    <p className="text-2xl font-bold">
                      {formatVnd(firstMonthPrice)}
                      <span className="ml-1 text-xs font-normal text-muted-foreground">{copy.perMonthLabel}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {copy.firstMonthPriceLabel}
                    </p>
                  </div>
                  <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                    {plan.features.map((feature) => <li key={feature}>- {feature}</li>)}
                  </ul>
                  <Button
                    type="button"
                    className="mt-4 w-full"
                    variant={plan.recommended ? 'default' : 'outline'}
                    onClick={() => handleChoosePlan(plan.id)}
                    disabled={isPending}
                  >
                    {copy.choosePlan}
                  </Button>
                </div>
              )
            })}
          </div>
          <p className="mt-4 text-xs text-muted-foreground">{copy.pricingNote}</p>
        </CardContent>
      </Card>

      {activePayment ? (
        <Card className="tool-tile border-violet-200">
          <CardHeader>
            <CardTitle>{copy.pendingPaymentTitle}</CardTitle>
            <CardDescription>{copy.scanQr}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-[220px_1fr]">
            <div className="rounded-lg border bg-white p-2">
              <img src={activePayment.qr_url} alt={copy.scanQr} className="h-auto w-full" />
            </div>
            <div className="space-y-3 text-sm">
              <p><span className="font-medium">{copy.paymentAmount}:</span> {formatVnd(activePayment.amount)}</p>
              <p><span className="font-medium">{copy.transferContent}:</span> <span className="font-mono">{activePayment.transaction_content}</span></p>
              <p><span className="font-medium">Bank:</span> {activePayment.bank_name} - {activePayment.bank_account}</p>
              <Button type="button" onClick={handleRefreshPayment} disabled={isPending}>
                {copy.checkConnection}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {payments.length > 0 ? (
        <Card className="tool-tile">
          <CardHeader>
            <CardTitle>{copy.pendingPaymentTitle}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {payments.slice(0, 5).map((payment) => (
              <div key={payment.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
                <div>
                  <div className="font-medium">{payment.plan_id.toUpperCase()} - {formatVnd(payment.amount)}</div>
                  <div className="text-xs text-muted-foreground">{payment.transaction_content}</div>
                </div>
                <Badge variant={payment.status === 'completed' ? 'success' : payment.status === 'pending' ? 'secondary' : 'destructive'}>
                  {payment.status}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="tool-tile">
          <CardHeader>
            <CardTitle>{copy.guideTitle}</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
              {copy.guideSteps.map((step) => <li key={step}>{step}</li>)}
            </ol>
          </CardContent>
        </Card>
        <Card className="tool-tile">
          <CardHeader>
            <CardTitle>{copy.securityTitle}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
              {copy.securityItems.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
