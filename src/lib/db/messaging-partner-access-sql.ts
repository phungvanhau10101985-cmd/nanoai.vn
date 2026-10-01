/**
 * Mảnh SQL tái dùng: chủ workspace HOẶC nhân viên có quyền JSON `permKey`.
 * `mp` = alias của public.messaging_partners đã JOIN sẵn với đơn hàng hoặc bảng khác.
 */

import type { PartnerStaffPermKey } from '@/lib/messaging/partner-staff-permissions'

function sqlMemberPermMatch(permKey: string, legacy?: { parentKey: string; markerKey: string }): string {
  const exact = `COALESCE((_pms.permissions ->> '${permKey}')::boolean, false)`
  if (!legacy) return exact
  return `(${exact} OR (COALESCE((_pms.permissions ->> '${legacy.parentKey}')::boolean, false) AND NOT (_pms.permissions ? '${legacy.markerKey}')))`
}

export function sqlPartnerMpActorHasPerm(
  actorParamSlot: number,
  permKey: PartnerStaffPermKey,
  legacy?: { parentKey: string; markerKey: string }
): string {
  return `(
    mp.owner_user_id = $${actorParamSlot}::uuid
    OR EXISTS (
      SELECT 1
      FROM public.messaging_partner_members _pms
      WHERE _pms.partner_id = mp.id
        AND _pms.member_user_id = $${actorParamSlot}::uuid
        AND ${sqlMemberPermMatch(permKey, legacy)}
    )
  )`
}

/** UPDATE public.messaging_partners … WHERE id = … AND (…) — không alias bảng. */
export function sqlMessagingPartnersRowActorHasPerm(actorParamSlot: number, permKey: PartnerStaffPermKey): string {
  return `(
    owner_user_id = $${actorParamSlot}::uuid
    OR EXISTS (
      SELECT 1
      FROM public.messaging_partner_members _pms_row
      WHERE _pms_row.partner_id = messaging_partners.id
        AND _pms_row.member_user_id = $${actorParamSlot}::uuid
        AND COALESCE((_pms_row.permissions ->> '${permKey}')::boolean, false)
    )
  )`
}

