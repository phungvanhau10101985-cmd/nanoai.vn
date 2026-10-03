'use client'

import type { WebLocale } from '@/lib/i18n/config'
import { PartnerAffiliateOpsCard } from '@/components/partner-website/partner-affiliate-ops-card'
import { PartnerSaleAdvancedSettingsCard } from '@/components/partner-website/partner-sale-advanced-settings-card'

export function PartnerAffiliateAdminPanel(props: {
  partnerId: string
  locale: WebLocale
  onToast?: (message: string, variant?: 'default' | 'destructive') => void
}) {
  return (
    <div className="space-y-4">
      <PartnerSaleAdvancedSettingsCard
        partnerId={props.partnerId}
        locale={props.locale}
        part="affiliate"
        onToast={props.onToast}
      />
      <PartnerAffiliateOpsCard
        partnerId={props.partnerId}
        locale={props.locale}
        onToast={props.onToast}
      />
    </div>
  )
}
