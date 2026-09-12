export type MessagingSettingsOperationsSection =
  | 'hub-notifications'
  | 'hub-marketing'
  | 'hub-orders'
  | 'hub-email'
  | 'hub-ems'

export function messagingSettingsSectionHref(
  section: MessagingSettingsOperationsSection,
  partnerId?: string,
  extra?: { q?: string }
): string {
  const q = new URLSearchParams()
  q.set('section', section)
  const partner = partnerId?.trim() || ''
  if (partner) q.set('partner', partner)
  const search = extra?.q?.trim() || ''
  if (search) q.set('q', search)
  return `/dashboard/messaging/settings?${q.toString()}`
}
