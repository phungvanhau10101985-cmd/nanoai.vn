'use client'

import { useEffect, useLayoutEffect, useMemo, useState } from 'react'
import type { WebLocale } from '@/lib/i18n/config'
import { PartnerSiteAccountSessionActions } from '@/components/partner-website/shop/partner-site-account-session-actions'
import { usePartnerSiteGuestSession } from '@/hooks/use-partner-site-guest-session'
import { usePartnerSiteCustomDomain } from '@/lib/partner-website/shop/partner-site-custom-domain-context'
import {
  countPartnerSiteOrdersByStatusFilter,
  PARTNER_SITE_ACCOUNT_HUB_ORDER_FILTER_KEYS,
  type PartnerSiteOrderStatusFilterKey,
} from '@/lib/partner-website/shop/partner-site-order-status-filters'
import { getPartnerSiteShopCopy, type PartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'
import {
  getPartnerSiteAccountMenuItems,
  isPartnerSiteAccountHubRow,
  partnerSiteAccountMenuEmoji,
} from '@/lib/partner-website/shop/partner-site-shop-nav-config'
import {
  partnerSiteAccountEditPath,
  partnerSiteAccountTabPath,
  partnerSiteAddressesPath,
  partnerSiteLoyaltyApiPath,
  partnerSiteOrdersPath,
} from '@/lib/partner-website/shop/partner-site-shop-paths'
import { PW_EL } from '@/lib/partner-website/visual-editor/pw-ui-contract'
import type { PartnerSiteVisitorProfile } from '@/lib/partner-website/shop/partner-site-personalization'
import {
  readPartnerSiteAccountBrowserCache,
  writePartnerSiteAccountBrowserCache,
} from '@/lib/partner-website/shop/partner-site-account-browser-cache'
import {
  fillLoyaltyCopy,
  formatLoyaltyMoney,
  formatLoyaltyPercent,
  loyaltyRankHint,
  type PartnerSiteLoyaltyStatusView,
} from '@/lib/partner-website/shop/partner-site-loyalty'

type WalletVoucher = { code?: string }

type OrderLite = {
  id?: string
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
  initialLoyalty?: PartnerSiteLoyaltyStatusView | null
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
  initialLoyalty = null,
}: Props) {
  const t = getPartnerSiteShopCopy(locale)
  const customDomain = usePartnerSiteCustomDomain()
  const { ready, isAuthenticated, authHeaders, captureFromResponse } =
    usePartnerSiteGuestSession(siteSlug)
  const [orders, setOrders] = useState<OrderLite[]>([])
  const [walletCount, setWalletCount] = useState(0)
  const [loyalty, setLoyalty] = useState<PartnerSiteLoyaltyStatusView | null>(initialLoyalty)

  useLayoutEffect(() => {
    const cached = readPartnerSiteAccountBrowserCache(siteSlug)
    if (!cached) return
    if (cached.orders.length) setOrders(cached.orders)
    if (cached.wallet.length) setWalletCount(cached.wallet.length)
  }, [siteSlug])

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
      .then((json: { orders?: OrderLite[] }) => {
        const next = Array.isArray(json.orders) ? json.orders : []
        setOrders(next)
        writePartnerSiteAccountBrowserCache(siteSlug, { orders: next })
      })
      .catch(() => setOrders((prev) => prev))
    void fetch(`/api/site/${encodeURIComponent(siteSlug)}/promotions/wallet`, {
      credentials: 'same-origin',
      headers: authHeaders(),
    })
      .then((res) => {
        captureFromResponse(res)
        return res.json()
      })
      .then((json: { vouchers?: WalletVoucher[] }) => {
        const vouchers = Array.isArray(json.vouchers) ? json.vouchers : []
        setWalletCount(vouchers.length)
        writePartnerSiteAccountBrowserCache(siteSlug, { wallet: vouchers })
      })
      .catch(() => setWalletCount((n) => n))
    void fetch(partnerSiteLoyaltyApiPath(siteSlug), {
      credentials: 'same-origin',
      headers: authHeaders(),
    })
      .then((res) => {
        captureFromResponse(res)
        return res.json()
      })
      .then((json: { loyalty?: PartnerSiteLoyaltyStatusView }) => {
        if (json.loyalty) setLoyalty(json.loyalty)
      })
      .catch(() => setLoyalty((prev) => prev))
  }, [authHeaders, captureFromResponse, isAuthenticated, partnerSlug, ready, siteSlug])

  const counts = useMemo(() => countPartnerSiteOrdersByStatusFilter(orders), [orders])
  const hubItems = getPartnerSiteAccountMenuItems({ siteSlug, locale, customDomain }).filter(
    isPartnerSiteAccountHubRow
  )
  const editHref = partnerSiteAccountEditPath(siteSlug, { customDomain })
  const ordersHref = partnerSiteOrdersPath(siteSlug, { customDomain })
  const loyaltyHref = partnerSiteAccountTabPath(siteSlug, 'loyalty', { customDomain })
  const phone = profile?.customer_phone?.trim() || ''
  const email = profile?.email?.trim() || ''
  const name = displayName || t.navAccount
  const avatarUrl = profile?.avatar_url?.trim() || ''
  const initials = accountInitials(name)

  return (
    <>
      <div className="pw-shop-account-hub-mobile">
        <div className="pw-shop-account-hub-head">
          <div className="pw-shop-account-hub-identity">
            <AccountAvatar src={avatarUrl} initials={initials} name={name} />
            <div className="pw-shop-account-hub-copy">
              <h1 className="pw-shop-account-hub-name" data-pw-el={PW_EL.heading}>
                {name}
              </h1>
              {phone ? <p className="pw-shop-account-hub-phone">{phone}</p> : null}
            </div>
          </div>
          <a href={editHref} className="pw-shop-account-hub-edit">
            {t.accountEditPersonal}
          </a>
        </div>
        <LoyaltyHubCard t={t} loyalty={loyalty} href={loyaltyHref} />

        <div className="pw-shop-account-hub-orders">
          <p className="pw-shop-account-hub-orders-kicker">{t.navOrders}</p>
          <div className="pw-shop-account-hub-order-row" role="navigation" aria-label={t.ordersFilterAriaLabel}>
            {PARTNER_SITE_ACCOUNT_HUB_ORDER_FILTER_KEYS.map((key) => {
              const href = key === 'all' ? ordersHref : `${ordersHref}?tab=${encodeURIComponent(key)}`
              return (
                <a key={key} href={href} className="pw-shop-account-hub-order-chip">
                  <span>{filterLabel(key, t)}</span>
                  <span className="pw-shop-account-hub-order-count">{counts[key]}</span>
                </a>
              )
            })}
          </div>
        </div>

        <div className="pw-shop-account-hub-list">
          {hubItems.flatMap((item) => {
            const row = (
              <a key={item.id} href={item.href} className="pw-shop-account-hub-row" data-pw-el={PW_EL.menuItem}>
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
              </a>
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
          <div className="pw-shop-account-hub-identity">
            <AccountAvatar src={avatarUrl} initials={initials} name={name} />
            <h2 data-pw-el={PW_EL.heading}>{t.accountInfoTitle}</h2>
          </div>
          <a href={editHref} className="pw-shop-btn">
            {t.accountEditProfile}
          </a>
        </div>
        <LoyaltyHubCard t={t} loyalty={loyalty} href={loyaltyHref} />
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
          <a href={partnerSiteAddressesPath(siteSlug, { customDomain })} className="pw-shop-account-addresses-link">
            {t.accountManageAddresses}
          </a>
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

function accountInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0] ?? ''}${parts[parts.length - 1]?.[0] ?? ''}`.toUpperCase()
}

function AccountAvatar({ src, initials, name }: { src: string; initials: string; name: string }) {
  return (
    <span className="pw-shop-account-avatar" title={name} aria-hidden={!src}>
      {src ? <img src={src} alt="" /> : initials}
    </span>
  )
}

function LoyaltyHubCard({
  t,
  loyalty,
  href,
}: {
  t: PartnerSiteShopCopy
  loyalty: PartnerSiteLoyaltyStatusView | null
  href: string
}) {
  if (!loyalty?.enabled) return null
  const current = loyalty.current
  const metal = current ? loyaltyRankHint(t, current.rank) : t.loyaltyNewMember
  const title = current?.name || t.loyaltyNewMember
  const subtitle = loyalty.next
    ? fillLoyaltyCopy(t.loyaltyRemaining, { amount: formatLoyaltyMoney(loyalty.amountToNextTier) })
    : current && current.discountPercent > 0
      ? fillLoyaltyCopy(t.loyaltyDiscountNow, { percent: formatLoyaltyPercent(current.discountPercent) })
      : metal
  return (
    <a href={href} className="pw-shop-loyalty-hub">
      <span className="pw-shop-loyalty-medal" data-rank={current?.rank ?? 0}>
        {current?.code || 'L1'}
      </span>
      <span className="pw-shop-loyalty-hub-copy">
        <strong>
          {t.loyaltyTitle}: {title}
        </strong>
        <span>{subtitle}</span>
      </span>
      <span className="pw-shop-loyalty-hub-go">{t.loyaltyHubCta} ›</span>
    </a>
  )
}
