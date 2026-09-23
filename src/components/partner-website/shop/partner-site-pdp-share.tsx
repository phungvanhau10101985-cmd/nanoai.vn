'use client'

import { useState } from 'react'
import type { WebLocale } from '@/lib/i18n/config'
import { usePartnerSiteGuestSession } from '@/hooks/use-partner-site-guest-session'
import { getPartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'
import { partnerSiteAffiliateApiPath } from '@/lib/partner-website/shop/partner-site-shop-paths'
import { appendReferralToUrl } from '@/lib/partner-website/shop/partner-site-affiliate'

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
      />
    </svg>
  )
}

function LinkIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
      />
    </svg>
  )
}

async function shareUrlForPage(siteSlug: string, headers: Record<string, string>): Promise<string> {
  const base = window.location.href.split('#')[0]
  try {
    const res = await fetch(partnerSiteAffiliateApiPath(siteSlug), { credentials: 'same-origin', headers })
    const json = (await res.json()) as { me?: { affiliate_status?: string; referral_code?: string } }
    const code = json.me?.affiliate_status === 'approved' ? (json.me.referral_code || '').trim() : ''
    return code ? appendReferralToUrl(base, code) : base
  } catch {
    return base
  }
}

/** Nút chia sẻ PDP giống 188: icon trên ảnh, hoặc Copy link + Chia sẻ cạnh mã SP. */
export function PartnerSitePdpShare({
  siteSlug,
  locale,
  shareTitle,
  variant,
}: {
  siteSlug: string
  locale: WebLocale
  shareTitle: string
  variant: 'icon' | 'actions'
}) {
  const t = getPartnerSiteShopCopy(locale)
  const { authHeaders } = usePartnerSiteGuestSession(siteSlug)
  const [copied, setCopied] = useState(false)

  async function url() {
    return shareUrlForPage(siteSlug, authHeaders())
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(await url())
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }

  async function share() {
    const href = await url()
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: shareTitle, url: href })
        return
      } catch {
        return
      }
    }
    await copy()
  }

  if (variant === 'icon') {
    return (
      <button type="button" className="pw-pdp-share-icon" data-pw-pdp-share="icon" aria-label={t.pdpShare} onClick={() => void share()}>
        <ShareIcon />
      </button>
    )
  }

  return (
    <div className="pw-pdp-share-row" data-pw-pdp-share="actions">
      <button type="button" className="pw-pdp-share-btn" aria-label={t.pdpShareCopy} onClick={() => void copy()}>
        <LinkIcon />
        <span>{copied ? t.pdpShareCopied : t.pdpShareCopy}</span>
      </button>
      <button type="button" className="pw-pdp-share-btn is-share" aria-label={t.pdpShare} onClick={() => void share()}>
        <ShareIcon />
        <span>{t.pdpShare}</span>
      </button>
    </div>
  )
}
