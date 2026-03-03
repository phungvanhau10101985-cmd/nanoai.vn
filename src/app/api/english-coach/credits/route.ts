import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserForAction } from '@/lib/auth'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

const LIVE_SESSION_PRICE_CREDITS = 2.5
const LIVE_SESSION_EXTRA_STEP_PRICE_CREDITS = 1.25
const PRESET_SESSION_PRICE_CREDITS = 1
const LIVE_SESSION_BASE_TURN_LIMIT = 10
const LIVE_SESSION_EXTRA_TURN_STEP = 5

type Payload = {
  action?: 'status' | 'charge_live_start' | 'charge_live_unlock' | 'charge_preset_start'
  sessionId?: string
}

function adminClient() {
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

function asUuidOrEmpty(value: string): string {
  const v = String(value || '').trim()
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v) ? v : ''
}

async function hasEvent(adminSupabase: ReturnType<typeof adminClient>, userId: string, sessionId: string, chargeType: string) {
  const { count, error } = await adminSupabase
    .from('language_coach_credit_events')
    .select('id', { head: true, count: 'exact' })
    .eq('user_id', userId)
    .eq('session_id', sessionId)
    .eq('charge_type', chargeType)
  if (error) throw new Error(error.message || 'Không đọc được credit event.')
  return (count || 0) > 0
}

async function countEvents(adminSupabase: ReturnType<typeof adminClient>, userId: string, sessionId: string, chargeType: string) {
  const { count, error } = await adminSupabase
    .from('language_coach_credit_events')
    .select('id', { head: true, count: 'exact' })
    .eq('user_id', userId)
    .eq('session_id', sessionId)
    .eq('charge_type', chargeType)
  if (error) throw new Error(error.message || 'Không đọc được credit event count.')
  return count || 0
}

async function countStudentTurns(adminSupabase: ReturnType<typeof adminClient>, userId: string, sessionId: string) {
  const { count, error } = await adminSupabase
    .from('language_coach_messages')
    .select('id', { head: true, count: 'exact' })
    .eq('user_id', userId)
    .eq('session_id', sessionId)
    .eq('role', 'student')
  if (error) throw new Error(error.message || 'Không đọc được số lượt học viên.')
  return count || 0
}

async function readTurnsUsedFromSessionMemory(
  adminSupabase: ReturnType<typeof adminClient>,
  userId: string,
  sessionId: string
) {
  const { data, error } = await adminSupabase
    .from('language_coach_session_memories')
    .select('pinned_facts_json')
    .eq('user_id', userId)
    .eq('session_id', sessionId)
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message || 'Không đọc được session memory.')
  try {
    const root = JSON.parse(String(data?.pinned_facts_json || '{}')) as Record<string, unknown>
    const billing = root.lesson_credit_billing
    if (!billing || typeof billing !== 'object') return null
    const turnsUsed = Math.max(0, Math.floor(Number((billing as Record<string, unknown>).turnsUsed || 0) || 0))
    return turnsUsed
  } catch {
    return null
  }
}

async function chargeIdempotent(
  adminSupabase: ReturnType<typeof adminClient>,
  input: {
    userId: string
    amount: number
    eventKey: string
    chargeType: string
    sessionId: string
    metadata: Record<string, unknown>
  }
) {
  const { data, error } = await adminSupabase.rpc('spend_credits_idempotent', {
    p_user_id: input.userId,
    p_amount: input.amount,
    p_event_key: input.eventKey,
    p_charge_type: input.chargeType,
    p_session_id: input.sessionId,
    p_metadata_json: JSON.stringify(input.metadata || {}),
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

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as Payload
    const action = String(payload.action || '').trim()
    const sessionId = asUuidOrEmpty(String(payload.sessionId || '').trim())

    if (!action) return NextResponse.json({ error: 'Thiếu action.' }, { status: 400 })
    if (!sessionId) return NextResponse.json({ error: 'Thiếu hoặc sai sessionId.' }, { status: 400 })

    const supabase = createClient()
    const auth = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập để dùng credits.')
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })
    const { user } = auth
    const adminSupabase = adminClient()

    const liveStartCharged = await hasEvent(adminSupabase, user.id, sessionId, 'english_coach_live_start')
    const liveUnlockCount = await countEvents(adminSupabase, user.id, sessionId, 'english_coach_live_unlock')
    const turnsUsedFromMemory = await readTurnsUsedFromSessionMemory(adminSupabase, user.id, sessionId)
    const studentTurns = turnsUsedFromMemory ?? await countStudentTurns(adminSupabase, user.id, sessionId)
    const turnLimit = LIVE_SESSION_BASE_TURN_LIMIT + liveUnlockCount * LIVE_SESSION_EXTRA_TURN_STEP

    if (action === 'status') {
      return NextResponse.json({
        ok: true,
        sessionId,
        liveStartCharged,
        liveUnlockCount,
        studentTurns,
        turnLimit,
        prices: {
          liveStart: LIVE_SESSION_PRICE_CREDITS,
          liveUnlockStep: LIVE_SESSION_EXTRA_STEP_PRICE_CREDITS,
          presetStart: PRESET_SESSION_PRICE_CREDITS,
        },
      })
    }

    if (action === 'charge_live_start') {
      const charged = await chargeIdempotent(adminSupabase, {
        userId: user.id,
        amount: LIVE_SESSION_PRICE_CREDITS,
        eventKey: `english-coach:live:start:${sessionId}`,
        chargeType: 'english_coach_live_start',
        sessionId,
        metadata: {
          product: 'english_coach',
          event: 'live_start',
          sessionId,
          priceCredits: LIVE_SESSION_PRICE_CREDITS,
        },
      })
      if (!charged.ok) {
        if (charged.error === 'insufficient_credits') {
          return NextResponse.json(
            {
              error: `Không đủ credits để mở buổi live. Cần ${LIVE_SESSION_PRICE_CREDITS} credit.`,
              requiredCredits: LIVE_SESSION_PRICE_CREDITS,
              code: 'INSUFFICIENT_CREDITS',
            },
            { status: 402 }
          )
        }
        return NextResponse.json({ error: 'Không thể trừ credits cho buổi live.' }, { status: 500 })
      }
      return NextResponse.json({
        ok: true,
        charged: !charged.alreadyApplied,
        alreadyCharged: charged.alreadyApplied,
        newBalance: charged.newBalance,
        liveStartCharged: true,
        liveUnlockCount,
        studentTurns,
        turnLimit,
      })
    }

    if (action === 'charge_live_unlock') {
      if (!liveStartCharged) {
        return NextResponse.json(
          {
            error: 'Buổi live chưa được mở khóa gói 10 lượt.',
            requiredAction: 'charge_live_start',
            requiredCredits: LIVE_SESSION_PRICE_CREDITS,
          },
          { status: 400 }
        )
      }
      const nextUnlockIndex = liveUnlockCount + 1
      const charged = await chargeIdempotent(adminSupabase, {
        userId: user.id,
        amount: LIVE_SESSION_EXTRA_STEP_PRICE_CREDITS,
        eventKey: `english-coach:live:unlock:${sessionId}:${nextUnlockIndex}`,
        chargeType: 'english_coach_live_unlock',
        sessionId,
        metadata: {
          product: 'english_coach',
          event: 'live_unlock',
          sessionId,
          unlockIndex: nextUnlockIndex,
          extraTurns: LIVE_SESSION_EXTRA_TURN_STEP,
          priceCredits: LIVE_SESSION_EXTRA_STEP_PRICE_CREDITS,
        },
      })
      if (!charged.ok) {
        if (charged.error === 'insufficient_credits') {
          return NextResponse.json(
            {
              error: `Không đủ credits để mở thêm ${LIVE_SESSION_EXTRA_TURN_STEP} lượt.`,
              requiredCredits: LIVE_SESSION_EXTRA_STEP_PRICE_CREDITS,
              code: 'INSUFFICIENT_CREDITS',
            },
            { status: 402 }
          )
        }
        return NextResponse.json({ error: 'Không thể trừ credits cho gói mở thêm lượt.' }, { status: 500 })
      }
      const liveUnlockCountAfter = await countEvents(adminSupabase, user.id, sessionId, 'english_coach_live_unlock')
      const turnLimitAfter = LIVE_SESSION_BASE_TURN_LIMIT + liveUnlockCountAfter * LIVE_SESSION_EXTRA_TURN_STEP
      return NextResponse.json({
        ok: true,
        charged: !charged.alreadyApplied,
        alreadyCharged: charged.alreadyApplied,
        newBalance: charged.newBalance,
        liveStartCharged: true,
        liveUnlockCount: liveUnlockCountAfter,
        studentTurns,
        turnLimit: turnLimitAfter,
      })
    }

    if (action === 'charge_preset_start') {
      const charged = await chargeIdempotent(adminSupabase, {
        userId: user.id,
        amount: PRESET_SESSION_PRICE_CREDITS,
        eventKey: `english-coach:preset:start:${sessionId}`,
        chargeType: 'english_coach_preset_start',
        sessionId,
        metadata: {
          product: 'english_coach',
          event: 'preset_start',
          sessionId,
          priceCredits: PRESET_SESSION_PRICE_CREDITS,
        },
      })
      if (!charged.ok) {
        if (charged.error === 'insufficient_credits') {
          return NextResponse.json(
            {
              error: `Không đủ credits để mở bài có sẵn. Cần ${PRESET_SESSION_PRICE_CREDITS} credit.`,
              requiredCredits: PRESET_SESSION_PRICE_CREDITS,
              code: 'INSUFFICIENT_CREDITS',
            },
            { status: 402 }
          )
        }
        return NextResponse.json({ error: 'Không thể trừ credits cho bài có sẵn.' }, { status: 500 })
      }
      return NextResponse.json({
        ok: true,
        charged: !charged.alreadyApplied,
        alreadyCharged: charged.alreadyApplied,
        newBalance: charged.newBalance,
        sessionId,
      })
    }

    return NextResponse.json({ error: 'Action không hợp lệ.' }, { status: 400 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Lỗi không xác định.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

