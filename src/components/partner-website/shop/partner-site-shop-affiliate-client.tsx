'use client'

import { useCallback, useLayoutEffect, useMemo, useState } from 'react'
import type { WebLocale } from '@/lib/i18n/config'
import { usePartnerSiteGuestSession } from '@/hooks/use-partner-site-guest-session'
import { getPartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'
import { usePartnerSiteCustomDomain } from '@/lib/partner-website/shop/partner-site-custom-domain-context'
import {
  partnerSiteAccountTabPath,
  partnerSiteAffiliateApiPath,
} from '@/lib/partner-website/shop/partner-site-shop-paths'
import {
  affiliateApiErrorMessage,
  affiliateCommissionStatusLabel,
  appendReferralToUrl,
  formatAffiliateMoney,
  partnerAffiliateShareHrefs,
  type PartnerSiteAffiliateMeView,
} from '@/lib/partner-website/shop/partner-site-affiliate'
import { PW_EL } from '@/lib/partner-website/visual-editor/pw-ui-contract'

type ReferredOrder = {
  order_id: string
  order_code: string
  buyer_label: string
  product_summary: string
  order_total: number
  commission_amount: number
  commission_status: 'pending' | 'confirmed' | 'cancelled' | 'awaiting_deposit'
  shipping_status: string
  order_created_at: string
}

type WalletTx = {
  id: string
  tx_type: string
  amount: number
  description: string | null
  created_at: string
}

type Props = {
  siteSlug: string
  locale: WebLocale
  mode?: 'affiliate' | 'affiliate-bank'
}

export function PartnerSiteShopAffiliateClient({
  siteSlug,
  locale,
  mode = 'affiliate',
}: Props) {
  const t = getPartnerSiteShopCopy(locale)
  const customDomain = usePartnerSiteCustomDomain()
  const { ready, authHeaders, captureFromResponse, isAuthenticated } = usePartnerSiteGuestSession(siteSlug)
  const [me, setMe] = useState<PartnerSiteAffiliateMeView | null>(null)
  const [orders, setOrders] = useState<ReferredOrder[]>([])
  const [txs, setTxs] = useState<WalletTx[]>([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [message, setMessage] = useState('')
  const [socialLinks, setSocialLinks] = useState('')
  const [note, setNote] = useState('')
  const [convertIn, setConvertIn] = useState('')
  const [convertOut, setConvertOut] = useState('')
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [otp, setOtp] = useState('')
  const [bankName, setBankName] = useState('')
  const [bankAccount, setBankAccount] = useState('')
  const [accountHolder, setAccountHolder] = useState('')
  const [busy, setBusy] = useState(false)

  const api = useCallback(
    (rest = '') => partnerSiteAffiliateApiPath(siteSlug, rest),
    [siteSlug]
  )

  const reload = useCallback(async () => {
    if (!ready) return
    setFailed(false)
    try {
      const res = await fetch(api(), { credentials: 'same-origin', headers: authHeaders() })
      captureFromResponse(res)
      const json = (await res.json()) as { me?: PartnerSiteAffiliateMeView }
      if (json.me) {
        setMe(json.me)
        if (json.me.bank_account) {
          setBankName(json.me.bank_account.bank_name)
          setBankAccount(json.me.bank_account.bank_account)
          setAccountHolder(json.me.bank_account.account_holder)
        }
        if (json.me.affiliate_status === 'approved') {
          const [ordersRes, txRes] = await Promise.all([
            fetch(api('referred-orders?limit=20'), { credentials: 'same-origin', headers: authHeaders() }),
            fetch(api('wallet/transactions?limit=30'), { credentials: 'same-origin', headers: authHeaders() }),
          ])
          captureFromResponse(ordersRes)
          captureFromResponse(txRes)
          const ordersJson = (await ordersRes.json()) as { orders?: ReferredOrder[] }
          const txJson = (await txRes.json()) as { transactions?: WalletTx[] }
          setOrders(ordersJson.orders ?? [])
          setTxs(txJson.transactions ?? [])
        }
      }
    } catch {
      setFailed(true)
    } finally {
      setLoading(false)
    }
  }, [api, authHeaders, captureFromResponse, ready])

  useLayoutEffect(() => {
    if (!ready) return
    void reload()
  }, [ready, reload])

  const postJson = useCallback(
    async (rest: string, body: unknown, method = 'POST') => {
      const res = await fetch(api(rest), {
        method,
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(body),
      })
      captureFromResponse(res)
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
      if (!res.ok || json.ok === false) throw new Error(affiliateApiErrorMessage(locale, json.error || 'error'))
      return json
    },
    [api, authHeaders, captureFromResponse, locale]
  )

  const origin = useMemo(() => {
    if (typeof window === 'undefined') return ''
    return window.location.origin
  }, [])

  if (loading && !me) {
    return (
      <section className="pw-shop-affiliate" aria-busy="true">
        <p className="pw-shop-muted">{t.affiliateLoading}</p>
      </section>
    )
  }
  if (failed && !me) {
    return (
      <section className="pw-shop-affiliate">
        <p className="pw-shop-muted">{t.affiliateLoadFailed}</p>
      </section>
    )
  }
  if (!isAuthenticated) {
    return (
      <section className="pw-shop-affiliate">
        <h2 data-pw-el={PW_EL.heading}>{t.affiliateTitle}</h2>
        <p className="pw-shop-muted">{t.affiliateNeedLogin}</p>
      </section>
    )
  }
  if (me && !me.affiliate_enabled) {
    return (
      <section className="pw-shop-affiliate">
        <div className="pw-shop-affiliate-notice">
          <strong>{t.affiliateDisabledTitle}</strong>
          <p>{t.affiliateDisabledHint}</p>
        </div>
      </section>
    )
  }

  const approved = me?.affiliate_status === 'approved'

  async function copyText(value: string) {
    try {
      await navigator.clipboard.writeText(value)
      setMessage(t.affiliateCopied)
    } catch {
      setMessage(t.affiliateCopied)
    }
  }

  if (mode === 'affiliate-bank') {
    return (
      <section className="pw-shop-affiliate">
        <h2 data-pw-el={PW_EL.heading}>{t.affiliateBankTitle}</h2>
        {!approved ? <p className="pw-shop-muted">{t.affiliatePending}</p> : null}
        <div className="pw-shop-affiliate-card">
          <label>
            {t.affiliateBankName}
            <input value={bankName} onChange={(e) => setBankName(e.target.value)} />
          </label>
          <label>
            {t.affiliateBankAccount}
            <input value={bankAccount} onChange={(e) => setBankAccount(e.target.value)} />
          </label>
          <label>
            {t.affiliateAccountHolder}
            <input value={accountHolder} onChange={(e) => setAccountHolder(e.target.value)} />
          </label>
          <label>
            {t.affiliateOtp}
            <input value={otp} onChange={(e) => setOtp(e.target.value)} />
          </label>
          {message ? <p className="pw-shop-muted">{message}</p> : null}
          <div className="pw-shop-affiliate-actions">
            <button
              type="button"
              className="pw-shop-btn-buy"
              disabled={busy || !approved}
              onClick={() => {
                setBusy(true)
                void postJson('bank-account/otp', {
                  bank_name: bankName,
                  bank_account: bankAccount,
                  account_holder: accountHolder,
                })
                  .then(() => setMessage(t.affiliateRequestOtp))
                  .catch((error: Error) => setMessage(error.message))
                  .finally(() => setBusy(false))
              }}
            >
              {t.affiliateRequestOtp}
            </button>
            <button
              type="button"
              className="pw-shop-btn-cart"
              disabled={busy || !approved}
              onClick={() => {
                setBusy(true)
                void postJson(
                  'bank-account',
                  {
                    bank_name: bankName,
                    bank_account: bankAccount,
                    account_holder: accountHolder,
                    otp,
                  },
                  'PUT'
                )
                  .then(() => {
                    setMessage(t.affiliateSaveBank)
                    void reload()
                  })
                  .catch((error: Error) => setMessage(error.message))
                  .finally(() => setBusy(false))
              }}
            >
              {t.affiliateSaveBank}
            </button>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="pw-shop-affiliate">
      <h2 data-pw-el={PW_EL.heading}>{t.affiliateTitle}</h2>
      {me?.affiliate_status === 'pending' ? <p className="pw-shop-affiliate-chip">{t.affiliatePending}</p> : null}
      {me?.affiliate_status === 'rejected' ? <p className="pw-shop-affiliate-chip is-warn">{t.affiliateRejected}</p> : null}
      {approved ? <p className="pw-shop-affiliate-chip">{t.affiliateApproved}</p> : null}

      {!approved ? (
        <form
          className="pw-shop-affiliate-card"
          onSubmit={(event) => {
            event.preventDefault()
            setBusy(true)
            void postJson('application', {
              social_links: socialLinks.split(/\n+/),
              note,
            })
              .then(() => {
                setMessage(t.affiliatePending)
                void reload()
              })
              .catch((error: Error) => setMessage(error.message))
              .finally(() => setBusy(false))
          }}
        >
          <h3>{t.affiliateApplyTitle}</h3>
          <label>
            {t.affiliateSocialLinksLabel}
            <textarea
              rows={4}
              value={socialLinks}
              onChange={(e) => setSocialLinks(e.target.value)}
              placeholder={t.affiliateSocialLinksHint}
            />
          </label>
          <label>
            {t.affiliateNoteLabel}
            <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          <button type="submit" className="pw-shop-btn-buy" disabled={busy}>
            {t.affiliateSubmit}
          </button>
        </form>
      ) : null}

      {approved && me ? (
        <>
          <div className="pw-shop-affiliate-stats">
            <div>
              <p className="pw-shop-affiliate-stat-label">{t.affiliateBalance}</p>
              <p className="pw-shop-affiliate-stat-value">{formatAffiliateMoney(me.balance)}</p>
            </div>
            <div>
              <p className="pw-shop-affiliate-stat-label">{t.affiliatePendingBalance}</p>
              <p className="pw-shop-affiliate-stat-value">{formatAffiliateMoney(me.pending_balance)}</p>
            </div>
          </div>
          <div className="pw-shop-affiliate-card">
            <p>
              {t.affiliateReferralCode}: <strong>{me.referral_code}</strong>
            </p>
            <p className="pw-shop-muted">{me.referral_link}</p>
            <button type="button" className="pw-shop-btn-cart" onClick={() => void copyText(me.referral_link)}>
              {t.affiliateCopy} {t.affiliateReferralLink}
            </button>
            {me.referral_link ? (
              <div className="pw-shop-affiliate-share">
                <a href={partnerAffiliateShareHrefs(me.referral_link).facebook} target="_blank" rel="noreferrer">
                  Facebook
                </a>
                <a href={partnerAffiliateShareHrefs(me.referral_link).zalo} target="_blank" rel="noreferrer">
                  Zalo
                </a>
                <a href={partnerAffiliateShareHrefs(me.referral_link).telegram} target="_blank" rel="noreferrer">
                  Telegram
                </a>
                <button
                  type="button"
                  onClick={() =>
                    void copyText(appendReferralToUrl(typeof window === 'undefined' ? me.referral_link : window.location.href, me.referral_code, origin))
                  }
                >
                  {t.affiliateShareThisPage}
                </button>
              </div>
            ) : null}
            <label>
              {t.affiliateConverterTitle}
              <input
                value={convertIn}
                onChange={(e) => setConvertIn(e.target.value)}
                placeholder={t.affiliateConverterHint}
              />
            </label>
            <button
              type="button"
              className="pw-shop-btn-cart"
              onClick={() => setConvertOut(appendReferralToUrl(convertIn, me.referral_code, origin))}
            >
              {t.affiliateConvert}
            </button>
            {convertOut ? (
              <p>
                <button type="button" onClick={() => void copyText(convertOut)}>
                  {convertOut}
                </button>
              </p>
            ) : null}
            <p>
              {t.affiliateCommission}: {me.commission_percent}% · {t.affiliateMinWithdraw}:{' '}
              {formatAffiliateMoney(me.min_withdrawal)}
            </p>
            {me.commission_policy ? <p className="pw-shop-muted">{me.commission_policy}</p> : null}
            <a href={partnerSiteAccountTabPath(siteSlug, 'affiliate-bank', { customDomain })}>
              {t.affiliateOpenBank}
            </a>
          </div>
          <form
            className="pw-shop-affiliate-card"
            onSubmit={(event) => {
              event.preventDefault()
              setBusy(true)
              void postJson('wallet/withdraw', {
                amount: Math.round(Number(withdrawAmount) || 0),
                otp,
              })
                .then(() => {
                  setMessage(t.affiliateWithdraw)
                  setWithdrawAmount('')
                  setOtp('')
                  void reload()
                })
                .catch((error: Error) => setMessage(error.message))
                .finally(() => setBusy(false))
            }}
          >
            <h3>{t.affiliateWithdraw}</h3>
            <label>
              {t.affiliateWithdrawAmount}
              <input
                inputMode="numeric"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
              />
            </label>
            <label>
              {t.affiliateOtp}
              <input value={otp} onChange={(e) => setOtp(e.target.value)} />
            </label>
            <div className="pw-shop-affiliate-actions">
              <button
                type="button"
                className="pw-shop-btn-cart"
                disabled={busy}
                onClick={() => {
                  setBusy(true)
                  void postJson('wallet/otp', { amount: Math.round(Number(withdrawAmount) || 0) })
                    .then(() => setMessage(t.affiliateRequestOtp))
                    .catch((error: Error) => setMessage(error.message))
                    .finally(() => setBusy(false))
                }}
              >
                {t.affiliateRequestOtp}
              </button>
              <button type="submit" className="pw-shop-btn-buy" disabled={busy}>
                {t.affiliateWithdraw}
              </button>
            </div>
          </form>
          <div className="pw-shop-affiliate-card">
            <h3>{t.affiliateReferredOrders}</h3>
            {orders.length === 0 ? <p className="pw-shop-muted">—</p> : null}
            <ul className="pw-shop-affiliate-list">
              {orders.map((row) => (
                <li key={row.order_id}>
                  <strong>{row.order_code}</strong> · {row.buyer_label} · {row.product_summary}
                  <span>
                    {formatAffiliateMoney(row.commission_amount)} ·{' '}
                    {affiliateCommissionStatusLabel(locale, row.commission_status, row.shipping_status)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className="pw-shop-affiliate-card">
            <h3>{t.affiliateTransactions}</h3>
            {txs.length === 0 ? <p className="pw-shop-muted">—</p> : null}
            <ul className="pw-shop-affiliate-list">
              {txs.map((row) => (
                <li key={row.id}>
                  {row.description || row.tx_type}
                  <span>{formatAffiliateMoney(Math.abs(row.amount))}</span>
                </li>
              ))}
            </ul>
          </div>
        </>
      ) : null}
      {message ? <p className="pw-shop-muted">{message}</p> : null}
    </section>
  )
}
