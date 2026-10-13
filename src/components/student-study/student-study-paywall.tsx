'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import type { WebLocale } from '@/lib/i18n/config'
import { fillI18nTemplate } from '@/lib/i18n/fill-template'
import {
  STUDENT_STUDY_PLANS,
  studentStudyPackageCopy,
  studentStudyPlanCredits,
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

export function StudentStudyPaywall({
  locale,
  onPurchased,
}: {
  locale: WebLocale
  onPurchased: () => void
}) {
  const copy = studentStudyPackageCopy(locale)
  const [buyingPlan, setBuyingPlan] = useState<StudentStudyPlanId | null>(null)
  const [note, setNote] = useState('')

  async function buy(planId: StudentStudyPlanId) {
    setBuyingPlan(planId)
    setNote('')
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
        charged?: boolean
        alreadyCharged?: boolean
        requiredCredits?: number
        priceVnd?: number
      }
      if (res.status === 401) {
        window.location.assign(`/auth/login?next=${encodeURIComponent(window.location.pathname)}`)
        return
      }
      const price = (json.priceVnd ?? 0).toLocaleString(NUMBER_LOCALE[locale] ?? 'vi-VN')
      if (res.status === 402 || json.code === 'INSUFFICIENT_CREDITS') {
        setNote(
          fillI18nTemplate(copy.buyInsufficient, {
            credits: String(json.requiredCredits ?? ''),
            price,
          })
        )
        return
      }
      if (!res.ok) {
        setNote(json.error || copy.gateBody)
        return
      }
      if (json.charged || json.alreadyCharged) onPurchased()
    } catch {
      setNote(copy.gateBody)
    } finally {
      setBuyingPlan(null)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col justify-center gap-4 overflow-y-auto p-4">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-foreground">{copy.gateTitle}</h2>
        <p className="text-sm leading-6 text-muted-foreground">{copy.gateBody}</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        {STUDENT_STUDY_PLANS.map((plan) => (
          <Button
            key={plan.id}
            type="button"
            variant={plan.id === 'year' ? 'default' : 'outline'}
            disabled={buyingPlan != null}
            onClick={() => void buy(plan.id)}
          >
            <span className="flex flex-col items-start gap-0.5">
              <span>{buyingPlan === plan.id ? copy.buying : studentStudyPlanLabel(locale, plan.id)}</span>
              <span className="text-xs font-normal opacity-80">
                {fillI18nTemplate(copy.priceLine, {
                  price: plan.priceVnd.toLocaleString(NUMBER_LOCALE[locale] ?? 'vi-VN'),
                  credits: String(studentStudyPlanCredits(plan.priceVnd)),
                })}
              </span>
            </span>
          </Button>
        ))}
      </div>
      {note ? <p className="text-sm text-destructive">{note}</p> : null}
      <p>
        <Link href="/wallet" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
          {copy.gateWallet}
        </Link>
      </p>
    </div>
  )
}
