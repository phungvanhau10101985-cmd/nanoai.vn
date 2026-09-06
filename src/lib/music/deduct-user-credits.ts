import { getPgPool, isPgConfigured } from '@/lib/db/pool'
import {
  consumeGuestCreditTrialUse,
  isGuestTrialUser,
} from '@/lib/guest-credit-trial'

const toTenths = (value: number) => Math.round(value * 10)
const fromTenths = (value: number) => value / 10

export type DeductCreditsResult =
  | { ok: true; charged: number; balance: number }
  | { ok: false; error: string; code?: 'INSUFFICIENT_CREDITS' }

function normalizeSpendFeature(feature: string): string {
  const t = String(feature || '').trim()
  return t || 'unknown'
}

function isUndefinedTableError(e: unknown): boolean {
  return Boolean(e && typeof e === 'object' && 'code' in e && String((e as { code?: string }).code) === '42P01')
}

async function insertSpendEvent(
  client: { query: (sql: string, params?: unknown[]) => Promise<unknown> },
  userId: string,
  feature: string,
  amount: number,
  source: 'deduct' | 'refund'
): Promise<void> {
  await client.query('SAVEPOINT spend_ledger')
  try {
    await client.query(
      `insert into public.credit_spend_events (user_id, feature, amount, source)
       values ($1::uuid, $2, $3::numeric, $4)`,
      [userId, feature, amount, source]
    )
  } catch (e) {
    await client.query('ROLLBACK TO SAVEPOINT spend_ledger')
    if (isUndefinedTableError(e)) {
      console.warn('[credit_spend_events] bảng chưa có — bỏ qua nhật ký đến khi chạy migration')
      return
    }
    throw e
  }
}

async function deductUserCreditsPg(
  userId: string,
  cost: number,
  feature: string
): Promise<DeductCreditsResult> {
  const pool = getPgPool()
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const { rows } = await client.query<{ balance: string }>(
      'select balance from public.credits where user_id = $1::uuid for update',
      [userId]
    )
    const row = rows[0]
    if (!row || row.balance == null) {
      await client.query('ROLLBACK')
      return { ok: false, error: 'Không đọc được số dư credits.' }
    }
    const bal = Number(row.balance)
    if (!Number.isFinite(bal)) {
      await client.query('ROLLBACK')
      return { ok: false, error: 'Không đọc được số dư credits.' }
    }
    if (toTenths(bal) < toTenths(cost)) {
      await client.query('ROLLBACK')
      return { ok: false, error: 'Không đủ credits.', code: 'INSUFFICIENT_CREDITS' }
    }
    const newBalance = fromTenths(toTenths(bal) - toTenths(cost))
    const up = await client.query(
      'update public.credits set balance = $1, updated_at = now() where user_id = $2::uuid',
      [newBalance, userId]
    )
    if (up.rowCount === 0) {
      await client.query('ROLLBACK')
      return { ok: false, error: 'Không trừ được credits.' }
    }
    await insertSpendEvent(client, userId, feature, cost, 'deduct')
    await client.query('COMMIT')
    return { ok: true, charged: cost, balance: newBalance }
  } catch (e) {
    try {
      await client.query('ROLLBACK')
    } catch {
      /* ignore */
    }
    throw e
  } finally {
    client.release()
  }
}

async function refundUserCreditsPg(userId: string, amount: number, feature: string): Promise<void> {
  const pool = getPgPool()
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const { rows } = await client.query<{ balance: string }>(
      'select balance from public.credits where user_id = $1::uuid for update',
      [userId]
    )
    const row = rows[0]
    if (!row || row.balance == null) {
      await client.query('ROLLBACK')
      return
    }
    const bal = Number(row.balance)
    if (!Number.isFinite(bal)) {
      await client.query('ROLLBACK')
      return
    }
    const newBalance = fromTenths(toTenths(bal) + toTenths(amount))
    await client.query(
      'update public.credits set balance = $1, updated_at = now() where user_id = $2::uuid',
      [newBalance, userId]
    )
    await insertSpendEvent(client, userId, feature, -amount, 'refund')
    await client.query('COMMIT')
  } catch (e) {
    try {
      await client.query('ROLLBACK')
    } catch {
      /* ignore */
    }
    throw e
  } finally {
    client.release()
  }
}

/**
 * Trừ credits (atomic) — chỉ Postgres qua DATABASE_URL.
 * `feature` ghi nhật ký thống kê admin (`credit_spend_events`).
 */
export async function deductUserCredits(
  userId: string,
  cost: number,
  feature: string
): Promise<DeductCreditsResult> {
  if (!Number.isFinite(cost) || cost <= 0) {
    return { ok: true, charged: 0, balance: 0 }
  }

  if (await isGuestTrialUser(userId)) {
    const trial = await consumeGuestCreditTrialUse({ amount: cost })
    if (!trial.ok) {
      return { ok: false, error: 'Bạn đã dùng hết 3 credits dùng thử.', code: 'INSUFFICIENT_CREDITS' }
    }
    return { ok: true, charged: 0, balance: trial.remaining }
  }

  if (!isPgConfigured()) {
    return {
      ok: false,
      error: 'Credits: cần DATABASE_URL (Postgres).',
    }
  }

  return await deductUserCreditsPg(userId, cost, normalizeSpendFeature(feature))
}

export async function refundUserCredits(userId: string, amount: number, feature = 'unknown'): Promise<void> {
  if (!Number.isFinite(amount) || amount <= 0) return

  if (!isPgConfigured()) {
    console.warn('[refundUserCredits] DATABASE_URL not set, bỏ qua hoàn credits')
    return
  }

  await refundUserCreditsPg(userId, amount, normalizeSpendFeature(feature))
}
