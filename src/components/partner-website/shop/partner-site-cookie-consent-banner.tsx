'use client'

import { useEffect, useState } from 'react'
import type { WebLocale } from '@/lib/i18n/config'
import { getPartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'
import { getPartnerSiteConsent, setPartnerSiteConsent } from '@/lib/partner-website/shop/partner-site-consent'

/**
 * S0.9 — banner cookie/consent tối thiểu cho trang shop công khai. Ẩn ngay khi khách đã quyết định
 * (chấp nhận/từ chối), lưu theo từng shop (`siteSlug`). Việc chặn tải script tracking cho tới khi
 * có consent nằm ở `PartnerSiteShopTrackingBootstrap`, không phải component này.
 */
export function PartnerSiteCookieConsentBanner({ siteSlug, locale }: { siteSlug: string; locale: WebLocale }) {
  const t = getPartnerSiteShopCopy(locale)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    setVisible(getPartnerSiteConsent(siteSlug) === null)
  }, [siteSlug])

  if (!visible) return null

  function decide(choice: 'accepted' | 'rejected') {
    setPartnerSiteConsent(siteSlug, choice)
    setVisible(false)
  }

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9998,
        background: '#111827',
        color: '#f9fafb',
        padding: '14px 16px',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
      }}
    >
      <p style={{ margin: 0, fontSize: 13, maxWidth: 640 }}>{t.consentMessage}</p>
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        <button
          type="button"
          onClick={() => decide('rejected')}
          style={{
            padding: '8px 16px',
            fontSize: 13,
            borderRadius: 8,
            border: '1px solid #4b5563',
            background: 'transparent',
            color: '#f9fafb',
            cursor: 'pointer',
          }}
        >
          {t.consentReject}
        </button>
        <button
          type="button"
          onClick={() => decide('accepted')}
          style={{
            padding: '8px 16px',
            fontSize: 13,
            borderRadius: 8,
            border: 'none',
            background: 'var(--pw-accent, #ea580c)',
            color: '#fff',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {t.consentAccept}
        </button>
      </div>
    </div>
  )
}
