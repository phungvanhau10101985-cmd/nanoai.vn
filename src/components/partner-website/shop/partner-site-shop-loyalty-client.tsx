'use client'

import { useLayoutEffect, useState } from 'react'
import type { WebLocale } from '@/lib/i18n/config'
import { usePartnerSiteGuestSession } from '@/hooks/use-partner-site-guest-session'
import { getPartnerSiteShopCopy, type PartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'
import { usePartnerSiteCustomDomain } from '@/lib/partner-website/shop/partner-site-custom-domain-context'
import {
  partnerSiteLoyaltyApiPath,
  partnerSiteProductsPath,
} from '@/lib/partner-website/shop/partner-site-shop-paths'
import {
  fillLoyaltyCopy,
  formatLoyaltyMoney,
  formatLoyaltyPercent,
  loyaltyRankHint,
  loyaltyWindowLabel,
  type PartnerSiteLoyaltyStatusView,
  type PartnerSiteLoyaltyTierView,
} from '@/lib/partner-website/shop/partner-site-loyalty'
import { PW_EL } from '@/lib/partner-website/visual-editor/pw-ui-contract'

type Props = {
  siteSlug: string
  locale: WebLocale
  displayName: string
  initialLoyalty?: PartnerSiteLoyaltyStatusView | null
}

export function PartnerSiteShopLoyaltyClient({
  siteSlug,
  locale,
  displayName,
  initialLoyalty = null,
}: Props) {
  const t = getPartnerSiteShopCopy(locale)
  const customDomain = usePartnerSiteCustomDomain()
  const { ready, authHeaders, captureFromResponse } = usePartnerSiteGuestSession(siteSlug)
  const [loyalty, setLoyalty] = useState<PartnerSiteLoyaltyStatusView | null>(initialLoyalty)
  const [loading, setLoading] = useState(!initialLoyalty)
  const [failed, setFailed] = useState(false)
  const shopNowHref = partnerSiteProductsPath(siteSlug, { customDomain })

  useLayoutEffect(() => {
    if (!ready) return
    let cancelled = false
    if (!initialLoyalty) setLoading(true)
    setFailed(false)
    void fetch(partnerSiteLoyaltyApiPath(siteSlug), {
      credentials: 'same-origin',
      headers: authHeaders(),
    })
      .then((res) => {
        captureFromResponse(res)
        return res.json()
      })
      .then((json: { loyalty?: PartnerSiteLoyaltyStatusView }) => {
        if (cancelled) return
        if (json.loyalty) setLoyalty(json.loyalty)
        else if (!initialLoyalty) setFailed(true)
      })
      .catch(() => {
        if (!cancelled && !initialLoyalty) setFailed(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [authHeaders, captureFromResponse, initialLoyalty, ready, siteSlug])

  if (loading && !loyalty) {
    return (
      <section className="pw-shop-loyalty" aria-busy="true">
        <div className="pw-shop-loyalty-hero pw-shop-loyalty-skel">
          <div className="pw-shop-loyalty-hero-badge" />
          <div className="pw-shop-loyalty-hero-copy">
            <p className="pw-shop-loyalty-kicker">{t.loyaltyTitle}</p>
            <h2 data-pw-el={PW_EL.heading}>{t.loyaltyLoading}</h2>
          </div>
        </div>
      </section>
    )
  }

  if (failed || !loyalty) {
    return (
      <section className="pw-shop-loyalty">
        <div className="pw-shop-loyalty-pad">
          <h2 data-pw-el={PW_EL.heading}>{t.loyaltyTitle}</h2>
          <p className="pw-shop-muted">{t.loyaltyLoadFailed}</p>
        </div>
      </section>
    )
  }

  const name = displayName.trim() || t.navAccount
  const current = loyalty.current
  const next = loyalty.next
  const heroCode = current?.code || 'L1'
  const metal = current ? loyaltyRankHint(t, current.rank) : t.loyaltyNewMember
  const spendWindow = loyaltyWindowLabel(t, loyalty.spendWindowDays)
  const showNameHint = Boolean(metal && current && metal !== current.name)

  return (
    <section className="pw-shop-loyalty">
      <div className="pw-shop-loyalty-hero">
        <div className="pw-shop-loyalty-hero-badge" data-rank={current?.rank ?? 0} aria-hidden="true">
          <span>{heroCode}</span>
        </div>
        <div className="pw-shop-loyalty-hero-copy">
          <p className="pw-shop-loyalty-kicker">{t.loyaltyTitle}</p>
          <h2 data-pw-el={PW_EL.heading}>{fillLoyaltyCopy(t.loyaltyGreeting, { name })}</h2>
          <p className="pw-shop-loyalty-hero-tier">
            {current ? (
              <>
                <strong>{current.name}</strong>
                {showNameHint ? <span> · {metal}</span> : null}
              </>
            ) : (
              t.loyaltyNewMember
            )}
          </p>
          {loyalty.enabled && current && current.discountPercent > 0 ? (
            <p className="pw-shop-loyalty-hero-perk">
              {fillLoyaltyCopy(t.loyaltyDiscountNow, { percent: formatLoyaltyPercent(current.discountPercent) })}
              <span> · {t.loyaltyAutoApply}</span>
            </p>
          ) : loyalty.enabled ? (
            <p className="pw-shop-loyalty-hero-perk is-muted">{t.loyaltyAutoApply}</p>
          ) : null}
        </div>
      </div>

      {!loyalty.enabled ? (
        <div className="pw-shop-loyalty-notice" role="status">
          <strong>{t.loyaltyDisabledTitle}</strong>
          <p>{t.loyaltyDisabledHint}</p>
        </div>
      ) : (
        <div className="pw-shop-loyalty-stats">
          <div>
            <p className="pw-shop-loyalty-stat-label">{t.loyaltySpendLabel}</p>
            <p className="pw-shop-loyalty-stat-value">{formatLoyaltyMoney(loyalty.totalSpent)}</p>
            <p className="pw-shop-muted">{spendWindow}</p>
          </div>
          <div className="pw-shop-loyalty-progress-card">
            {next ? (
              <>
                <p className="pw-shop-loyalty-remain">
                  {fillLoyaltyCopy(t.loyaltyRemaining, { amount: formatLoyaltyMoney(loyalty.amountToNextTier) })}
                </p>
                <p className="pw-shop-loyalty-progress-head">
                  {fillLoyaltyCopy(t.loyaltyProgressTo, { name: next.name })}
                  <span>{loyalty.progressPercent}%</span>
                </p>
                <div
                  className="pw-shop-loyalty-bar"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(loyalty.progressPercent)}
                >
                  <span style={{ width: `${loyalty.progressPercent}%` }} />
                </div>
                <p className="pw-shop-muted">
                  {fillLoyaltyCopy(t.loyaltyNeedMore, {
                    amount: formatLoyaltyMoney(loyalty.amountToNextTier),
                    percent: formatLoyaltyPercent(next.discountPercent),
                  })}
                </p>
                <a href={shopNowHref} className="pw-shop-loyalty-cta">
                  {t.loyaltyShopNow}
                </a>
              </>
            ) : (
              <p className="pw-shop-loyalty-max">{t.loyaltyMaxTier}</p>
            )}
          </div>
        </div>
      )}

      {loyalty.tiers.length === 0 ? (
        <p className="pw-shop-muted pw-shop-loyalty-pad" data-pw-el={PW_EL.empty}>
          {t.loyaltyEmptyTiers}
        </p>
      ) : (
        <div className="pw-shop-loyalty-table-wrap">
          <div className="pw-shop-loyalty-table-head">
            <h3>{t.loyaltyBenefitsTitle}</h3>
            <a href={shopNowHref} className="pw-shop-loyalty-shop">
              {t.loyaltyShopNow} →
            </a>
          </div>
          <ol className="pw-shop-loyalty-tiers" aria-label={t.loyaltyBenefitsTitle}>
            {loyalty.tiers.map((tier) => (
              <LoyaltyTierRow key={tier.code} t={t} tier={tier} next={next} remain={loyalty.amountToNextTier} />
            ))}
          </ol>
        </div>
      )}

      <div className="pw-shop-loyalty-how">
        <h3>{t.loyaltyHowTitle}</h3>
        <ul>
          <li>{fillLoyaltyCopy(t.loyaltyHowSpend, { window: spendWindow })}</li>
          <li>{t.loyaltyHowUpdate}</li>
          <li>{t.loyaltyHowAuto}</li>
        </ul>
      </div>
    </section>
  )
}

function LoyaltyTierRow({
  t,
  tier,
  next,
  remain,
}: {
  t: PartnerSiteShopCopy
  tier: PartnerSiteLoyaltyTierView
  next: PartnerSiteLoyaltyTierView | null
  remain: number
}) {
  const hint = loyaltyRankHint(t, tier.rank)
  const isNext = next?.code === tier.code
  const statusLabel =
    tier.status === 'current'
      ? t.loyaltyStatusCurrent
      : tier.status === 'reached'
        ? t.loyaltyStatusReached
        : isNext
          ? fillLoyaltyCopy(t.loyaltyRemaining, { amount: formatLoyaltyMoney(remain) })
          : t.loyaltyStatusLocked
  return (
    <li className={`pw-shop-loyalty-tier is-${tier.status}${isNext ? ' is-next' : ''}`} data-pw-el={PW_EL.card}>
      <span className="pw-shop-loyalty-medal" data-rank={tier.rank}>
        {tier.code}
      </span>
      <div className="pw-shop-loyalty-tier-copy">
        <strong>{tier.name}</strong>
        {hint && hint !== tier.name ? <p className="pw-shop-muted">{hint}</p> : null}
        <p className="pw-shop-loyalty-tier-spend">
          {tier.minSpend > 0
            ? fillLoyaltyCopy(t.loyaltyMinSpendFrom, { amount: formatLoyaltyMoney(tier.minSpend) })
            : t.loyaltyMinSpendAny}
        </p>
      </div>
      <div className="pw-shop-loyalty-tier-meta">
        <span className="pw-shop-loyalty-chip">
          {fillLoyaltyCopy(t.loyaltyDiscountBadge, { percent: formatLoyaltyPercent(tier.discountPercent) })}
        </span>
        <span className={`pw-shop-loyalty-state is-${tier.status}${isNext ? ' is-next' : ''}`}>{statusLabel}</span>
      </div>
    </li>
  )
}
