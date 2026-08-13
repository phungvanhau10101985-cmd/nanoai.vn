'use client'

import Link from 'next/link'
import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type NavKey = 'inbox' | 'settings' | 'orders' | 'analytics'

type Props = {
  inboxLabel: string
  settingsLabel: string
  ordersLabel: string
  analyticsLabel: string
  active?: NavKey
  /** When set, preserves partner context in nav links. */
  partnerId?: string
}

function MessagingDashboardNavLinksInner({
  inboxLabel,
  settingsLabel,
  ordersLabel,
  analyticsLabel,
  active,
  partnerId: partnerIdProp,
}: Props) {
  const searchParams = useSearchParams()
  const partner = partnerIdProp?.trim() || searchParams.get('partner')?.trim() || ''
  const partnerQuery = partner ? `?partner=${encodeURIComponent(partner)}` : ''

  const itemClass = (key: NavKey) =>
    cn(
      buttonVariants({ variant: key === active ? 'default' : 'outline', size: 'sm' }),
      'relative z-[60] h-8 text-xs pointer-events-auto'
    )

  const items: Array<{ key: NavKey; href: string; label: string }> = [
    { key: 'inbox', href: `/dashboard/messaging/inbox${partnerQuery}`, label: inboxLabel },
    { key: 'settings', href: `/dashboard/messaging/settings${partnerQuery}`, label: settingsLabel },
    { key: 'orders', href: `/dashboard/messaging/orders${partnerQuery}`, label: ordersLabel },
    { key: 'analytics', href: `/dashboard/messaging/analytics${partnerQuery}`, label: analyticsLabel },
  ]

  return (
    <nav
      className="relative z-[60] flex shrink-0 flex-wrap gap-2 pointer-events-auto"
      aria-label="Messaging dashboard"
    >
      {items
        .filter((item) => item.key !== active)
        .map((item) => (
          <Link key={item.key} href={item.href} className={itemClass(item.key)}>
            {item.label}
          </Link>
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
