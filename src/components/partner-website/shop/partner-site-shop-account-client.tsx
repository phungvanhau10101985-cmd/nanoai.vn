'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  ClipboardList,
  Clock,
  Heart,
  MapPin,
  MessageCircle,
  Pencil,
  ShoppingBag,
  UserRound,
} from 'lucide-react'
import type { WebLocale } from '@/lib/i18n/config'
import { usePartnerSiteGuestSession } from '@/hooks/use-partner-site-guest-session'
import { getPartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'
import {
  getPartnerSiteCategoryNavLabels,
} from '@/lib/partner-website/shop/partner-site-shop-nav-config'
import { partnerSitePersonalizationApiPath } from '@/lib/partner-website/shop/partner-site-shop-paths'
import { PartnerSiteShopAuthPanel } from '@/components/partner-website/shop/partner-site-shop-auth-panel'
import { PartnerSiteShopCartClient } from '@/components/partner-website/shop/partner-site-shop-cart-client'
import { PartnerSiteShopOrdersClient } from '@/components/partner-website/shop/partner-site-shop-orders-client'
import { PartnerSiteShopSavedProductsClient } from '@/components/partner-website/shop/partner-site-shop-saved-products-client'
import { PartnerSiteShopAddressesClient } from '@/components/partner-website/shop/partner-site-shop-addresses-client'
import { usePartnerSiteChatWidget } from '@/components/partner-website/shop/partner-site-chat-widget-provider'
import type { PartnerSiteVisitorProfile } from '@/lib/partner-website/shop/partner-site-personalization'

type AccountTab = 'overview' | 'cart' | 'orders' | 'wishlist' | 'recently-viewed' | 'addresses' | 'edit-profile' | 'contact'

type Props = {
  siteSlug: string
  partnerSlug: string
  shopTitle?: string
  locale: WebLocale
}

export function PartnerSiteShopAccountClient({ siteSlug, partnerSlug, shopTitle, locale }: Props) {
  const t = getPartnerSiteShopCopy(locale)
  const n = getPartnerSiteCategoryNavLabels(locale)
  const { ready, authHeaders, captureFromResponse } = usePartnerSiteGuestSession(siteSlug)
  const [profile, setProfile] = useState<PartnerSiteVisitorProfile | null>(null)
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [needsAuth, setNeedsAuth] = useState(false)
  const [status, setStatus] = useState('')
  const [activeTab, setActiveTab] = useState<AccountTab>('overview')
  const { openChat } = usePartnerSiteChatWidget()

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
    const hash = window.location.hash
    if (!hash) return
    const tabFromHash: Partial<Record<string, AccountTab>> = {
      '#edit-profile': 'edit-profile',
      '#cart': 'cart',
      '#orders': 'orders',
      '#wishlist': 'wishlist',
      '#recently-viewed': 'recently-viewed',
      '#addresses': 'addresses',
      '#contact': 'contact',
    }
    const tab = tabFromHash[hash]
    if (tab) setActiveTab(tab)
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

  const tabs: { id: AccountTab; label: string; Icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean; strokeWidth?: number }> }[] = [
    { id: 'overview', label: t.navAccount, Icon: UserRound },
    { id: 'cart', label: t.navCart, Icon: ShoppingBag },
    { id: 'orders', label: t.navOrders, Icon: ClipboardList },
    { id: 'wishlist', label: t.navFavorites, Icon: Heart },
    { id: 'recently-viewed', label: t.accountViewedProducts, Icon: Clock },
    { id: 'addresses', label: t.accountAddressBook, Icon: MapPin },
    { id: 'edit-profile', label: t.accountEditProfile, Icon: Pencil },
    { id: 'contact', label: n.contact, Icon: MessageCircle },
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
        <div className="pw-shop-account-layout">
          <aside className="pw-shop-account-sidebar">
            <section className="pw-shop-account-links" aria-label={t.accountQuickLinks}>
              <h2>{t.accountQuickLinks}</h2>
              <div className="pw-shop-account-links-grid">
                {tabs.map(({ id, label, Icon }) => (
                  <button
                    key={id}
                    type="button"
                    className={`pw-shop-account-link-card${activeTab === id ? ' is-active' : ''}`}
                    onClick={() => setActiveTab(id)}
                  >
                    <Icon className="pw-shop-account-link-icon" aria-hidden="true" strokeWidth={2} />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </section>
          </aside>

          <div className="pw-shop-account-content">
            {activeTab === 'overview' ? (
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
            ) : null}

            {activeTab === 'cart' ? (
              <PartnerSiteShopCartClient
                siteSlug={siteSlug}
                partnerSlug={partnerSlug}
                shopTitle={shopTitle}
                locale={locale}
                chatPath=""
              />
            ) : null}

            {activeTab === 'orders' ? (
              <PartnerSiteShopOrdersClient
                siteSlug={siteSlug}
                partnerSlug={partnerSlug}
                locale={locale}
                chatPath=""
              />
            ) : null}

            {activeTab === 'wishlist' ? (
              <PartnerSiteShopSavedProductsClient
                siteSlug={siteSlug}
                locale={locale}
                mode="favorites"
              />
            ) : null}

            {activeTab === 'recently-viewed' ? (
              <PartnerSiteShopSavedProductsClient
                siteSlug={siteSlug}
                locale={locale}
                mode="recently-viewed"
              />
            ) : null}

            {activeTab === 'addresses' ? (
              <PartnerSiteShopAddressesClient
                siteSlug={siteSlug}
                partnerSlug={partnerSlug}
                shopTitle={shopTitle}
                locale={locale}
              />
            ) : null}

            {activeTab === 'edit-profile' ? (
              <section className="pw-shop-account-edit">
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
            ) : null}

            {activeTab === 'contact' ? (
              <section className="pw-shop-account-edit">
                <h2>{t.chatOpenLabel}</h2>
                <p className="pw-shop-muted" style={{ marginBottom: 16 }}>
                  {t.chatOpenLabel}
                </p>
                <button type="button" className="pw-shop-btn" onClick={openChat}>
                  <MessageCircle className="pw-shop-account-link-icon" aria-hidden="true" strokeWidth={2} style={{ marginRight: 6 }} />
                  {t.chatOpenLabel}
                </button>
              </section>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
