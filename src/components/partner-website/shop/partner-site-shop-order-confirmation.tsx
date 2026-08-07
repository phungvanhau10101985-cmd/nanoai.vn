'use client'

import type { WebLocale } from '@/lib/i18n/config'
import { getPartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'
import { formatVnd } from '@/lib/partner-website/shop/cart-line-utils'

type OrderSnapshot = {
  id?: string
  payment_qr_url?: string | null
  payment_reference?: string | null
  required_amount?: number | null
  subtotal_amount?: number | null
  /** W1.7 */
  payment_method?: 'cod' | 'bank_transfer' | 'ewallet' | null
  shipping_fee_amount?: number | null
}

type Props = {
  locale: WebLocale
  order: OrderSnapshot
  chatPath: string
}

export function PartnerSiteShopOrderConfirmation({ locale, order, chatPath }: Props) {
  const t = getPartnerSiteShopCopy(locale)
  const qr = order.payment_qr_url?.trim() ?? ''
  const ref = order.payment_reference?.trim() ?? ''
  const required = Number(order.required_amount ?? 0)
  const isEwallet = order.payment_method === 'ewallet'
  const shippingFee = Number(order.shipping_fee_amount ?? 0)

  return (
    <div style={{ marginTop: 24, padding: 20, border: '1px solid #e2e8f0', borderRadius: 12, background: '#f8fafc' }}>
      <h2>{t.checkoutSuccess}</h2>
      {order.id ? <p className="pw-shop-muted">{t.orderIdLabel}: {order.id}</p> : null}
      {shippingFee > 0 ? (
        <p className="pw-shop-muted">
          {t.cartShippingFeeLabel}: {formatVnd(shippingFee)}
        </p>
      ) : null}
      {required > 0 ? (
        <p>
          {t.depositAmount}: <strong>{formatVnd(required)}</strong>
        </p>
      ) : null}
      {required > 0 && isEwallet ? <h3 style={{ marginTop: 12 }}>{t.orderConfirmEwalletTitle}</h3> : null}
      {required > 0 && isEwallet ? <p className="pw-shop-muted">{t.orderConfirmEwalletHint}</p> : null}
      {ref && !isEwallet ? <p className="pw-shop-muted">{t.paymentReference}: {ref}</p> : null}
      {qr ? (
        <p style={{ marginTop: 12 }}>
          <img src={qr} alt="QR" style={{ maxWidth: 280, width: '100%', borderRadius: 8 }} />
        </p>
      ) : null}
      <p style={{ marginTop: 16 }}>
        <a href={chatPath} className="pw-shop-btn">
          {t.navChat}
        </a>
      </p>
    </div>
  )
}
