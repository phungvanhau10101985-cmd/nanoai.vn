import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserForAction } from '@/lib/auth'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

type ChargeMode = 'background' | 'dj' | 'image' | 'realtime'
type ChargeType = 'time_block' | 'image_analysis' | 'realtime_prompt'

const CHARGE_COSTS: Record<ChargeType, Record<ChargeMode, number>> = {
  time_block: {
    background: 0.3,
    dj: 0.7,
    image: 0.3,
    realtime: 0.7,
  },
  image_analysis: {
    background: 0,
    dj: 0,
    image: 3,
    realtime: 0,
  },
  realtime_prompt: {
    background: 0,
    dj: 0,
    image: 0,
    realtime: 1,
  },
}

const toTenths = (value: number) => Math.round(value * 10)
const fromTenths = (value: number) => value / 10

function isValidMode(mode: string): mode is ChargeMode {
  return mode === 'background' || mode === 'dj' || mode === 'image' || mode === 'realtime'
}

function isValidChargeType(type: string): type is ChargeType {
  return type === 'time_block' || type === 'image_analysis' || type === 'realtime_prompt'
}

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as { mode?: string; chargeType?: string }
    const mode = String(payload?.mode || '')
    const chargeType = String(payload?.chargeType || '')

    if (!isValidMode(mode) || !isValidChargeType(chargeType)) {
      return NextResponse.json({ error: 'Dữ liệu charge không hợp lệ.' }, { status: 400 })
    }

    const cost = CHARGE_COSTS[chargeType][mode]
    if (!cost || cost <= 0) {
      return NextResponse.json({ ok: true, charged: 0 })
    }

    const supabase = createClient()
    const auth = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập để sử dụng tạo nhạc.')
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: 401 })
    }
    const { user } = auth

    const adminSupabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: creditData, error: creditError } = await adminSupabase
      .from('credits')
      .select('balance')
      .eq('user_id', user.id)
      .single()

    if (creditError || !creditData) {
      return NextResponse.json({ error: 'Không đọc được số dư credits.' }, { status: 500 })
    }
    if (toTenths(creditData.balance) < toTenths(cost)) {
      return NextResponse.json({ error: 'Không đủ credits.', code: 'INSUFFICIENT_CREDITS' }, { status: 402 })
    }

    const newBalance = fromTenths(toTenths(creditData.balance) - toTenths(cost))
    const { error: updateError } = await adminSupabase
      .from('credits')
      .update({ balance: newBalance })
      .eq('user_id', user.id)

    if (updateError) {
      return NextResponse.json({ error: 'Không trừ được credits.' }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      charged: cost,
      balance: newBalance,
      mode,
      chargeType,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Lỗi không xác định.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

