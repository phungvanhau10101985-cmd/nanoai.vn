import { Globe } from 'lucide-react'
import type { ReactNode } from 'react'
import { MessagingDashboardNavLinks } from '@/app/dashboard/messaging/messaging-dashboard-nav-links'

type Props = {
  title: string
  description?: string
  inboxLabel: string
  settingsLabel: string
  marketingLabel: string
  ordersLabel: string
  websiteLabel: string
  partnerId?: string
  partnerSlug?: string
  children: ReactNode
}

export function PartnerWebsiteDashboardShell({
  title,
  description,
  inboxLabel,
  settingsLabel,
  marketingLabel,
  ordersLabel,
  websiteLabel,
  partnerId,
  partnerSlug,
  children,
}: Props) {
  return (
    <div className="app-shell flex min-h-[calc(100dvh-5rem)] flex-col space-y-4 md:space-y-5">
      <div className="section-surface sticky top-[var(--site-header-height,3rem)] z-40 flex flex-col gap-3 border-b border-border/60 bg-card/95 pb-3 backdrop-blur-md md:top-[var(--site-header-height,3.5rem)] md:flex-row md:items-start md:justify-between md:pb-4">
        <div className="min-w-0 flex-1">
          <h1 className="flex min-w-0 items-center gap-2 text-lg font-semibold tracking-tight sm:text-xl">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400">
              <Globe className="h-4 w-4" aria-hidden />
            </span>
            <span className="leading-snug">{title}</span>
          </h1>
          {description ? (
            <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">{description}</p>
          ) : null}
        </div>
        <MessagingDashboardNavLinks
          inboxLabel={inboxLabel}
          settingsLabel={settingsLabel}
          marketingLabel={marketingLabel}
          ordersLabel={ordersLabel}
          websiteLabel={websiteLabel}
          active="website"
          partnerId={partnerId}
          partnerSlug={partnerSlug}
        />
      </div>
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  )
}
