'use client'

import { FormEvent, useState } from 'react'
import type { WebLocale } from '@/lib/i18n/config'
import { getPartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'
import { PW_EL, PW_REGION } from '@/lib/partner-website/visual-editor/pw-ui-contract'

export function PartnerSiteNewsletterForm({
  siteSlug,
  locale,
}: {
  siteSlug: string
  locale: WebLocale
}) {
  const t = getPartnerSiteShopCopy(locale)
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'ok' | 'err'>('idle')
  const [pending, setPending] = useState(false)

  async function onSubmit(ev: FormEvent) {
    ev.preventDefault()
    setPending(true)
    setStatus('idle')
    try {
      const res = await fetch(`/api/site/${encodeURIComponent(siteSlug)}/newsletter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ email: email.trim() }),
      })
      const json = (await res.json().catch(() => null)) as { ok?: boolean } | null
      setStatus(res.ok && json?.ok ? 'ok' : 'err')
    } catch {
      setStatus('err')
    } finally {
      setPending(false)
    }
  }

  return (
    <form
      className="pw-newsletter"
      data-pw-newsletter="1"
      data-pw-region={PW_REGION.form}
      data-pw-footer-kit="newsletter"
      onSubmit={onSubmit}
      noValidate
    >
      <input
        type="email"
        name="email"
        data-pw-el={PW_EL.field}
        autoComplete="email"
        placeholder={t.footerNewsletterPlaceholder}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <button type="submit" data-pw-el={PW_EL.submit} disabled={pending}>
        {t.footerNewsletterSubmit}
      </button>
      {status !== 'idle' ? (
        <p data-pw-newsletter-status="1">
          {status === 'ok' ? t.footerNewsletterOk : t.footerNewsletterError}
        </p>
      ) : null}
    </form>
  )
}
