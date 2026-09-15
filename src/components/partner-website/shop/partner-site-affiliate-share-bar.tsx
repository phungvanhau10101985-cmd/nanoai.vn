'use client'

import { useEffect, useState } from 'react'
import type { WebLocale } from '@/lib/i18n/config'
import { usePartnerSiteGuestSession } from '@/hooks/use-partner-site-guest-session'
import { getPartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'
import { partnerSiteAffiliateApiPath } from '@/lib/partner-website/shop/partner-site-shop-paths'
import {
  appendReferralToUrl,
  partnerAffiliateShareHrefs,
  type PartnerSiteAffiliateMeView,
} from '@/lib/partner-website/shop/partner-site-affiliate'

type Props = {
  siteSlug: string
  locale: WebLocale
  shareTitle?: string
}

export function PartnerSiteAffiliateShareBar({ siteSlug, locale, shareTitle }: Props) {
  const t = getPartnerSiteShopCopy(locale)
  const { ready, isAuthenticated, authHeaders, captureFromResponse } = usePartnerSiteGuestSession(siteSlug)
  const [me, setMe] = useState<PartnerSiteAffiliateMeView | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!ready || !isAuthenticated) return
    let cancelled = false
    const load = () => {
      void fetch(partnerSiteAffiliateApiPath(siteSlug), {
        credentials: 'same-origin',
        headers: authHeaders(),
      })
        .then((res) => {
          captureFromResponse(res)
          return res.json() as Promise<{ me?: PartnerSiteAffiliateMeView }>
        })
        .then((json) => {
          if (!cancelled) setMe(json.me ?? null)
        })
        .catch(() => {
          if (!cancelled) setMe(null)
        })
    }
    load()
    const onChange = (event: Event) => {
      const detail = (event as CustomEvent<{ siteSlug?: string }>).detail
      if (detail?.siteSlug && detail.siteSlug !== siteSlug.trim().toLowerCase()) return
      load()
    }
    window.addEventListener('pw-partner-site-guest-session-change', onChange)
    return () => {
      cancelled = true
      window.removeEventListener('pw-partner-site-guest-session-change', onChange)
    }
  }, [authHeaders, captureFromResponse, isAuthenticated, ready, siteSlug])

  if (!me || me.affiliate_status !== 'approved' || !me.referral_code) return null
  const pageUrl =
    typeof window === 'undefined'
      ? me.referral_link
      : appendReferralToUrl(window.location.href.split('#')[0] || me.referral_link, me.referral_code)
  const shares = partnerAffiliateShareHrefs(pageUrl)

  return (
    <div className="pw-shop-affiliate-share-bar" data-pw-affiliate-share="1">
      <span>{t.affiliateShareThisPage}</span>
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard
            ?.writeText(pageUrl)
            .then(() => {
              setCopied(true)
              window.setTimeout(() => setCopied(false), 1600)
            })
            .catch(() => {})
        }}
      >
        {copied ? t.affiliateCopied : t.affiliateCopy}
      </button>
      <button
        type="button"
        onClick={() => {
          if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
            void navigator.share({ title: shareTitle || t.affiliateShare, url: pageUrl }).catch(() => {})
            return
          }
          void navigator.clipboard
            ?.writeText(pageUrl)
            .then(() => {
              setCopied(true)
              window.setTimeout(() => setCopied(false), 1600)
            })
            .catch(() => {})
        }}
      >
        {t.affiliateShare}
      </button>
      <a href={shares.facebook} target="_blank" rel="noreferrer" title={shareTitle || t.affiliateShare}>
        Facebook
      </a>
      <a href={shares.zalo} target="_blank" rel="noreferrer" title={shareTitle || t.affiliateShare}>
        Zalo
      </a>
      <a href={shares.telegram} target="_blank" rel="noreferrer" title={shareTitle || t.affiliateShare}>
        Telegram
      </a>
    </div>
  )
}
