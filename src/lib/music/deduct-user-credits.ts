import { createClient as createSupabaseClient } from '@supabase/supabase-js'

const toTenths = (value: number) => Math.round(value * 10)
const fromTenths = (value: number) => value / 10

export type DeductCreditsResult =
  | { ok: true; charged: number; balance: number }
  | { ok: false; error: string; code?: 'INSUFFICIENT_CREDITS' }

/**
 * Trừ credits (một lần), dùng service role. Dùng cho API tạo nhạc Lyria 3.
 */
export async function deductUserCredits(userId: string, cost: number): Promise<DeductCreditsResult> {
  if (!Number.isFinite(cost) || cost <= 0) {
    return { ok: true, charged: 0, balance: 0 }
  }

  const adminSupabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: creditData, error: creditError } = await adminSupabase
    .from('credits')
    .select('balance')
    .eq('user_id', userId)
    .single()

  if (creditError || !creditData) {
    return { ok: false, error: 'Không đọc được số dư credits.' }
  }
  if (toTenths(creditData.balance) < toTenths(cost)) {
    return { ok: false, error: 'Không đủ credits.', code: 'INSUFFICIENT_CREDITS' }
  }

  const newBalance = fromTenths(toTenths(creditData.balance) - toTenths(cost))
  const { error: updateError } = await adminSupabase.from('credits').update({ balance: newBalance }).eq('user_id', userId)

  if (updateError) {
    return { ok: false, error: 'Không trừ được credits.' }
  }

  return { ok: true, charged: cost, balance: newBalance }
}

export async function refundUserCredits(userId: string, amount: number): Promise<void> {
  if (!Number.isFinite(amount) || amount <= 0) return
  const adminSupabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const { data: creditData } = await adminSupabase.from('credits').select('balance').eq('user_id', userId).single()
  if (!creditData) return
  const newBalance = fromTenths(toTenths(creditData.balance) + toTenths(amount))
  await adminSupabase.from('credits').update({ balance: newBalance }).eq('user_id', userId)
}
