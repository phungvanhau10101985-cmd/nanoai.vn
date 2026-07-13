'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function MarketingPageNavButtons({
  goToInboxLabel,
  settingsLabel,
}: {
  goToInboxLabel: string
  settingsLabel: string
}) {
  const searchParams = useSearchParams()
  const partner = searchParams.get('partner')?.trim() ?? ''
  const partnerQuery = partner ? `?partner=${encodeURIComponent(partner)}` : ''

  const linkClass = cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'h-8 text-xs')

  return (
    <div className="relative z-10 flex shrink-0 flex-wrap gap-2">
      <Link href={`/dashboard/messaging/inbox${partnerQuery}`} className={linkClass}>
        {goToInboxLabel}
      </Link>
      <Link href={`/dashboard/messaging/settings${partnerQuery}`} className={linkClass}>
        {settingsLabel}
      </Link>
    </div>
  )
}
