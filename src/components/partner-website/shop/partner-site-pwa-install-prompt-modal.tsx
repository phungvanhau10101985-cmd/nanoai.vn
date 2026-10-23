'use client'

import { useCallback, useEffect, useId, useState } from 'react'
import { createPortal } from 'react-dom'
import type { WebLocale } from '@/lib/i18n/config'
import { usePartnerSiteGuestSession } from '@/hooks/use-partner-site-guest-session'
import { shouldPartnerSiteShopSkipAuthSync } from '@/lib/partner-website/shop/partner-site-shop-auth-skip-sync'
import {
  PW_BIRTH_GENDER_PROMPT_SETTLED_EVENT,
  clearPartnerSitePwaInstallPromptPending,
  clearPartnerSitePwaRememberedInstalled,
  dismissPartnerSitePwaInstallPrompt,
  isPartnerSiteFreshLoginSession,
  isPartnerSitePwaInstallPromptDismissed,
  isPartnerSitePwaInstallPromptPending,
  isPartnerSitePwaRememberedInstalled,
  isPartnerSiteShopLoginPath,
  markPartnerSitePwaInstalled,
} from '@/lib/partner-website/shop/partner-site-birth-gender-prompt-session'
import {
  PWA_INSTALL_PROMPT_COPY,
  claimPartnerPwaInstallPrompt,
  pwaInstallPromptLead,
  shouldOfferPartnerPwaInstallPrompt,
} from '@/lib/partner-website/shop/partner-site-pwa-install-prompt'
import { usePartnerPwaInstall } from '@/lib/partner-website/shop/partner-site-pwa-install'

type Props = {
  siteSlug: string
  shopTitle?: string
  locale: WebLocale
}

function otherPromptOpen(): boolean {
  if (typeof document === 'undefined') return false
  return Boolean(document.querySelector('[data-pw-birth-gender-prompt],[data-pw-cart-added-popup]'))
}

export function PartnerSitePwaInstallPromptModal({ siteSlug, shopTitle, locale }: Props) {
  const copy = PWA_INSTALL_PROMPT_COPY[locale]
  const { authResolved, isAuthenticated } = usePartnerSiteGuestSession(siteSlug)
  const { deferredInstall, isStandalone, isIos, promptInstall } = usePartnerPwaInstall()
  const titleId = useId()
  const descId = useId()
  const [ready, setReady] = useState(false)
  const [release, setRelease] = useState(false)
  const [open, setOpen] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setReady(true)
  }, [])

  useEffect(() => {
    if (deferredInstall) clearPartnerSitePwaRememberedInstalled(siteSlug)
  }, [deferredInstall, siteSlug])

  useEffect(() => {
    if (!ready || !authResolved) return
    if (typeof window === 'undefined') return
    if (isPartnerSiteShopLoginPath(window.location.pathname)) return
    if (shouldPartnerSiteShopSkipAuthSync(siteSlug) || !isAuthenticated) return
    if (!isPartnerSiteFreshLoginSession(siteSlug)) {
      setRelease(true)
      return
    }
    const onSettled = () => setRelease(true)
    window.addEventListener(PW_BIRTH_GENDER_PROMPT_SETTLED_EVENT, onSettled)
    return () => window.removeEventListener(PW_BIRTH_GENDER_PROMPT_SETTLED_EVENT, onSettled)
  }, [authResolved, isAuthenticated, ready, siteSlug])

  const close = useCallback(() => {
    setOpen(false)
    document.body.style.overflow = ''
  }, [])

  const dismiss = useCallback(() => {
    dismissPartnerSitePwaInstallPrompt(siteSlug)
    close()
  }, [close, siteSlug])

  useEffect(() => {
    if (!release || open) return
    if (typeof window === 'undefined') return
    let cancelled = false
    let timer = 0
    let obs: MutationObserver | null = null
    const offer = () =>
      shouldOfferPartnerPwaInstallPrompt({
        pending: isPartnerSitePwaInstallPromptPending(siteSlug),
        dismissed: isPartnerSitePwaInstallPromptDismissed(siteSlug),
        standalone: isStandalone,
        loginPath: isPartnerSiteShopLoginPath(window.location.pathname),
        editor: document.body.classList.contains('nanoai-ve-active'),
        authenticated: isAuthenticated && !shouldPartnerSiteShopSkipAuthSync(siteSlug),
        rememberedInstalled: isPartnerSitePwaRememberedInstalled(siteSlug),
        nativePromptReady: Boolean(deferredInstall),
        blockedByOtherPrompt: otherPromptOpen(),
      })

    const tryOpen = () => {
      if (cancelled) return
      obs?.disconnect()
      if (otherPromptOpen()) {
        obs = new MutationObserver(() => {
          if (!otherPromptOpen()) tryOpen()
        })
        obs.observe(document.body, { childList: true, subtree: true })
        return
      }
      timer = window.setTimeout(() => {
        if (cancelled) return
        if (otherPromptOpen()) {
          tryOpen()
          return
        }
        if (!offer()) return
        if (!claimPartnerPwaInstallPrompt()) return
        clearPartnerSitePwaInstallPromptPending(siteSlug)
        setFailed(false)
        setOpen(true)
      }, 400)
    }

    if (isStandalone) {
      markPartnerSitePwaInstalled(siteSlug)
      return
    }
    tryOpen()
    return () => {
      cancelled = true
      window.clearTimeout(timer)
      obs?.disconnect()
    }
  }, [deferredInstall, isAuthenticated, isStandalone, open, release, siteSlug])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') dismiss()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [dismiss, open])

  const onInstall = async () => {
    setFailed(false)
    const outcome = await promptInstall()
    if (outcome === 'accepted') {
      markPartnerSitePwaInstalled(siteSlug)
      close()
      return
    }
    if (outcome === 'failed') {
      setFailed(true)
      return
    }
    dismiss()
  }

  if (!ready || !open || typeof document === 'undefined') return null

  const nativeReady = Boolean(deferredInstall) && !isIos
  const tip = isIos ? copy.iosTip : nativeReady ? '' : copy.manualTip
  const lead = pwaInstallPromptLead(locale, shopTitle)

  return createPortal(
    <div
      id="pw-pwa-install-prompt"
      data-pw-pwa-install-prompt="1"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descId}
    >
      <button type="button" data-pw-pwa-install-backdrop aria-label={copy.close} onClick={dismiss} />
      <div data-pw-pwa-install-card>
        <h2 data-pw-pwa-install-title id={titleId}>
          {copy.title}
        </h2>
        <p data-pw-pwa-install-lead id={descId}>
          {lead}
        </p>
        {tip ? <p data-pw-pwa-install-tip>{tip}</p> : null}
        {failed ? <p data-pw-pwa-install-error>{copy.failed}</p> : null}
        <div data-pw-pwa-install-actions>
          <button type="button" data-pw-pwa-install-later onClick={dismiss}>
            {copy.later}
          </button>
          {nativeReady ? (
            <button type="button" data-pw-pwa-install-go onClick={() => void onInstall()}>
              {copy.install}
            </button>
          ) : null}
        </div>
      </div>
    </div>,
    document.body
  )
}
