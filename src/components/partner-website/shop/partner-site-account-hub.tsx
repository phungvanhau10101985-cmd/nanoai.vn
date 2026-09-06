'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import type { WebLocale } from '@/lib/i18n/config'
import { PartnerSiteAccountSessionActions } from '@/components/partner-website/shop/partner-site-account-session-actions'
import { usePartnerSiteGuestSession } from '@/hooks/use-partner-site-guest-session'
import { usePartnerSiteCustomDomain } from '@/lib/partner-website/shop/partner-site-custom-domain-context'
import {
  countPartnerSiteOrdersByStatusFilter,
  PARTNER_SITE_ACCOUNT_HUB_ORDER_FILTER_KEYS,
  type PartnerSiteOrderStatusFilterKey,
} from '@/lib/partner-website/shop/partner-site-order-status-filters'
import { getPartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'
import {
  getPartnerSiteAccountMenuItems,
  isPartnerSiteAccountHubRow,
  partnerSiteAccountMenuEmoji,
} from '@/lib/partner-website/shop/partner-site-shop-nav-config'
import {
  partnerSiteAccountEditPath,
  partnerSiteAddressesPath,
  partnerSiteOrdersPath,
} from '@/lib/partner-website/shop/partner-site-shop-paths'
import { PW_EL } from '@/lib/partner-website/visual-editor/pw-ui-contract'
import type { PartnerSiteVisitorProfile } from '@/lib/partner-website/shop/partner-site-personalization'

type WalletVoucher = { code?: string }

type OrderLite = {
  status?: string | null
  shipping_status?: string | null
  has_review?: boolean | null
}

type Props = {
  siteSlug: string
  partnerSlug: string
  locale: WebLocale
  profile: PartnerSiteVisitorProfile | null
  shopAdminHref: string | null
  displayName: string
  unreadNotifications?: number
}

function filterLabel(
  key: PartnerSiteOrderStatusFilterKey,
  t: ReturnType<typeof getPartnerSiteShopCopy>
): string {
  switch (key) {
    case 'all':
      return t.ordersFilterAll
    case 'waiting_payment':
      return t.ordersFilterWaitingPayment
    case 'processing':
      return t.ordersFilterProcessing
    case 'delivered':
      return t.ordersFilterDelivered
    case 'reviewed':
      return t.ordersFilterReviewed
    case 'cancelled':
      return t.ordersFilterCancelled
    case 'returned':
      return t.ordersFilterReturned
  }
}

export function PartnerSiteAccountHub({
  siteSlug,
  partnerSlug,
  locale,
  profile,
  shopAdminHref,
  displayName,
  unreadNotifications = 0,
}: Props) {
  const t = getPartnerSiteShopCopy(locale)
  const customDomain = usePartnerSiteCustomDomain()
  const { ready, isAuthenticated, authHeaders, captureFromResponse } =
    usePartnerSiteGuestSession(siteSlug)
  const [orders, setOrders] = useState<OrderLite[]>([])
  const [walletCount, setWalletCount] = useState(0)

  useEffect(() => {
    if (!ready || !isAuthenticated) return
    void fetch(`/api/messaging/guest/${encodeURIComponent(partnerSlug)}/orders`, {
      credentials: 'same-origin',
      headers: authHeaders(),
    })
      .then((res) => {
        captureFromResponse(res)
        return res.json()
      })
      .then((json: { orders?: OrderLite[] }) => setOrders(Array.isArray(json.orders) ? json.orders : []))
      .catch(() => setOrders([]))
    void fetch(`/api/site/${encodeURIComponent(siteSlug)}/promotions/wallet`, {
      credentials: 'same-origin',
      headers: authHeaders(),
    })
      .then((res) => {
        captureFromResponse(res)
        return res.json()
      })
      .then((json: { vouchers?: WalletVoucher[] }) => setWalletCount(Array.isArray(json.vouchers) ? json.vouchers.length : 0))
      .catch(() => setWalletCount(0))
  }, [authHeaders, captureFromResponse, isAuthenticated, partnerSlug, ready, siteSlug])

  const counts = useMemo(() => countPartnerSiteOrdersByStatusFilter(orders), [orders])
  const hubItems = getPartnerSiteAccountMenuItems({ siteSlug, locale, customDomain }).filter(
    isPartnerSiteAccountHubRow
  )
  const editHref = partnerSiteAccountEditPath(siteSlug, { customDomain })
  const ordersHref = partnerSiteOrdersPath(siteSlug, { customDomain })
  const phone = profile?.customer_phone?.trim() || ''
  const email = profile?.email?.trim() || ''
  const name = displayName || t.navAccount

  return (
    <>
      <div className="pw-shop-account-hub-mobile">
        <div className="pw-shop-account-hub-head">
          <h1 className="pw-shop-account-hub-name" data-pw-el={PW_EL.heading}>
            {name}
          </h1>
          {phone ? <p className="pw-shop-account-hub-phone">{phone}</p> : null}
          <Link href={editHref} className="pw-shop-account-hub-edit">
            {t.accountEditPersonal}
          </Link>
        </div>

        <div className="pw-shop-account-hub-orders">
          <p className="pw-shop-account-hub-orders-kicker">{t.navOrders}</p>
          <div className="pw-shop-account-hub-order-row" role="navigation" aria-label={t.ordersFilterAriaLabel}>
            {PARTNER_SITE_ACCOUNT_HUB_ORDER_FILTER_KEYS.map((key) => {
              const href = key === 'all' ? ordersHref : `${ordersHref}?tab=${encodeURIComponent(key)}`
              return (
                <Link key={key} href={href} className="pw-shop-account-hub-order-chip">
                  <span>{filterLabel(key, t)}</span>
                  <span className="pw-shop-account-hub-order-count">{counts[key]}</span>
                </Link>
              )
            })}
          </div>
        </div>

        <div className="pw-shop-account-hub-list">
          {hubItems.flatMap((item) => {
            const row = (
              <Link key={item.id} href={item.href} className="pw-shop-account-hub-row" data-pw-el={PW_EL.menuItem}>
                <span>
                  {item.emoji} {item.label}
                </span>
                {item.id === 'wallet' && walletCount > 0 ? (
                  <span className="pw-shop-account-hub-wallet-badge">{walletCount}</span>
                ) : item.id === 'notifications' && unreadNotifications > 0 ? (
                  <span className="pw-shop-account-hub-wallet-badge">
                    {unreadNotifications > 99 ? '99+' : unreadNotifications}
                  </span>
                ) : (
                  <span className="pw-shop-account-hub-chevron" aria-hidden>
                    ›
                  </span>
                )}
              </Link>
            )
            if (item.id === 'addresses' && shopAdminHref) {
              return [
                row,
                <a
                  key="admin"
                  href={shopAdminHref}
                  className="pw-shop-account-hub-row is-admin"
                  data-pw-el={PW_EL.menuItem}
                  rel="noopener noreferrer"
                >
                  <span>
                    {partnerSiteAccountMenuEmoji('admin')} {t.accountOpenShopAdmin}
                  </span>
                  <span className="pw-shop-account-hub-chevron" aria-hidden>
                    ›
                  </span>
                </a>,
              ]
            }
            return [row]
          })}
        </div>

        <div className="pw-shop-account-hub-session">
          <PartnerSiteAccountSessionActions siteSlug={siteSlug} locale={locale} />
        </div>
      </div>

      <div className="pw-shop-account-hub-desktop">
        <div className="pw-shop-account-summary-head">
          <h2 data-pw-el={PW_EL.heading}>{t.accountInfoTitle}</h2>
          <Link href={editHref} className="pw-shop-btn">
            {t.accountEditProfile}
          </Link>
        </div>
        <dl className="pw-shop-account-dl">
          <div>
            <dt>{t.accountFullName}</dt>
            <dd>{displayName || '—'}</dd>
          </div>
          <div>
            <dt>{t.checkoutPhone}</dt>
            <dd>{phone || '—'}</dd>
          </div>
          <div>
            <dt>{t.accountEmailLabel}</dt>
            <dd>{email || '—'}</dd>
          </div>
        </dl>
        <div className="pw-shop-account-summary-links">
          <Link href={partnerSiteAddressesPath(siteSlug, { customDomain })} className="pw-shop-account-addresses-link">
            {t.accountManageAddresses}
          </Link>
          {shopAdminHref ? (
            <div>
              <a href={shopAdminHref} className="pw-shop-btn pw-shop-btn-outline" rel="noopener noreferrer">
                {t.accountOpenShopAdmin}
              </a>
            </div>
          ) : null}
        </div>
        <div className="pw-shop-account-session">
          <PartnerSiteAccountSessionActions siteSlug={siteSlug} locale={locale} />
        </div>
      </div>
    </>
  )
}
