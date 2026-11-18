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

// Bản tạo khách thấy được. Không gồm ví, thanh toán, OTP, hay bảng dùng chung.
export const MERGE_TARGETS: readonly MergeTarget[] = [
  { table: 'try_on_history', column: 'user_id' },
  { table: 'translate_jobs', column: 'user_id' },
  { table: 'worksheet_jobs', column: 'user_id' },
  { table: 'worksheet_worksheets', column: 'user_id' },
  { table: 'worksheet_questions', column: 'user_id' },
  { table: 'worksheet_slides', column: 'user_id' },
  { table: 'worksheet_slides_original', column: 'user_id' },
  { table: 'worksheet_curricula', column: 'user_id' },
  { table: 'user_customized_slides_history', column: 'user_id' },
  { table: 'meeting_recordings', column: 'user_id' },
  { table: 'hub_chat_threads', column: 'user_id' },
  { table: 'hub_multi_task_plans', column: 'user_id' },
  { table: 'hub_landing_page_shares', column: 'user_id' },
  { table: 'packaging_mockup_shares', column: 'user_id' },
  { table: 'wedding_cards', column: 'user_id' },
  { table: 'wedding_card_ai_images', column: 'user_id' },
  { table: 'wedding_card_reviews', column: 'user_id' },
  { table: 'house_build_projects', column: 'user_id' },
  { table: 'music_generations', column: 'user_id' },
  { table: 'user_catalog_photo_jobs', column: 'user_id' },
  { table: 'homework_sessions', column: 'user_id' },
  { table: 'homework_messages', column: 'user_id' },
  { table: 'language_coach_messages', column: 'user_id' },
  { table: 'language_coach_session_memories', column: 'user_id' },
  { table: 'language_coach_completed_lessons', column: 'user_id' },
  { table: 'language_coach_ended_sessions', column: 'user_id' },
  { table: 'language_coach_hidden_sessions', column: 'user_id' },
  { table: 'language_coach_assessments', column: 'user_id' },
  { table: 'language_coach_custom_topics', column: 'user_id' },
  { table: 'language_coach_learning_goals', column: 'user_id' },
  { table: 'language_coach_progress_daily', column: 'user_id' },
  { table: 'language_coach_review_queue', column: 'user_id' },
  { table: 'language_coach_daily_words', column: 'user_id' },
  { table: 'language_coach_tokenizations', column: 'user_id' },
  { table: 'language_coach_turn_diagnostics', column: 'user_id' },
  { table: 'language_coach_live_lesson_purchases', column: 'user_id' },
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

async function runMergeStep(
  client: import('pg').PoolClient,
  step: number,
  run: () => Promise<void>,
  label: string
): Promise<void> {
  const savepoint = `guest_merge_${step}`
  await client.query(`SAVEPOINT ${savepoint}`)
  try {
    await run()
    await client.query(`RELEASE SAVEPOINT ${savepoint}`)
  } catch (tableErr) {
    await client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`)
    await client.query(`RELEASE SAVEPOINT ${savepoint}`)
    console.warn('[guest-trial-merge] skip table due to constraint/error', {
      table: label,
      error: tableErr instanceof Error ? tableErr.message : String(tableErr),
    })
  }
}

async function mergeTutorSessions(
  client: import('pg').PoolClient,
  realUserId: string,
  guestUserId: string
): Promise<void> {
  await client.query(
    `update public.tutor_messages m
     set user_id = $1::uuid,
         session_id = real.id
     from public.tutor_sessions real
     where m.user_id = $2::uuid
       and real.user_id = $1::uuid`,
    [realUserId, guestUserId]
  )
  await client.query(
    `delete from public.tutor_sessions guest
     where guest.user_id = $2::uuid
       and exists (select 1 from public.tutor_sessions real where real.user_id = $1::uuid)`,
    [realUserId, guestUserId]
  )
  await client.query(`update public.tutor_sessions set user_id = $1::uuid where user_id = $2::uuid`, [
    realUserId,
    guestUserId,
  ])
  await client.query(`update public.tutor_messages set user_id = $1::uuid where user_id = $2::uuid`, [
    realUserId,
    guestUserId,
  ])
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

    for (let i = 0; i < MERGE_TARGETS.length; i += 1) {
      const target = MERGE_TARGETS[i]
      if (!target) continue
      const table = quoteIdent(target.table)
      const col = quoteIdent(target.column)
      await runMergeStep(client, i, async () => {
        await client.query(`update public.${table} set ${col} = $1::uuid where ${col} = $2::uuid`, [
          realUserId,
          guestUserId,
        ])
      }, target.table)
    }

    await runMergeStep(client, 800, async () => {
      await client.query(
        `insert into public.user_opened_curricula (
           user_id, curriculum_id, opened_at, opened_source, opened_source_detail
         )
         select $1::uuid, g.curriculum_id, g.opened_at, g.opened_source, g.opened_source_detail
         from public.user_opened_curricula g
         where g.user_id = $2::uuid
         on conflict (user_id, curriculum_id) do update set
           opened_source = case
             when user_opened_curricula.opened_source = '' then excluded.opened_source
             else user_opened_curricula.opened_source
           end,
           opened_source_detail = case
             when user_opened_curricula.opened_source = '' then excluded.opened_source_detail
             else user_opened_curricula.opened_source_detail
           end`,
        [realUserId, guestUserId]
      )
      await client.query(`delete from public.user_opened_curricula where user_id = $2::uuid`, [guestUserId])
    }, 'user_opened_curricula')

    await runMergeStep(client, 801, () => mergeTutorSessions(client, realUserId, guestUserId), 'tutor_sessions')

    await runMergeStep(client, 802, async () => {
      await client.query(
        `update public.language_coach_live_lessons
         set source_user_id = $1::uuid
         where source_user_id = $2::uuid`,
        [realUserId, guestUserId]
      )
    }, 'language_coach_live_lessons')

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
