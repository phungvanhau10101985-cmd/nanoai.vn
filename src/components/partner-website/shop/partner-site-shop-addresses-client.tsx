'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import type { WebLocale } from '@/lib/i18n/config'
import { usePartnerSiteGuestSession } from '@/hooks/use-partner-site-guest-session'
import { getPartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'
import {
  partnerSiteAccountPath,
  partnerSiteAddressesApiPath,
} from '@/lib/partner-website/shop/partner-site-shop-paths'
import {
  buildPartnerShopLoginHref,
  getPartnerShopBrowserReturnLocation,
} from '@/lib/partner-website/shop/partner-site-shop-auth-redirect'
import { usePartnerSiteCustomDomain } from '@/lib/partner-website/shop/partner-site-custom-domain-context'
import {
  emptyPartnerSiteAddressInput,
  formatPartnerSiteAddressLine,
  type PartnerSiteCustomerAddress,
  type PartnerSiteCustomerAddressInput,
} from '@/lib/partner-website/shop/partner-site-customer-address'
import { PartnerSiteAddressFormFields } from '@/components/partner-website/shop/partner-site-address-form'
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
  const [addresses, setAddresses] = useState<PartnerSiteCustomerAddress[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [needsAuth, setNeedsAuth] = useState(false)
  const [status, setStatus] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<PartnerSiteCustomerAddressInput>(emptyPartnerSiteAddressInput())
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  const loadAddresses = useCallback(async () => {
    const res = await fetch(partnerSiteAddressesApiPath(siteSlug), {
      credentials: 'same-origin',
      headers: authHeaders(),
    })
    captureFromResponse(res)
    const json = (await res.json().catch(() => ({}))) as {
      ok?: boolean
      requireAuth?: boolean
      addresses?: PartnerSiteCustomerAddress[]
    }
    if (json.requireAuth || res.status === 401) {
      setNeedsAuth(true)
      setAddresses([])
      return
    }
    setNeedsAuth(false)
    setAddresses(Array.isArray(json.addresses) ? json.addresses : [])
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
    void loadAddresses().finally(() => setLoading(false))
  }, [customDomain, isAuthenticated, loadAddresses, ready, siteSlug])

  useEffect(() => {
    if (!ready || loading || !needsAuth || !isAuthenticated) return
    window.location.replace(
      buildPartnerShopLoginHref(siteSlug, getPartnerShopBrowserReturnLocation(siteSlug, { customDomain }), {
        customDomain,
      })
    )
  }, [customDomain, isAuthenticated, loading, needsAuth, ready, siteSlug])

  function openAdd() {
    setEditingId(null)
    setForm(emptyPartnerSiteAddressInput({ is_default: addresses.length === 0 }))
    setShowForm(true)
    setStatus('')
  }

  function openEdit(addr: PartnerSiteCustomerAddress) {
    setEditingId(addr.id)
    setForm({
      full_name: addr.full_name,
      phone: addr.phone,
      province: addr.province,
      district: addr.district,
      ward: addr.ward,
      street_address: addr.street_address,
      is_default: addr.is_default,
    })
    setShowForm(true)
    setStatus('')
  }

  async function saveAddress() {
    if (saving) return
    setSaving(true)
    setStatus('')
    try {
      const url = editingId
        ? partnerSiteAddressesApiPath(siteSlug, editingId)
        : partnerSiteAddressesApiPath(siteSlug)
      const res = await fetch(url, {
        method: editingId ? 'PUT' : 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(form),
      })
      captureFromResponse(res)
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; requireAuth?: boolean }
      if (!res.ok || !json.ok) {
        if (json.requireAuth) {
          setNeedsAuth(true)
          setStatus(t.checkoutAuthRequired)
        } else {
          setStatus(t.accountSaveFailed)
        }
        return
      }
      await loadAddresses()
      setShowForm(false)
      setEditingId(null)
      setStatus(t.accountSaved)
    } finally {
      setSaving(false)
    }
  }

  async function setDefault(id: string) {
    const res = await fetch(partnerSiteAddressesApiPath(siteSlug, id, 'default'), {
      method: 'POST',
      credentials: 'same-origin',
      headers: authHeaders(),
    })
    captureFromResponse(res)
    if (!res.ok) {
      setStatus(t.accountSaveFailed)
      return
    }
    await loadAddresses()
  }

  async function confirmDelete() {
    if (!pendingDeleteId) return
    const res = await fetch(partnerSiteAddressesApiPath(siteSlug, pendingDeleteId), {
      method: 'DELETE',
      credentials: 'same-origin',
      headers: authHeaders(),
    })
    captureFromResponse(res)
    setPendingDeleteId(null)
    if (!res.ok) {
      setStatus(t.accountSaveFailed)
      return
    }
    await loadAddresses()
    setStatus(t.addressDeleted)
  }

  return (
    <div data-pw-region={PW_REGION.accountMain}>
      <div className="pw-shop-address-head">
        <div>
          <h1 data-pw-el={PW_EL.heading}>{t.accountAddressBook}</h1>
          <p className="pw-shop-muted" data-pw-el={PW_EL.body}>{t.addressesHint}</p>
        </div>
        {!loading && !needsAuth ? (
          <button type="button" className="pw-shop-btn pw-shop-btn-buy" onClick={openAdd} data-pw-el={PW_EL.submit}>
            {t.addressAdd}
          </button>
        ) : null}
      </div>
      {loading ? <p className="pw-shop-muted">…</p> : null}
      {!loading && needsAuth ? <p className="pw-shop-muted">…</p> : null}
      {!loading && !needsAuth && addresses.length === 0 && !showForm ? (
        <p className="pw-shop-muted" data-pw-el={PW_EL.empty}>{t.addressesEmptyHint}</p>
      ) : null}
      {!loading && !needsAuth && addresses.length > 0 ? (
        <ul className="pw-shop-address-list">
          {addresses.map((addr) => (
            <li key={addr.id} className="pw-shop-address-card">
              <div>
                <div className="pw-shop-address-card-meta">
                  <strong>{addr.full_name}</strong>
                  <span className="pw-shop-muted">{addr.phone}</span>
                  {addr.is_default ? (
                    <span className="pw-shop-address-default">{t.addressDefaultBadge}</span>
                  ) : null}
                </div>
                <p>{formatPartnerSiteAddressLine(addr)}</p>
              </div>
              <div className="pw-shop-address-actions">
                {!addr.is_default ? (
                  <button type="button" className="pw-shop-address-set-default" onClick={() => void setDefault(addr.id)}>
                    {t.addressSetDefault}
                  </button>
                ) : null}
                <button type="button" onClick={() => openEdit(addr)}>
                  {t.addressEdit}
                </button>
                <button type="button" className="pw-shop-address-delete" onClick={() => setPendingDeleteId(addr.id)}>
                  {t.addressDelete}
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
      {showForm ? (
        <form
          className="pw-shop-address-form"
          data-pw-region={PW_REGION.form}
          onSubmit={(e) => {
            e.preventDefault()
            void saveAddress()
          }}
        >
          <h2 data-pw-el={PW_EL.heading}>{editingId ? t.addressFormTitleEdit : t.addressFormTitleAdd}</h2>
          <PartnerSiteAddressFormFields value={form} onChange={setForm} t={t} idPrefix="book" />
          <div className="pw-shop-address-form-actions">
            <button type="submit" className="pw-shop-btn pw-shop-btn-buy" disabled={saving} data-pw-el={PW_EL.submit}>
              {saving ? '…' : t.addressSave}
            </button>
            <button
              type="button"
              className="pw-shop-btn pw-shop-btn-outline"
              onClick={() => {
                setShowForm(false)
                setEditingId(null)
              }}
            >
              {t.addressCancel}
            </button>
          </div>
        </form>
      ) : null}
      {status ? <p className="pw-shop-muted">{status}</p> : null}
      <p style={{ marginTop: 16 }}>
        <Link href={partnerSiteAccountPath(siteSlug)} className="pw-shop-btn pw-shop-btn-outline">
          {t.navAccount}
        </Link>
      </p>
      {pendingDeleteId ? (
        <div className="pw-shop-address-modal" role="dialog" aria-modal="true" onClick={() => setPendingDeleteId(null)}>
          <div className="pw-shop-address-modal-card" onClick={(e) => e.stopPropagation()}>
            <h3>{t.addressDeleteConfirm}</h3>
            <p className="pw-shop-muted">{t.addressDeleteConfirmBody}</p>
            <div className="pw-shop-address-form-actions">
              <button type="button" className="pw-shop-btn pw-shop-btn-outline" onClick={() => setPendingDeleteId(null)}>
                {t.addressCancel}
              </button>
              <button type="button" className="pw-shop-btn pw-shop-address-delete-btn" onClick={() => void confirmDelete()}>
                {t.addressDelete}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
