'use client'

import { useCallback, useEffect, useRef } from 'react'
import {
  clearGoogleCustomerReviewsShowFlag,
  deliveryCountryForGoogleReviews,
  estimatedDeliveryDateForGoogleReviews,
  googleCustomerReviewsOptInStyle,
  googleCustomerReviewsPromptDelayMs,
  markGoogleCustomerReviewsHandled,
} from '@/lib/partner-website/shop/google-customer-reviews'

export type PartnerSiteGoogleCustomerReviewsOrder = {
  id: string
  order_code: string
  customer_email?: string | null
  estimated_delivery?: string | null
  created_at?: string | null
}

declare global {
  interface Window {
    renderOptIn?: () => void
    gapi?: {
      load: (name: string, cb: () => void) => void
      surveyoptin?: { render: (o: Record<string, unknown>) => void }
    }
    ___gcfg?: { lang: string }
  }
}

const PLATFORM_SCRIPT = 'https://apis.google.com/js/platform.js?onload=renderOptIn'

type Props = {
  merchantId: number
  order: PartnerSiteGoogleCustomerReviewsOrder
  locale?: string
  clearShowFlagAfterRender?: boolean
}

/** Popup opt-in chính thức của Google — không hiện hộp trung gian của shop. */
export function PartnerSiteGoogleCustomerReviewsOptIn({
  merchantId,
  order,
  locale = 'vi',
  clearShowFlagAfterRender = true,
}: Props) {
  const renderedRef = useRef(false)
  const cancelLoadRef = useRef<(() => void) | null>(null)

  const email = (order.customer_email || '').trim()
  const orderId = (order.order_code || order.id || '').trim()
  const canRun = Boolean(merchantId && email && orderId && email.includes('@'))

  const invokeGoogleRender = useCallback(() => {
    if (renderedRef.current || !canRun) return

    cancelLoadRef.current?.()
    window.___gcfg = { lang: locale === 'en' ? 'en' : 'vi' }

    const payload = {
      merchant_id: merchantId,
      order_id: orderId,
      email,
      delivery_country: deliveryCountryForGoogleReviews(),
      estimated_delivery_date: estimatedDeliveryDateForGoogleReviews(order),
      opt_in_style: googleCustomerReviewsOptInStyle(),
    }

    let cancelled = false
    let retryTimer: number | null = null

    const cancel = () => {
      cancelled = true
      if (retryTimer != null) {
        window.clearTimeout(retryTimer)
        retryTimer = null
      }
    }
    cancelLoadRef.current = cancel

    const attempt = (n = 0) => {
      if (cancelled || renderedRef.current) return
      if (window.gapi?.load) {
        window.gapi.load('surveyoptin', function onSurveyReady() {
          if (cancelled || renderedRef.current) return
          window.gapi?.surveyoptin?.render(payload)
          renderedRef.current = true
          markGoogleCustomerReviewsHandled(order.id, 'accepted')
          if (clearShowFlagAfterRender) {
            clearGoogleCustomerReviewsShowFlag(order.id)
          }
          cancelLoadRef.current = null
        })
        return
      }
      if (n < 24) {
        retryTimer = window.setTimeout(() => attempt(n + 1), 250)
      } else {
        cancelLoadRef.current = null
      }
    }

    const invokeRender = () => attempt()
    window.renderOptIn = invokeRender

    const existing = document.querySelector('script[src*="apis.google.com/js/platform.js"]')
    if (existing) {
      invokeRender()
      if (!window.gapi) existing.addEventListener('load', invokeRender)
      return
    }

    const script = document.createElement('script')
    script.src = PLATFORM_SCRIPT
    script.async = true
    script.defer = true
    script.addEventListener('load', invokeRender)
    document.body.appendChild(script)
    invokeRender()
  }, [canRun, clearShowFlagAfterRender, email, locale, merchantId, order, orderId])

  useEffect(() => {
    if (!canRun) return
    const delay = googleCustomerReviewsPromptDelayMs()
    const timer = window.setTimeout(invokeGoogleRender, delay)
    return () => {
      window.clearTimeout(timer)
      cancelLoadRef.current?.()
    }
  }, [canRun, invokeGoogleRender])

  return null
}
