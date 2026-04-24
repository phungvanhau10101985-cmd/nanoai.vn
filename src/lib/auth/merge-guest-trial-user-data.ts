import type { NextResponse } from 'next/server'
import { getPgPool, isPgConfigured } from '@/lib/db/pool'
import { isValidUuidString } from '@/lib/validate-uuid'

type MergeInput = {
  guestTrialUserId: string | null | undefined
  realUserId: string
  response?: NextResponse
}

type MergeTarget = {
  table: string
  column: 'user_id' | 'created_by' | 'owner_user_id'
}

// Explicit whitelist: migrate only high-value, user-visible outputs from trial.
const MERGE_TARGETS: readonly MergeTarget[] = [
  // Image/tool outputs shown in user history/dashboard
  { table: 'try_on_history', column: 'user_id' },
  { table: 'translate_jobs', column: 'user_id' },

  // Long-running worksheet jobs and authored worksheet data
  { table: 'worksheet_jobs', column: 'user_id' },
  { table: 'worksheet_worksheets', column: 'user_id' },
  { table: 'worksheet_questions', column: 'user_id' },
  { table: 'worksheet_slides', column: 'user_id' },
  { table: 'worksheet_slides_original', column: 'user_id' },
  { table: 'worksheet_curricula', column: 'user_id' },

  // Meeting report recordings created by the user
  { table: 'meeting_recordings', column: 'user_id' },
]

function normalizeUuid(value: string | null | undefined): string | null {
  const raw = String(value ?? '').trim()
  if (!isValidUuidString(raw)) return null
  return raw
}

function clearGuestTrialCookies(response: NextResponse): void {
  const base = {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  }
  response.cookies.set('nano_guest_trial_user_id', '', base)
  response.cookies.set('nano_guest_trial_id', '', base)
  response.cookies.set('nano_guest_trial_used_credits', '', base)
}

function quoteIdent(ident: string): string {
  return `"${ident.replace(/"/g, '""')}"`
}

async function mergeCredits(client: import('pg').PoolClient, realUserId: string, guestUserId: string): Promise<void> {
  await client.query(
    `with guest_credit as (
       select coalesce(balance, 0)::numeric as balance
       from public.credits
       where user_id = $1::uuid
       limit 1
     ),
     merged as (
       insert into public.credits (user_id, balance)
       select $2::uuid, gc.balance
       from guest_credit gc
       on conflict (user_id) do update
         set balance = public.credits.balance + excluded.balance
     )
     delete from public.credits
     where user_id = $1::uuid`,
    [guestUserId, realUserId]
  )
}

export async function mergeGuestTrialUserDataAfterLogin(input: MergeInput): Promise<void> {
  if (!isPgConfigured()) return
  const realUserId = normalizeUuid(input.realUserId)
  const guestUserId = normalizeUuid(input.guestTrialUserId)
  if (!realUserId || !guestUserId) return
  if (realUserId === guestUserId) return

  const pool = getPgPool()
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const guestCheck = await client.query<{ ok: number }>(
      `select 1 as ok
       from auth.users
       where id = $1::uuid
         and lower(coalesce(email, '')) like 'guest-trial-%@guest.nanoai.local'
       limit 1`,
      [guestUserId]
    )
    if (guestCheck.rowCount === 0) {
      await client.query('ROLLBACK')
      return
    }

    await mergeCredits(client, realUserId, guestUserId)

    for (const target of MERGE_TARGETS) {
      const table = quoteIdent(target.table)
      const col = quoteIdent(target.column)
      try {
        await client.query(`update public.${table} set ${col} = $1::uuid where ${col} = $2::uuid`, [
          realUserId,
          guestUserId,
        ])
      } catch (tableErr) {
        console.warn('[guest-trial-merge] skip table due to constraint/error', {
          table: target.table,
          column: target.column,
          error: tableErr instanceof Error ? tableErr.message : String(tableErr),
        })
      }
    }

    await client.query('COMMIT')
    if (input.response) clearGuestTrialCookies(input.response)
  } catch (e) {
    try {
      await client.query('ROLLBACK')
    } catch {
      // noop
    }
    console.warn('[guest-trial-merge] failed', e)
  } finally {
    client.release()
  }
}
