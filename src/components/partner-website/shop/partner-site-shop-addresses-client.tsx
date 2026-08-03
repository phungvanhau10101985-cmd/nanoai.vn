'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import type { WebLocale } from '@/lib/i18n/config'
import { usePartnerSiteGuestSession } from '@/hooks/use-partner-site-guest-session'
import { getPartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'
import { partnerSiteAccountPath, partnerSitePersonalizationApiPath } from '@/lib/partner-website/shop/partner-site-shop-paths'
import { PartnerSiteShopAuthPanel } from '@/components/partner-website/shop/partner-site-shop-auth-panel'
import type { PartnerSiteVisitorProfile } from '@/lib/partner-website/shop/partner-site-personalization'

type Props = {
  siteSlug: string
  partnerSlug: string
  shopTitle?: string
  locale: WebLocale
}

export function PartnerSiteShopAddressesClient({ siteSlug, partnerSlug, shopTitle, locale }: Props) {
  const t = getPartnerSiteShopCopy(locale)
  const { ready, authHeaders, captureFromResponse } = usePartnerSiteGuestSession(siteSlug)
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
    setLoading(true)
    void loadProfile().finally(() => setLoading(false))
  }, [loadProfile, ready])

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
    <div>
      <h1>{t.accountAddressBook}</h1>
      <p className="pw-shop-muted">{t.addressesHint}</p>
      {loading ? <p className="pw-shop-muted">…</p> : null}
      {!loading && needsAuth ? (
        <PartnerSiteShopAuthPanel
          partnerSlug={partnerSlug}
          siteSlug={siteSlug}
          shopTitle={shopTitle}
          locale={locale}
            onAuthed={() => {
              setNeedsAuth(false)
              void loadProfile()
          }}
        />
      ) : null}
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
            <p className="pw-shop-muted">{t.addressesEmptyHint}</p>
          )}
          <div className="pw-shop-form" style={{ marginTop: 16 }}>
            {profile?.email ? (
              <p className="pw-shop-muted">
                {t.accountEmailLabel}: {profile.email}
              </p>
            ) : null}
            <label>
              {t.checkoutAddress}
              <textarea rows={4} value={shippingAddress} onChange={(e) => setShippingAddress(e.target.value)} />
            </label>
            <button type="button" className="pw-shop-btn" disabled={saving} onClick={() => void saveAddress()}>
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
