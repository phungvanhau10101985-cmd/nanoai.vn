export type MessagingSettingsOperationsSection =
  | 'hub-notifications'
  | 'hub-marketing'
  | 'hub-orders'
  | 'hub-profit'
  | 'hub-ship-queue'
  | 'hub-email'
  | 'hub-ems'

export function messagingSettingsSectionHref(
  section: MessagingSettingsOperationsSection,
  partnerId?: string,
  extra?: { q?: string; open?: boolean }
): string {
  const q = new URLSearchParams()
  q.set('section', section)
  const partner = partnerId?.trim() || ''
  if (partner) q.set('partner', partner)
  const search = extra?.q?.trim() || ''
  if (search) q.set('q', search)
  if (extra?.open && search) q.set('open', '1')
  return `/dashboard/messaging/settings?${q.toString()}`
}
