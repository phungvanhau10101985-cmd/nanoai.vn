/**
 * Credits — chỉ qua Postgres (`DATABASE_URL`). Không còn HTTP API / RPC công khai cho bảng `credits`.
 * Session đăng nhập do caller xử lý riêng.
 */
import { getPgPool, isPgConfigured } from '@/lib/db/pool'
import { pgQueryOne } from '@/lib/db/pg-query'
import {
  consumeGuestCreditTrialUse,
  getGuestCreditTrialRemainingCount,
  isGuestTrialUserId,
} from '@/lib/guest-credit-trial'

function requireCreditsPg(): void {
  if (!isPgConfigured()) {
    throw new Error(
      'Credits: cần DATABASE_URL (Postgres). Không đọc/ghi credits qua API HTTP cũ.'
    )
  }
}

/** Số dư hiện tại (0 nếu không có dòng). */
export async function getCreditBalanceByUserId(userId: string): Promise<number> {
  if (isGuestTrialUserId(userId)) {
    // Return actual remaining guest-trial credits so server prechecks can compare with required cost.
    return await getGuestCreditTrialRemainingCount()
  }
  requireCreditsPg()
  const row = await pgQueryOne<{ balance: unknown }>(
    'select balance from public.credits where user_id = $1::uuid limit 1',
    [userId]
  )
  if (row?.balance != null) {
    const n = Number(row.balance)
    return Number.isFinite(n) ? n : 0
  }
  return 0
}

export type SpendCreditsIdempotentResult = {
  ok: boolean
  alreadyApplied: boolean
  newBalance: number
  error: string
}

/**
 * Gọi `public.spend_credits_idempotent` — atomic + idempotent theo event_key (Postgres).
 */
export async function spendCreditsIdempotent(input: {
  userId: string
  amount: number
  eventKey: string
  chargeType: string
  sessionId?: string | null
  metadataJson?: string | null
}): Promise<SpendCreditsIdempotentResult> {
  if (isGuestTrialUserId(input.userId)) {
    const trial = await consumeGuestCreditTrialUse({
      amount: input.amount,
      eventKey: input.eventKey || undefined,
    })
    if (!trial.ok) {
      return {
        ok: false,
        alreadyApplied: trial.alreadyApplied,
        newBalance: 0,
        error: 'Bạn đã dùng hết 3 credits dùng thử. Vui lòng đăng nhập để tiếp tục.',
      }
    }
    return {
      ok: true,
      alreadyApplied: trial.alreadyApplied,
      newBalance: trial.remaining,
      error: '',
    }
  }
  requireCreditsPg()
  const pMeta = input.metadataJson ?? null
  const pool = getPgPool()
  const res = await pool.query<{
    ok: boolean
    already_applied: boolean
    new_balance: string | number | null
    error: string | null
  }>(
    `select ok, already_applied, new_balance, error
     from public.spend_credits_idempotent($1::uuid, $2::numeric, $3::text, $4::text, $5::uuid, $6::text)`,
    [
      input.userId,
      input.amount,
      input.eventKey,
      input.chargeType,
      input.sessionId ?? null,
      pMeta,
    ]
  )
  const row = res.rows[0]
  if (!row) throw new Error('spend_credits_idempotent returned no row')
  return {
    ok: Boolean(row.ok),
    alreadyApplied: Boolean(row.already_applied),
    newBalance: Number(row.new_balance ?? 0),
    error: String(row.error ?? '').trim(),
  }
}

/**
 * Ghi đè số dư (admin / fallback trừ tay). Tạo dòng nếu chưa có.
 */
export async function setUserCreditBalanceAbsolute(
  userId: string,
  newBalance: number
): Promise<{ ok: boolean; error?: string }> {
  if (!Number.isFinite(newBalance)) return { ok: false, error: 'invalid_balance' }
  requireCreditsPg()
  try {
    const pool = getPgPool()
    await pool.query(
      `insert into public.credits (user_id, balance) values ($1::uuid, $2::numeric)
       on conflict (user_id) do update set balance = excluded.balance`,
      [userId, newBalance]
    )
    return { ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, error: msg }
  }
}

/**
 * Cộng credits (nạp tiền / hoàn). Tạo dòng nếu chưa có.
 */
export async function addCreditsToUser(
  userId: string,
  amount: number
): Promise<{ ok: boolean; newBalance: number; error?: string }> {
  if (!Number.isFinite(amount) || amount <= 0) {
    try {
      const b = await getCreditBalanceByUserId(userId)
      return { ok: true, newBalance: b }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Không đọc được số dư.'
      return { ok: false, newBalance: 0, error: msg }
    }
  }

  requireCreditsPg()
  try {
    const pool = getPgPool()
    const res = await pool.query<{ balance: string | number | null }>(
      `insert into public.credits (user_id, balance) values ($1::uuid, $2::numeric)
       on conflict (user_id) do update set balance = public.credits.balance + excluded.balance
       returning balance`,
      [userId, amount]
    )
    const row = res.rows[0]
    const nb = row?.balance != null ? Number(row.balance) : 0
    return { ok: true, newBalance: Number.isFinite(nb) ? nb : 0 }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, newBalance: 0, error: msg }
  }
}
