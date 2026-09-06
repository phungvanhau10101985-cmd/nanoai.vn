'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, Copy, Download, MessageCircle } from 'lucide-react'
import type { WebLocale } from '@/lib/i18n/config'
import { usePartnerSiteGuestSession } from '@/hooks/use-partner-site-guest-session'
import { getPartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'
import { shouldRenderPartnerSiteAccountShell } from '@/lib/partner-website/shop/partner-site-account-nav'
import { shouldPartnerSiteShopSkipAuthSync } from '@/lib/partner-website/shop/partner-site-shop-auth-skip-sync'
import {
  isPartnerSiteAccountTab,
  partnerSiteAccountTabPath,
  partnerSiteNotificationsApiPath,
  partnerSitePersonalizationApiPath,
  type PartnerSiteAccountTab,
} from '@/lib/partner-website/shop/partner-site-shop-paths'
import { PartnerSiteAccountHub } from '@/components/partner-website/shop/partner-site-account-hub'
import { PartnerSiteAccountSessionActions } from '@/components/partner-website/shop/partner-site-account-session-actions'
import { PartnerSiteShopAuthPanel } from '@/components/partner-website/shop/partner-site-shop-auth-panel'
import {
  buildPartnerShopLoginHref,
  getPartnerShopBrowserReturnLocation,
} from '@/lib/partner-website/shop/partner-site-shop-auth-redirect'
import { PartnerSitePushEnableCard } from '@/components/partner-website/shop/partner-site-push-enable-card'
import { PartnerSiteShopSavedProductsClient } from '@/components/partner-website/shop/partner-site-shop-saved-products-client'
import { usePartnerSiteChatWidget } from '@/components/partner-website/shop/partner-site-chat-widget-provider'
import { usePartnerSiteCustomDomain } from '@/lib/partner-website/shop/partner-site-custom-domain-context'
import { usePartnerPwaInstall } from '@/lib/partner-website/shop/partner-site-pwa-install'
import type {
  PartnerSitePersonalizationProduct,
  PartnerSiteVisitorProfile,
} from '@/lib/partner-website/shop/partner-site-personalization'
import {
  composeDobWithYear,
  parseDobParts,
  parsePartnerShopGender,
  partnerShopBirthYearOptions,
  type PartnerShopGender,
} from '@/lib/partner-website/shop/partner-site-profile-demographics'
import { PW_EL, PW_REGION } from '@/lib/partner-website/visual-editor/pw-ui-contract'

const PartnerSiteShopCartClient = dynamic(
  () =>
    import('@/components/partner-website/shop/partner-site-shop-cart-client').then(
      (module) => module.PartnerSiteShopCartClient
    ),
  { loading: () => <p className="pw-shop-muted">…</p> }
)
const PartnerSiteShopOrdersClient = dynamic(
  () =>
    import('@/components/partner-website/shop/partner-site-shop-orders-client').then(
      (module) => module.PartnerSiteShopOrdersClient
    ),
  { loading: () => <p className="pw-shop-muted">…</p> }
)
const PartnerSiteShopAddressesClient = dynamic(
  () =>
    import('@/components/partner-website/shop/partner-site-shop-addresses-client').then(
      (module) => module.PartnerSiteShopAddressesClient
    ),
  { loading: () => <p className="pw-shop-muted">…</p> }
)

type AccountTab = PartnerSiteAccountTab

type WalletVoucher = {
  code: string
  name: string
  description: string
  discountType: 'percent' | 'fixed_amount'
  discountPercent: number | null
  discountAmount: number | null
  maxDiscountAmount: number | null
  minSubtotal: number
  expiresAt: string | null
}

type NotificationItem = {
  id: string
  type: string
  title: string
  body: string
  href: string
  readAt: string | null
  createdAt: string
}

function applyProfileFields(
  next: PartnerSiteVisitorProfile | null,
  setters: {
    setCustomerName: (v: string) => void
    setCustomerPhone: (v: string) => void
    setGender: (v: PartnerShopGender | '') => void
    setDob: (v: string) => void
    setBirthYear: (v: string) => void
    setSavedDobIso: (v: string) => void
    setContactAddress: (v: string) => void
  }
) {
  setters.setCustomerName(next?.customer_name ?? '')
  setters.setCustomerPhone(next?.customer_phone ?? '')
  setters.setGender(parsePartnerShopGender(next?.gender) ?? '')
  const iso = (next?.date_of_birth ?? '').trim().slice(0, 10)
  setters.setDob(iso)
  setters.setSavedDobIso(iso)
  setters.setBirthYear(parseDobParts(iso)?.year ?? '')
  setters.setContactAddress(next?.shipping_address ?? '')
}

type Props = {
  siteSlug: string
  partnerSlug: string
  shopTitle?: string
  locale: WebLocale
  initialTab?: AccountTab
  initialOrdersFilter?: string | null
  initialSavedProducts?: PartnerSitePersonalizationProduct[]
}

export function PartnerSiteShopAccountClient({
  siteSlug,
  partnerSlug,
  shopTitle,
  locale,
  initialTab = 'overview',
  initialSavedProducts,
  initialOrdersFilter = null,
}: Props) {
  const t = getPartnerSiteShopCopy(locale)
  const router = useRouter()
  const customDomain = usePartnerSiteCustomDomain()
  const { ready, authResolved, isAuthenticated, authHeaders, captureFromResponse, clearSession } =
    usePartnerSiteGuestSession(siteSlug)
  const [profile, setProfile] = useState<PartnerSiteVisitorProfile | null>(null)
  const [shopAdminHref, setShopAdminHref] = useState<string | null>(null)
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [gender, setGender] = useState<PartnerShopGender | ''>('')
  const [dob, setDob] = useState('')
  const [birthYear, setBirthYear] = useState('')
  const [savedDobIso, setSavedDobIso] = useState('')
  const [contactAddress, setContactAddress] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [needsAuth, setNeedsAuth] = useState(false)
  const [status, setStatus] = useState('')
  const [activeTab, setActiveTab] = useState<AccountTab>(
    isPartnerSiteAccountTab(initialTab) ? initialTab : 'overview'
  )
  const [ordersFilter, setOrdersFilter] = useState<string | null>(initialOrdersFilter)
  const [wallet, setWallet] = useState<WalletVoucher[]>([])
  const [walletLoading, setWalletLoading] = useState(false)
  const [copiedCode, setCopiedCode] = useState('')
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [notificationsLoading, setNotificationsLoading] = useState(false)
  const [unreadFromApi, setUnreadFromApi] = useState(0)
  const [showReAuth, setShowReAuth] = useState(false)
  const { deferredInstall, isStandalone, isIos, promptInstall } = usePartnerPwaInstall()
  const { openChat } = usePartnerSiteChatWidget()

  const loadProfile = useCallback(async () => {
    if (shouldPartnerSiteShopSkipAuthSync(siteSlug)) {
      setProfile(null)
      setShopAdminHref(null)
      setCustomerName('')
      setCustomerPhone('')
      setGender('')
      setDob('')
      setBirthYear('')
      setSavedDobIso('')
      setContactAddress('')
      setNeedsAuth(true)
      return null
    }
    const res = await fetch(partnerSitePersonalizationApiPath(siteSlug, 'profile'), {
      credentials: 'same-origin',
      headers: authHeaders(),
    })
    captureFromResponse(res)
    const json = (await res.json().catch(() => ({}))) as {
      profile?: PartnerSiteVisitorProfile
      requireAuth?: boolean
      shopAdmin?: { href?: string } | null
    }
    const next = json.profile ?? null
    setProfile(next)
    setShopAdminHref(json.shopAdmin?.href?.trim() || null)
    applyProfileFields(next, {
      setCustomerName,
      setCustomerPhone,
      setGender,
      setDob,
      setBirthYear,
      setSavedDobIso,
      setContactAddress,
    })
    setNeedsAuth(!next?.email)
    return next
  }, [authHeaders, captureFromResponse, siteSlug])

  useEffect(() => {
    if (!authResolved) return
    if (!isAuthenticated) {
      window.location.replace(
        buildPartnerShopLoginHref(siteSlug, getPartnerShopBrowserReturnLocation(siteSlug, { customDomain }), {
          customDomain,
        })
      )
      return
    }
    void loadProfile().finally(() => setLoading(false))
  }, [authResolved, customDomain, isAuthenticated, loadProfile, siteSlug])

  useEffect(() => {
    if (!authResolved || loading || !needsAuth || !isAuthenticated) return
    window.location.replace(
      buildPartnerShopLoginHref(siteSlug, getPartnerShopBrowserReturnLocation(siteSlug, { customDomain }), {
        customDomain,
      })
    )
  }, [authResolved, customDomain, isAuthenticated, loading, needsAuth, siteSlug])

  // W5.6 — legacy hash deep links → real account routes
  useEffect(() => {
    if (typeof window === 'undefined') return
    const rawHash = window.location.hash
    if (!rawHash) return
    const hashPath = rawHash.split('?')[0]
    const hashQuery = rawHash.includes('?') ? rawHash.slice(rawHash.indexOf('?') + 1) : ''
    const tabFromHash: Partial<Record<string, AccountTab>> = {
      '#edit-profile': 'edit-profile',
      '#cart': 'cart',
      '#orders': 'orders',
      '#wallet': 'wallet',
      '#wishlist': 'wishlist',
      '#recently-viewed': 'recently-viewed',
      '#addresses': 'addresses',
      '#contact': 'contact',
      '#security': 'security',
      '#notifications': 'notifications',
      '#install-app': 'install-app',
    }
    const tab = tabFromHash[hashPath]
    if (!tab) return
    let href = partnerSiteAccountTabPath(siteSlug, tab, { customDomain })
    if (tab === 'orders' && hashQuery) {
      const params = new URLSearchParams(hashQuery)
      const filter = params.get('tab')
      if (filter) {
        setOrdersFilter(filter)
        href = `${href}?tab=${encodeURIComponent(filter)}`
      }
    }
    router.replace(href)
  }, [customDomain, router, siteSlug])

  useEffect(() => {
    if (isPartnerSiteAccountTab(initialTab)) setActiveTab(initialTab)
  }, [initialTab])

  useEffect(() => {
    setOrdersFilter(initialOrdersFilter)
  }, [initialOrdersFilter])

  useEffect(() => {
    if (activeTab !== 'wallet' || !ready) return
    setWalletLoading(true)
    void fetch(`/api/site/${encodeURIComponent(siteSlug)}/promotions/wallet`, {
      credentials: 'same-origin',
      headers: authHeaders(),
    })
      .then((res) => {
        captureFromResponse(res)
        return res.json()
      })
      .then((json: { vouchers?: WalletVoucher[] }) => setWallet(json.vouchers ?? []))
      .finally(() => setWalletLoading(false))
  }, [activeTab, authHeaders, captureFromResponse, ready, siteSlug])

  useEffect(() => {
    if (activeTab !== 'notifications' || !ready || needsAuth) return
    setNotificationsLoading(true)
    void fetch(partnerSiteNotificationsApiPath(siteSlug), {
      credentials: 'same-origin',
      headers: authHeaders(),
    })
      .then((res) => {
        captureFromResponse(res)
        return res.json()
      })
      .then((json: { notifications?: NotificationItem[]; unreadCount?: number }) => {
        setNotifications(json.notifications ?? [])
        if (typeof json.unreadCount === 'number') setUnreadFromApi(json.unreadCount)
      })
      .finally(() => setNotificationsLoading(false))
  }, [activeTab, authHeaders, captureFromResponse, needsAuth, ready, siteSlug])

  useEffect(() => {
    if (!ready || needsAuth || activeTab === 'notifications') return
    void fetch(partnerSiteNotificationsApiPath(siteSlug, { unread: true }), {
      credentials: 'same-origin',
      headers: authHeaders(),
    })
      .then((res) => {
        captureFromResponse(res)
        return res.json()
      })
      .then((json: { unreadCount?: number }) => {
        setUnreadFromApi(Math.max(0, Number(json.unreadCount ?? 0) || 0))
      })
  }, [activeTab, authHeaders, captureFromResponse, needsAuth, ready, siteSlug])

  function copyVoucherCode(code: string) {
    void navigator.clipboard?.writeText(code)
    setCopiedCode(code)
    setTimeout(() => setCopiedCode(''), 2000)
  }

  async function saveProfile() {
    if (saving) return
    setSaving(true)
    setStatus('')
    try {
      const lockedParts = parseDobParts(savedDobIso)
      let dobToSave = ''
      if (lockedParts && birthYear) {
        dobToSave = composeDobWithYear(savedDobIso, birthYear) ?? ''
      } else if (dob) {
        dobToSave = dob
      }
      const body: Record<string, unknown> = {
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim(),
        shipping_address: contactAddress.trim(),
      }
      if (gender) body.gender = gender
      if (dobToSave) body.date_of_birth = dobToSave
      const res = await fetch(partnerSitePersonalizationApiPath(siteSlug, 'profile'), {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(body),
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
        } else if (json.error === 'DOB_DAY_LOCKED') {
          setStatus(t.accountDobDayLocked)
        } else if (json.error === 'DOB_INVALID') {
          setStatus(t.accountDobInvalid)
        } else {
          setStatus(t.accountSaveFailed)
        }
        return
      }
      if (json.profile) {
        setProfile(json.profile)
        applyProfileFields(json.profile, {
          setCustomerName,
          setCustomerPhone,
          setGender,
          setDob,
          setBirthYear,
          setSavedDobIso,
          setContactAddress,
        })
        setNeedsAuth(false)
      }
      setStatus(t.accountSaved)
    } finally {
      setSaving(false)
    }
  }

  async function markAllNotificationsRead() {
    const res = await fetch(partnerSiteNotificationsApiPath(siteSlug), {
      method: 'PATCH',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ markAllRead: true }),
    })
    captureFromResponse(res)
    if (!res.ok) return
    setUnreadFromApi(0)
    setNotifications((prev) =>
      prev.map((nItem) => ({ ...nItem, readAt: nItem.readAt ?? new Date().toISOString() }))
    )
  }

  async function markNotificationRead(id: string) {
    const res = await fetch(partnerSiteNotificationsApiPath(siteSlug), {
      method: 'PATCH',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ notificationId: id }),
    })
    captureFromResponse(res)
    if (!res.ok) return
    setUnreadFromApi((n) => Math.max(0, n - 1))
    setNotifications((prev) =>
      prev.map((nItem) =>
        nItem.id === id ? { ...nItem, readAt: nItem.readAt ?? new Date().toISOString() } : nItem
      )
    )
  }

  async function handleInstallApp() {
    await promptInstall()
  }

  const displayName =
    profile?.customer_name?.trim() ||
    profile?.greeting_name?.trim() ||
    profile?.email?.split('@')[0] ||
    ''

  const unreadCount =
    activeTab === 'notifications'
      ? notifications.filter((nItem) => !nItem.readAt).length
      : unreadFromApi

  const showAccountShell = shouldRenderPartnerSiteAccountShell({
    authResolved,
    isAuthenticated,
    needsAuth,
  })

  const savedDobParts = parseDobParts(savedDobIso)
  const hasLockedDob = Boolean(savedDobParts)
  const birthYearOptions = partnerShopBirthYearOptions()

  return (
    <div>
      {!showAccountShell ? <p className="pw-shop-muted">…</p> : null}

      {showAccountShell ? (
        <>
            {activeTab === 'overview' ? (
              <PartnerSiteAccountHub
                siteSlug={siteSlug}
                partnerSlug={partnerSlug}
                locale={locale}
                profile={profile}
                shopAdminHref={shopAdminHref}
                displayName={displayName}
                unreadNotifications={unreadCount}
              />
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
                initialFilter={ordersFilter}
              />
            ) : null}

            {activeTab === 'wallet' ? (
              <section>
                <h2 data-pw-el={PW_EL.heading}>{t.walletTitle}</h2>
                <p className="pw-shop-muted" style={{ marginBottom: 16 }}>
                  {t.walletHint}
                </p>
                {walletLoading ? <p className="pw-shop-muted">…</p> : null}
                {!walletLoading && wallet.length === 0 ? (
                  <p className="pw-shop-muted" data-pw-el={PW_EL.empty}>{t.walletEmpty}</p>
                ) : null}
                <div style={{ display: 'grid', gap: 12 }}>
                  {wallet.map((v) => (
                    <div
                      key={v.code}
                      data-pw-el={PW_EL.card}
                      style={{ border: '1px dashed #d1d5db', borderRadius: 12, padding: 16, display: 'grid', gap: 6 }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                        <strong>{v.name}</strong>
                        <span className="pw-shop-price">
                          {v.discountType === 'percent' ? `${v.discountPercent}%` : `${(v.discountAmount ?? 0).toLocaleString('vi-VN')}đ`}
                        </span>
                      </div>
                      {v.description ? <p className="pw-shop-muted" style={{ margin: 0 }}>{v.description}</p> : null}
                      {v.minSubtotal > 0 ? (
                        <p className="pw-shop-muted" style={{ margin: 0, fontSize: 13 }}>
                          {t.walletMinSubtotalNote} {v.minSubtotal.toLocaleString('vi-VN')}đ
                        </p>
                      ) : null}
                      {v.expiresAt ? (
                        <p className="pw-shop-muted" style={{ margin: 0, fontSize: 13 }}>
                          {t.walletExpiresLabel}: {new Date(v.expiresAt).toLocaleDateString(locale)}
                        </p>
                      ) : null}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                        <code style={{ background: '#f3f4f6', padding: '4px 10px', borderRadius: 6, fontWeight: 700 }}>
                          {v.code}
                        </code>
                        <button
                          type="button"
                          className="pw-shop-btn pw-shop-btn-outline"
                          onClick={() => copyVoucherCode(v.code)}
                        >
                          <Copy className="pw-shop-account-link-icon" aria-hidden="true" strokeWidth={2} style={{ width: 16, height: 16, marginRight: 4 }} />
                          {copiedCode === v.code ? t.walletCodeCopied : t.walletCopyCode}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {activeTab === 'wishlist' ? (
              <PartnerSiteShopSavedProductsClient
                siteSlug={siteSlug}
                locale={locale}
                mode="favorites"
                initialProducts={initialSavedProducts}
              />
            ) : null}

            {activeTab === 'recently-viewed' ? (
              <PartnerSiteShopSavedProductsClient
                siteSlug={siteSlug}
                locale={locale}
                mode="recently-viewed"
                initialProducts={initialSavedProducts}
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
                <h2 data-pw-el={PW_EL.heading}>{t.accountSectionEditProfile}</h2>
                <p className="pw-shop-muted pw-shop-profile-lead">{t.accountProfileLead}</p>
                <div className="pw-shop-form" data-pw-region={PW_REGION.form} style={{ marginTop: 16 }}>
                  {profile?.email ? (
                    <label data-pw-el={PW_EL.label}>
                      {t.accountEmailLabel}
                      <input value={profile.email} readOnly data-pw-el={PW_EL.field} />
                    </label>
                  ) : null}
                  <label data-pw-el={PW_EL.label}>
                    {t.checkoutPhone}
                    <input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} data-pw-el={PW_EL.field} />
                  </label>
                  <label data-pw-el={PW_EL.label}>
                    {t.accountFullName}
                    <input
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      autoComplete="name"
                      data-pw-el={PW_EL.field}
                    />
                  </label>
                  <label data-pw-el={PW_EL.label}>
                    {t.accountGender}
                    <select
                      value={gender}
                      onChange={(e) => setGender(parsePartnerShopGender(e.target.value) ?? '')}
                      data-pw-el={PW_EL.field}
                    >
                      <option value="">{t.accountGenderPlaceholder}</option>
                      <option value="male">{t.accountGenderMale}</option>
                      <option value="female">{t.accountGenderFemale}</option>
                    </select>
                  </label>
                  <div className="pw-shop-profile-dob">
                    <span className="pw-shop-form-label">{t.accountDob}</span>
                    {hasLockedDob && savedDobParts ? (
                      <div className="pw-shop-dob-row">
                        <label className="pw-shop-dob-md" data-pw-el={PW_EL.label}>
                          {t.accountDobLockedDayMonth}
                          <input
                            value={`${savedDobParts.day}/${savedDobParts.month}`}
                            readOnly
                            data-pw-el={PW_EL.field}
                          />
                        </label>
                        <label className="pw-shop-dob-year" data-pw-el={PW_EL.label}>
                          {t.accountDobYear}
                          <select
                            value={birthYear}
                            onChange={(e) => setBirthYear(e.target.value)}
                            data-pw-el={PW_EL.field}
                          >
                            <option value="">{t.accountDobYearPlaceholder}</option>
                            {birthYearOptions.map((year) => (
                              <option key={year} value={String(year)}>
                                {year}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                    ) : (
                      <input
                        type="date"
                        value={dob}
                        onChange={(e) => setDob(e.target.value)}
                        data-pw-el={PW_EL.field}
                      />
                    )}
                    <p className="pw-shop-form-help">
                      {hasLockedDob ? t.accountDobHelpLocked : t.accountDobHelpFirst}
                    </p>
                  </div>
                  <label data-pw-el={PW_EL.label}>
                    {t.accountContactAddress}
                    <textarea
                      rows={3}
                      value={contactAddress}
                      onChange={(e) => setContactAddress(e.target.value)}
                      placeholder={t.accountContactAddressPh}
                      data-pw-el={PW_EL.field}
                    />
                  </label>
                  <div className="pw-shop-form-actions">
                    <button type="button" className="pw-shop-btn" disabled={saving} onClick={() => void saveProfile()} data-pw-el={PW_EL.submit}>
                      {saving ? '…' : t.accountSave}
                    </button>
                    <button
                      type="button"
                      className="pw-shop-btn pw-shop-btn-outline"
                      disabled={saving}
                      onClick={() => router.push(partnerSiteAccountTabPath(siteSlug, 'overview', { customDomain }))}
                    >
                      {t.accountCancel}
                    </button>
                  </div>
                  {status ? <p className="pw-shop-muted">{status}</p> : null}
                </div>
                <div className="pw-shop-account-session">
                  <PartnerSiteAccountSessionActions siteSlug={siteSlug} locale={locale} />
                </div>
              </section>
            ) : null}

            {activeTab === 'security' ? (
              <section className="pw-shop-account-edit">
                <h2 data-pw-el={PW_EL.heading}>{t.accountSecurityTitle}</h2>
                {profile?.email ? (
                  <p className="pw-shop-muted" style={{ marginTop: 12 }}>
                    {t.accountEmailLabel}: {profile.email}
                  </p>
                ) : null}
                <p className="pw-shop-muted" style={{ marginTop: 8, marginBottom: 16 }}>
                  {t.accountSecurityLoginNote}
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                  <button
                    type="button"
                    className="pw-shop-btn pw-shop-btn-outline"
                    onClick={() => void clearSession()}
                  >
                    {t.accountSignOutDevice}
                  </button>
                  <button
                    type="button"
                    className="pw-shop-btn"
                    onClick={() => setShowReAuth((v) => !v)}
                  >
                    {t.accountSecurityReAuth}
                  </button>
                </div>
                {showReAuth ? (
                  <div style={{ marginTop: 20 }}>
                    <PartnerSiteShopAuthPanel
                      partnerSlug={partnerSlug}
                      siteSlug={siteSlug}
                      shopTitle={shopTitle}
                      locale={locale}
                      onAuthed={() => {
                        setShowReAuth(false)
                        void loadProfile()
                      }}
                    />
                  </div>
                ) : null}
              </section>
            ) : null}

            {activeTab === 'notifications' ? (
              <section className="pw-shop-account-edit">
                {needsAuth ? (
                  <div style={{ textAlign: 'center', padding: '32px 8px' }}>
                    <p className="pw-shop-muted" style={{ marginBottom: 12 }}>{t.accountNotificationsLogin}</p>
                    <button
                      type="button"
                      className="pw-shop-btn"
                      onClick={() => setShowReAuth(true)}
                    >
                      {t.accountNotificationsSignIn}
                    </button>
                  </div>
                ) : (
                  <>
                    <PartnerSitePushEnableCard siteSlug={siteSlug} locale={locale} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                      <h2 style={{ margin: 0 }}>{t.accountNotificationsTitle}</h2>
                      {unreadCount > 0 ? (
                        <button
                          type="button"
                          className="pw-shop-btn pw-shop-btn-outline"
                          onClick={() => void markAllNotificationsRead()}
                        >
                          {t.accountNotificationsMarkAllRead}
                        </button>
                      ) : null}
                    </div>
                    {notificationsLoading ? (
                      <p className="pw-shop-muted" style={{ marginTop: 16 }}>{t.accountNotificationsLoading}</p>
                    ) : null}
                    {!notificationsLoading && notifications.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '40px 12px', marginTop: 16, borderRadius: 12, border: '1px solid var(--pw-border, #f3f4f6)', background: 'var(--pw-surface, #f9fafb)' }}>
                        <Bell aria-hidden="true" strokeWidth={1.5} style={{ width: 48, height: 48, margin: '0 auto 12px', color: '#d1d5db' }} />
                        <p className="pw-shop-muted" data-pw-el={PW_EL.empty}>{t.accountNotificationsEmpty}</p>
                      </div>
                    ) : null}
                    <ul style={{ listStyle: 'none', padding: 0, margin: '16px 0 0', display: 'grid', gap: 10 }}>
                      {notifications.map((item) => (
                        <li key={item.id}>
                          <button
                            type="button"
                            className="pw-shop-account-link-card"
                            style={{
                              width: '100%',
                              textAlign: 'left',
                              background: item.readAt ? '#fff' : 'color-mix(in srgb, var(--pw-primary) 8%, #fff)',
                              borderColor: item.readAt ? 'var(--pw-border, #f3f4f6)' : 'color-mix(in srgb, var(--pw-primary) 22%, #fff)',
                              fontWeight: item.readAt ? 400 : 600,
                            }}
                            onClick={() => {
                              if (!item.readAt) void markNotificationRead(item.id)
                              if (item.href) router.push(item.href)
                            }}
                          >
                            <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                              <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                                {!item.readAt ? (
                                  <span
                                    aria-hidden="true"
                                    style={{ width: 8, height: 8, borderRadius: 999, background: 'var(--pw-primary)', flexShrink: 0 }}
                                  />
                                ) : null}
                                <strong style={{ display: 'block' }}>{item.title}</strong>
                              </span>
                              <span className="pw-shop-muted" style={{ fontSize: 12, fontWeight: 400, whiteSpace: 'nowrap' }}>
                                {item.createdAt
                                  ? new Date(item.createdAt).toLocaleString(locale, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                                  : ''}
                              </span>
                            </span>
                            {item.body ? (
                              <span
                                className="pw-shop-muted"
                                style={{ display: 'block', marginTop: 6, paddingLeft: 16, fontWeight: 400, whiteSpace: 'pre-line' }}
                              >
                                {item.body}
                              </span>
                            ) : null}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </section>
            ) : null}

            {activeTab === 'install-app' ? (
              <section className="pw-shop-account-edit">
                <h2 data-pw-el={PW_EL.heading}>{t.accountInstallAppTitle}</h2>
                <p className="pw-shop-muted" style={{ marginTop: 8, marginBottom: 16 }}>
                  {t.accountInstallAppHint}
                </p>
                {isStandalone ? (
                  <p className="pw-shop-muted">{t.accountInstallAppInstalled}</p>
                ) : null}
                {!isStandalone && deferredInstall ? (
                  <button type="button" className="pw-shop-btn" onClick={() => void handleInstallApp()}>
                    <Download className="pw-shop-account-link-icon" aria-hidden="true" strokeWidth={2} style={{ marginRight: 6 }} />
                    {t.accountInstallAppButton}
                  </button>
                ) : null}
                {!isStandalone && isIos ? (
                  <p className="pw-shop-muted" style={{ marginTop: 12 }}>{t.accountInstallAppIosTip}</p>
                ) : null}
                {!isStandalone && !isIos && !deferredInstall ? (
                  <p className="pw-shop-muted" style={{ marginTop: 12 }}>{t.accountInstallAppManualTip}</p>
                ) : null}
              </section>
            ) : null}

            {activeTab === 'contact' ? (
              <section className="pw-shop-account-edit">
                <h2 data-pw-el={PW_EL.heading}>{t.chatOpenLabel}</h2>
                <p className="pw-shop-muted" style={{ marginBottom: 16 }}>
                  {t.chatOpenLabel}
                </p>
                <button type="button" className="pw-shop-btn" onClick={openChat}>
                  <MessageCircle className="pw-shop-account-link-icon" aria-hidden="true" strokeWidth={2} style={{ marginRight: 6 }} />
                  {t.chatOpenLabel}
                </button>
              </section>
            ) : null}
        </>
      ) : null}
    </div>
  )
}
