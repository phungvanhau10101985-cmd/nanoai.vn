/**
 * Mảnh SQL tái dùng: chủ workspace HOẶC nhân viên có quyền JSON `permKey`.
 * `mp` = alias của public.messaging_partners đã JOIN sẵn với đơn hàng hoặc bảng khác.
 */

import type { PartnerStaffPermKey } from '@/lib/messaging/partner-staff-permissions'

export function sqlPartnerMpActorHasPerm(actorParamSlot: number, permKey: PartnerStaffPermKey): string {
  return `(
    mp.owner_user_id = $${actorParamSlot}::uuid
    OR EXISTS (
      SELECT 1
      FROM public.messaging_partner_members _pms
      WHERE _pms.partner_id = mp.id
        AND _pms.member_user_id = $${actorParamSlot}::uuid
        AND COALESCE((_pms.permissions ->> '${permKey}')::boolean, false)
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

