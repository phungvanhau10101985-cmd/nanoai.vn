import { getPgPool, isPgConfigured } from '@/lib/db/pool'

export async function insertPendingDepositTransaction(input: {
  userId: string
  amount: number
  description: string
}): Promise<{ id: string } | { error: string }> {
  if (!isPgConfigured()) {
    return { error: 'database_not_configured' }
  }
  try {
    const pool = getPgPool()
    const res = await pool.query<{ id: string }>(
      `insert into public.transactions (user_id, amount, type, status, description)
       values ($1::uuid, $2::int, 'deposit', 'pending', $3)
       returning id::text`,
      [input.userId, input.amount, input.description]
    )
    const id = res.rows[0]?.id
    if (!id) return { error: 'insert_failed' }
    return { id }
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}
