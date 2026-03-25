/**
 * Trừ credit cho tính năng giáo trình/phiếu khi **thật sự gọi AI**.
 * Quy tắc: đọc DB / cache trước — chỉ gọi spend khi pipeline AI chạy (không áp cho fromCache).
 *
 * @see CURRICULUM_CREDIT_RULES trong `@/app/tao-giao-trinh/lib/curriculum-credit-costs`
 */
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js'
import { CURRICULUM_UI_CREDITS } from '@/app/tao-giao-trinh/lib/curriculum-credit-costs'

export const CURRICULUM_AI_CHARGE_TYPES = {
  analyzeSlides: 'curriculum_analyze_slides',
} as const

/** Tắt trừ credit (local / debug): CURRICULUM_AI_CREDITS_DISABLED=1 */
export function isCurriculumAiCreditsDisabled(): boolean {
  const v = process.env.CURRICULUM_AI_CREDITS_DISABLED
  return v === '1' || v === 'true'
}

export function curriculumAiAdminClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createSupabaseClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

export async function readUserCreditBalance(admin: SupabaseClient, userId: string): Promise<number> {
  const { data, error } = await admin.from('credits').select('balance').eq('user_id', userId).maybeSingle()
  if (error) throw new Error(error.message || 'Không đọc được số dư credits.')
  return Number(data?.balance ?? 0)
}

export type SpendCurriculumAiResult = {
  ok: boolean
  alreadyApplied: boolean
  newBalance: number
  error: string
}

/**
 * Mỗi lần gọi AI thực sự dùng event_key **unique** (UUID) — không idempotent theo curriculum
 * để lần tạo slide sau (sau khi xóa DB) vẫn trừ đúng.
 */
export async function spendCurriculumAiCredits(
  admin: SupabaseClient,
  input: {
    userId: string
    amount: number
    chargeType: string
    eventKey: string
    metadata?: Record<string, unknown>
  }
): Promise<SpendCurriculumAiResult> {
  const { data, error } = await admin.rpc('spend_credits_idempotent', {
    p_user_id: input.userId,
    p_amount: input.amount,
    p_event_key: input.eventKey,
    p_charge_type: input.chargeType,
    p_session_id: null,
    p_metadata_json: JSON.stringify(input.metadata ?? {}),
  })
  if (error) throw new Error(error.message || 'Không thể trừ credits.')
  const row = Array.isArray(data) ? data[0] : data
  return {
    ok: Boolean(row?.ok),
    alreadyApplied: Boolean(row?.already_applied),
    newBalance: Number(row?.new_balance || 0),
    error: String(row?.error || '').trim(),
  }
}

export const ANALYZE_SLIDES_CREDIT_COST = CURRICULUM_UI_CREDITS.analyzeSlides
