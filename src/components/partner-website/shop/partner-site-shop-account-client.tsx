'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import {
  ClipboardList,
  Clock,
  MapPin,
  Pencil,
  ShoppingBag,
} from 'lucide-react'
import type { WebLocale } from '@/lib/i18n/config'
import { usePartnerSiteGuestSession } from '@/hooks/use-partner-site-guest-session'
import { getPartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'
import {
  getPartnerSiteShopNavPaths,
} from '@/lib/partner-website/shop/partner-site-shop-nav-config'
import { partnerSitePersonalizationApiPath } from '@/lib/partner-website/shop/partner-site-shop-paths'
import { usePartnerSiteCustomDomain } from '@/lib/partner-website/shop/partner-site-custom-domain-context'
import { PartnerSiteShopAuthPanel } from '@/components/partner-website/shop/partner-site-shop-auth-panel'
import type { PartnerSiteVisitorProfile } from '@/lib/partner-website/shop/partner-site-personalization'

type Props = {
  siteSlug: string
  partnerSlug: string
  shopTitle?: string
  locale: WebLocale
}

export function PartnerSiteShopAccountClient({ siteSlug, partnerSlug, shopTitle, locale }: Props) {
  const t = getPartnerSiteShopCopy(locale)
  const customDomain = usePartnerSiteCustomDomain()
  const paths = getPartnerSiteShopNavPaths(siteSlug, customDomain)
  const { ready, authHeaders, captureFromResponse } = usePartnerSiteGuestSession(siteSlug)
  const [profile, setProfile] = useState<PartnerSiteVisitorProfile | null>(null)
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
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
    const json = (await res.json().catch(() => ({}))) as {
      profile?: PartnerSiteVisitorProfile
      requireAuth?: boolean
    }
    const next = json.profile ?? null
    setProfile(next)
    setCustomerName(next?.customer_name ?? '')
    setCustomerPhone(next?.customer_phone ?? '')
    setNeedsAuth(!next?.email)
    return next
  }, [authHeaders, captureFromResponse, siteSlug])

  useEffect(() => {
    if (!ready) return
    setLoading(true)
    void loadProfile().finally(() => setLoading(false))
  }, [loadProfile, ready])

  useEffect(() => {
    if (loading || typeof window === 'undefined') return
    if (window.location.hash !== '#edit-profile') return
    const el = document.getElementById('edit-profile')
    if (el) {
      window.requestAnimationFrame(() => {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
    }
  }, [loading])

  async function saveProfile() {
    if (saving) return
    setSaving(true)
    setStatus('')
    try {
      const res = await fetch(partnerSitePersonalizationApiPath(siteSlug, 'profile'), {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          customer_name: customerName.trim(),
          customer_phone: customerPhone.trim(),
        }),
      })
      captureFromResponse(res)
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        requireAuth?: boolean
        profile?: PartnerSiteVisitorProfile
        error?: string
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
        setCustomerName(json.profile.customer_name ?? '')
        setCustomerPhone(json.profile.customer_phone ?? '')
        setNeedsAuth(false)
      }
      setStatus(t.accountSaved)
    } finally {
      setSaving(false)
    }
  }

  const displayName =
    profile?.customer_name?.trim() ||
    profile?.greeting_name?.trim() ||
    profile?.email?.split('@')[0] ||
    ''

  const quickLinks = [
    { href: paths.cart, label: t.navCart, Icon: ShoppingBag },
    { href: paths.orders, label: t.navOrders, Icon: ClipboardList },
    { href: paths.recentlyViewed, label: t.accountViewedProducts, Icon: Clock },
    { href: paths.addresses, label: t.accountAddressBook, Icon: MapPin },
  ]

  return (
    <div>
      <h1>{t.navAccount}</h1>
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
          <div className="pw-shop-account-summary">
            <p className="pw-shop-account-greeting">
              {t.accountWelcome}
              {displayName ? `, ${displayName}` : ''}
            </p>
            {profile?.email ? (
              <p className="pw-shop-muted">
                {t.accountEmailLabel}: {profile.email}
              </p>
            ) : null}
            {profile?.customer_phone ? (
              <p className="pw-shop-muted">
                {t.checkoutPhone}: {profile.customer_phone}
              </p>
            ) : null}
            {profile?.shipping_address ? (
              <p className="pw-shop-muted">
                {t.checkoutAddress}: {profile.shipping_address}
              </p>
            ) : null}
          </div>

          <section className="pw-shop-account-links" aria-label={t.accountQuickLinks}>
            <h2>{t.accountQuickLinks}</h2>
            <div className="pw-shop-account-links-grid">
              {quickLinks.map(({ href, label, Icon }) => (
                <Link key={href} href={href} className="pw-shop-account-link-card">
                  <Icon className="pw-shop-account-link-icon" aria-hidden="true" strokeWidth={2} />
                  <span>{label}</span>
                </Link>
              ))}
              <Link href={`${paths.account}#edit-profile`} className="pw-shop-account-link-card is-accent">
                <Pencil className="pw-shop-account-link-icon" aria-hidden="true" strokeWidth={2} />
                <span>{t.accountEditProfile}</span>
              </Link>
            </div>
          </section>

          <section id="edit-profile" className="pw-shop-account-edit">
            <h2>{t.accountSectionEditProfile}</h2>
            <div className="pw-shop-form" style={{ marginTop: 16 }}>
              {profile?.email ? (
                <label>
                  {t.accountEmailLabel}
                  <input value={profile.email} readOnly />
                </label>
              ) : null}
              <label>
                {t.checkoutName}
                <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
              </label>
              <label>
                {t.checkoutPhone}
                <input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
              </label>
              <button type="button" className="pw-shop-btn" disabled={saving} onClick={() => void saveProfile()}>
                {saving ? '…' : t.accountSave}
              </button>
              {status ? <p className="pw-shop-muted">{status}</p> : null}
            </div>
          </section>
        </>
      ) : null}
    </div>
  )
}
