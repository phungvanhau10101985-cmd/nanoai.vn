import { isPgConfigured } from '@/lib/db/pool'
import { pgQueryOne } from '@/lib/db/pg-query'

/**
 * Gọi `public.claim_referral_bonus_server` (security definer) — cần role DB có quyền EXECUTE
 * (ví dụ cùng quyền role `service_role` trên DB).
 */
export async function claimReferralBonusServerPg(
  inviterId: string,
  inviteeId: string
): Promise<Record<string, unknown> | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<{ result: unknown }>(
      `select public.claim_referral_bonus_server($1::uuid, $2::uuid) as result`,
      [inviterId, inviteeId]
    )
    const v = row?.result
    if (v != null && typeof v === 'object' && !Array.isArray(v)) {
      return v as Record<string, unknown>
    }
    return null
  } catch (e) {
    console.error('[referral-claim-pg] claimReferralBonusServerPg', e)
    return null
  }
}
