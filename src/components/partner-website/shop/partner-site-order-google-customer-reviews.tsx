'use client'

import { useEffect } from 'react'
import {
  PartnerSiteGoogleCustomerReviewsOptIn,
  type PartnerSiteGoogleCustomerReviewsOrder,
} from '@/components/partner-website/shop/partner-site-google-customer-reviews-opt-in'
import {
  isOrderEligibleForGoogleReviewsOptIn,
  markGoogleCustomerReviewsForOrder,
  shouldShowGoogleCustomerReviewsForOrder,
} from '@/lib/partner-website/shop/google-customer-reviews'

type Props = {
  merchantId: number | null
  locale?: string
  order: PartnerSiteGoogleCustomerReviewsOrder & {
    status?: string | null
    required_amount?: number | string | null
    paid_amount?: number | string | null
  }
  showAfterDepositSuccess?: boolean
}

export function PartnerSiteOrderGoogleCustomerReviews({
  merchantId,
  locale,
  order,
  showAfterDepositSuccess = false,
}: Props) {
  useEffect(() => {
    if (showAfterDepositSuccess && order?.id) {
      markGoogleCustomerReviewsForOrder(order.id)
    }
  }, [showAfterDepositSuccess, order?.id])

  if (!merchantId || !order?.id) return null
  if (!isOrderEligibleForGoogleReviewsOptIn(order)) return null

  const inShowWindow =
    showAfterDepositSuccess || shouldShowGoogleCustomerReviewsForOrder(order.id, order.created_at)
  if (!inShowWindow) return null

  const customer_email = (order.customer_email || '').trim()
  if (!customer_email.includes('@')) return null

  return (
    <PartnerSiteGoogleCustomerReviewsOptIn
      merchantId={merchantId}
      locale={locale}
      order={{ ...order, customer_email }}
    />
  )
}
