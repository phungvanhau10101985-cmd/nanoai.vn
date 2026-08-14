export type MessagingSettingsOperationsSection = 'hub-notifications' | 'hub-marketing' | 'hub-orders'

export function messagingSettingsSectionHref(
  section: MessagingSettingsOperationsSection,
  partnerId?: string
): string {
  const q = new URLSearchParams()
  q.set('section', section)
  const partner = partnerId?.trim() || ''
  if (partner) q.set('partner', partner)
  return `/dashboard/messaging/settings?${q.toString()}`
}
