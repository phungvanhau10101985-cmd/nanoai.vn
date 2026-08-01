'use client'

import { Suspense, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { buttonVariants } from '@/components/ui/button'
import { partnerWebsiteDashboardPath } from '@/lib/partner-website/partner-website-dashboard-path'
import { cn } from '@/lib/utils'

type NavKey = 'inbox' | 'settings' | 'marketing' | 'orders' | 'website'

type Props = {
  inboxLabel: string
  settingsLabel: string
  marketingLabel: string
  ordersLabel: string
  websiteLabel: string
  active?: NavKey
  /** When set (e.g. slug-based website page), preserves partner context in nav links. */
  partnerId?: string
  partnerSlug?: string
}

function MessagingDashboardNavLinksInner({
  inboxLabel,
  settingsLabel,
  marketingLabel,
  ordersLabel,
  websiteLabel,
  active,
  partnerId: partnerIdProp,
  partnerSlug,
}: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const partner = partnerIdProp?.trim() || searchParams.get('partner')?.trim() || ''
  const partnerQuery = partner ? `?partner=${encodeURIComponent(partner)}` : ''
  const websiteHref = partnerSlug?.trim()
    ? partnerWebsiteDashboardPath(partnerSlug.trim())
    : `/dashboard/messaging/website${partnerQuery}`

  const go = useCallback(
    (href: string) => {
      router.push(href)
      // Fallback when client router is blocked (overlay / extension / slow hydrate).
      window.setTimeout(() => {
        const current = `${window.location.pathname}${window.location.search}`
        if (current !== href) {
          window.location.assign(href)
        }
      }, 120)
    },
    [router]
  )

  const itemClass = (key: NavKey) =>
    cn(
      buttonVariants({ variant: key === active ? 'default' : 'outline', size: 'sm' }),
      'relative z-[60] h-8 cursor-pointer text-xs pointer-events-auto'
    )

  const items: Array<{ key: NavKey; href: string; label: string }> = [
    { key: 'inbox', href: `/dashboard/messaging/inbox${partnerQuery}`, label: inboxLabel },
    { key: 'settings', href: `/dashboard/messaging/settings${partnerQuery}`, label: settingsLabel },
    { key: 'marketing', href: `/dashboard/messaging/marketing${partnerQuery}`, label: marketingLabel },
    { key: 'orders', href: `/dashboard/messaging/orders${partnerQuery}`, label: ordersLabel },
    { key: 'website', href: websiteHref, label: websiteLabel },
  ]

  return (
    <nav
      className="relative z-[60] flex shrink-0 flex-wrap gap-2 pointer-events-auto"
      aria-label="Messaging dashboard"
    >
      {items
        .filter((item) => item.key !== active)
        .map((item) => (
          <button
            key={item.key}
            type="button"
            className={itemClass(item.key)}
            onClick={() => go(item.href)}
          >
            {item.label}
          </button>
        ))}
    </nav>
  )
}

function NavFallback() {
  return <div className="h-8 w-40 animate-pulse rounded-md bg-muted/60" aria-hidden />
}

export function MessagingDashboardNavLinks(props: Props) {
  return (
    <Suspense fallback={<NavFallback />}>
      <MessagingDashboardNavLinksInner {...props} />
    </Suspense>
  )
}
