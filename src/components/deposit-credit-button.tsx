"use client"

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { useDepositCredit } from './deposit-credit-context'
import { DepositCreditPopup } from './deposit-credit-popup'
import { PlusCircle } from 'lucide-react'
import { trackEvent, toFeatureFromRoute } from '@/lib/analytics-track'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { DEFAULT_WEB_LOCALE } from '@/lib/i18n/config'
import { readWebLocaleFromDocumentCookie } from '@/lib/i18n/read-web-locale-cookie'
import { getClientUserId } from '@/lib/auth/get-client-user-id'
import { sanitizeLoginNext } from '@/lib/auth/sanitize-login-next'

interface DepositCreditButtonProps {
  variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'link' | 'destructive'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  className?: string
  onCreditsUpdated?: () => void
}

/** Không dùng `usePathname` — tránh Next chèn `<input>` / lỗi hydrate; route lấy lúc click. */
export function DepositCreditButton({ variant = 'default', size = 'sm', className, onCreditsUpdated }: DepositCreditButtonProps) {
  const ctx = useDepositCredit()
  const [localOpen, setLocalOpen] = useState(false)
  const [topUpLabel, setTopUpLabel] = useState(() => getDictionary(DEFAULT_WEB_LOCALE).menu.topUpCredits)
  const openPopup = ctx?.openPopup ?? (() => setLocalOpen(true))

  useEffect(() => {
    setTopUpLabel(getDictionary(readWebLocaleFromDocumentCookie()).menu.topUpCredits)
  }, [])

  const handleClick = async () => {
    const pathname = typeof window !== 'undefined' ? window.location.pathname || '' : ''
    const search = typeof window !== 'undefined' ? window.location.search || '' : ''
    const current = `${pathname || '/'}${search}`
    trackEvent('topup_click', {
      route: pathname,
      feature: pathname ? toFeatureFromRoute(pathname) : 'unknown',
      source: 'deposit_credit_button',
    })
    const userId = await getClientUserId()
    if (!userId && typeof window !== 'undefined') {
      trackEvent('topup_require_login', {
        route: pathname,
        feature: pathname ? toFeatureFromRoute(pathname) : 'unknown',
        source: 'deposit_credit_button',
      })
      const loginHref = `/auth/login?next=${encodeURIComponent(sanitizeLoginNext(current))}`
      window.location.href = loginHref
      return
    }
    if (onCreditsUpdated) {
      window.addEventListener('credits-updated', onCreditsUpdated, { once: true })
    }
    openPopup()
  }

  return (
    <>
      <Button variant={variant} size={size} className={className} onClick={handleClick} type="button">
        <PlusCircle className="mr-2 h-4 w-4" />
        {topUpLabel}
      </Button>
      {!ctx && (
        <DepositCreditPopup
          open={localOpen}
          onOpenChange={setLocalOpen}
          onCreditsUpdated={onCreditsUpdated}
        />
      )}
    </>
  )
}
