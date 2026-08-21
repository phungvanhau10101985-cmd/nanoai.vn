'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import type { WebLocale } from '@/lib/i18n/config'
import { usePartnerSiteGuestSession } from '@/hooks/use-partner-site-guest-session'
import { getPartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'
import { partnerSiteAccountPath, partnerSitePersonalizationApiPath } from '@/lib/partner-website/shop/partner-site-shop-paths'
import {
  buildPartnerShopLoginHref,
  getPartnerShopBrowserReturnLocation,
} from '@/lib/partner-website/shop/partner-site-shop-auth-redirect'
import { usePartnerSiteCustomDomain } from '@/lib/partner-website/shop/partner-site-custom-domain-context'
import type { PartnerSiteVisitorProfile } from '@/lib/partner-website/shop/partner-site-personalization'
import { PW_EL, PW_REGION } from '@/lib/partner-website/visual-editor/pw-ui-contract'

type Props = {
  siteSlug: string
  partnerSlug: string
  shopTitle?: string
  locale: WebLocale
}

export function PartnerSiteShopAddressesClient({ siteSlug, locale }: Props) {
  const t = getPartnerSiteShopCopy(locale)
  const customDomain = usePartnerSiteCustomDomain()
  const { ready, isAuthenticated, authHeaders, captureFromResponse } = usePartnerSiteGuestSession(siteSlug)
  const [profile, setProfile] = useState<PartnerSiteVisitorProfile | null>(null)
  const [shippingAddress, setShippingAddress] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [needsAuth, setNeedsAuth] = useState(false)
  const [status, setStatus] = useState('')

  const loadProfile = useCallback(async () => {
    const res = await fetch(partnerSitePersonalizationApiPath(siteSlug, 'profile'), {
      credentials: 'same-origin',
      headers: authHeaders(),
    })
    captureFromResponse(res)
    const json = (await res.json().catch(() => ({}))) as { profile?: PartnerSiteVisitorProfile }
    const next = json.profile ?? null
    setProfile(next)
    setShippingAddress(next?.shipping_address ?? '')
    setNeedsAuth(!next?.email)
    return next
  }, [authHeaders, captureFromResponse, siteSlug])

  useEffect(() => {
    if (!ready) return
    if (!isAuthenticated) {
      window.location.replace(
        buildPartnerShopLoginHref(siteSlug, getPartnerShopBrowserReturnLocation(siteSlug, { customDomain }), {
          customDomain,
        })
      )
      return
    }
    setLoading(true)
    void loadProfile().finally(() => setLoading(false))
  }, [customDomain, isAuthenticated, loadProfile, ready, siteSlug])

  useEffect(() => {
    if (!ready || loading || !needsAuth || !isAuthenticated) return
    window.location.replace(
      buildPartnerShopLoginHref(siteSlug, getPartnerShopBrowserReturnLocation(siteSlug, { customDomain }), {
        customDomain,
      })
    )
  }, [customDomain, isAuthenticated, loading, needsAuth, ready, siteSlug])

  async function saveAddress() {
    if (saving) return
    if (!shippingAddress.trim()) {
      setStatus(t.addressesEmptyHint)
      return
    }
    setSaving(true)
    setStatus('')
    try {
      const res = await fetch(partnerSitePersonalizationApiPath(siteSlug, 'profile'), {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          shipping_address: shippingAddress.trim(),
        }),
      })
      captureFromResponse(res)
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        requireAuth?: boolean
        profile?: PartnerSiteVisitorProfile
      }
      if (!res.ok || !json.ok) {
        if (json.requireAuth) {
          setNeedsAuth(true)
          setStatus(t.checkoutAuthRequired)
        } else {
          setStatus(t.accountSaveFailed)
        }
        return
      }
      if (json.profile) {
        setProfile(json.profile)
        setShippingAddress(json.profile.shipping_address ?? '')
        setNeedsAuth(false)
      }
      setStatus(t.accountSaved)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div data-pw-region={PW_REGION.accountMain}>
      <h1 data-pw-el={PW_EL.heading}>{t.accountAddressBook}</h1>
      <p className="pw-shop-muted" data-pw-el={PW_EL.body}>{t.addressesHint}</p>
      {loading ? <p className="pw-shop-muted">…</p> : null}
      {!loading && needsAuth ? <p className="pw-shop-muted">…</p> : null}
      {!loading && !needsAuth ? (
        <>
          {profile?.shipping_address?.trim() ? (
            <div className="pw-shop-address-card">
              <p className="pw-shop-address-card-label">{t.checkoutAddress}</p>
              <p>{profile.shipping_address}</p>
              {profile.customer_name ? (
                <p className="pw-shop-muted">
                  {t.checkoutName}: {profile.customer_name}
                </p>
              ) : null}
              {profile.customer_phone ? (
                <p className="pw-shop-muted">
                  {t.checkoutPhone}: {profile.customer_phone}
                </p>
              ) : null}
            </div>
          ) : (
            <p className="pw-shop-muted" data-pw-el={PW_EL.empty}>{t.addressesEmptyHint}</p>
          )}
          <div className="pw-shop-form" data-pw-region={PW_REGION.form} style={{ marginTop: 16 }}>
            {profile?.email ? (
              <p className="pw-shop-muted">
                {t.accountEmailLabel}: {profile.email}
              </p>
            ) : null}
            <label data-pw-el={PW_EL.label}>
              {t.checkoutAddress}
              <textarea rows={4} value={shippingAddress} onChange={(e) => setShippingAddress(e.target.value)} data-pw-el={PW_EL.field} />
            </label>
            <button type="button" className="pw-shop-btn" disabled={saving} onClick={() => void saveAddress()} data-pw-el={PW_EL.submit}>
              {saving ? '…' : t.accountSave}
            </button>
            {status ? <p className="pw-shop-muted">{status}</p> : null}
            <p style={{ marginTop: 16 }}>
              <Link href={partnerSiteAccountPath(siteSlug)} className="pw-shop-btn pw-shop-btn-outline">
                {t.navAccount}
              </Link>
            </p>
          </div>
        </>
      ) : null}
    </div>
  )
}
