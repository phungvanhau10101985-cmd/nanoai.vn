'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function MarketingPageNavButtons({
  goToInboxLabel,
  settingsLabel,
}: {
  goToInboxLabel: string
  settingsLabel: string
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const partner = searchParams.get('partner')?.trim() ?? ''
  const partnerQuery = partner ? `?partner=${encodeURIComponent(partner)}` : ''

  const buttonClass = cn(
    buttonVariants({ variant: 'outline', size: 'sm' }),
    'relative z-[60] h-8 text-xs pointer-events-auto'
  )

  const go = (href: string) => {
    router.push(href)
    // Fallback cho trường hợp router client chưa hydrate hoặc bị extension/lớp phủ chặn.
    window.setTimeout(() => {
      if (window.location.pathname + window.location.search !== href) {
        window.location.href = href
      }
    }, 120)
  }

  return (
    <div className="relative z-[60] flex shrink-0 flex-wrap gap-2 pointer-events-auto">
      <button
        type="button"
        className={buttonClass}
        onClick={() => go(`/dashboard/messaging/inbox${partnerQuery}`)}
      >
        {goToInboxLabel}
      </button>
      <button
        type="button"
        className={buttonClass}
        onClick={() => go(`/dashboard/messaging/settings${partnerQuery}`)}
      >
        {settingsLabel}
      </button>
    </div>
  )
}
