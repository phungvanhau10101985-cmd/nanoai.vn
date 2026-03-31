import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserForAction } from '@/lib/auth'
import { deductUserCredits } from '@/lib/music/deduct-user-credits'

type ChargeMode = 'background' | 'dj' | 'image' | 'realtime' | 'lyria3'
type ChargeType =
  | 'time_block'
  | 'image_analysis'
  | 'realtime_prompt'
  | 'lyria3_clip'
  | 'lyria3_pro'
  | 'lyria3_pro_60'
  | 'lyria3_pro_150'
  | 'lyria3_pro_180'

const CHARGE_COSTS: Record<ChargeType, Record<ChargeMode, number>> = {
  time_block: {
    background: 0.5,
    dj: 0.7,
    image: 0.5,
    realtime: 0.7,
    lyria3: 0,
  },
  image_analysis: {
    background: 0,
    dj: 0,
    image: 0,
    realtime: 0,
    lyria3: 0,
  },
  realtime_prompt: {
    background: 0,
    dj: 0,
    image: 0,
    realtime: 0,
    lyria3: 0,
  },
  lyria3_clip: {
    background: 0,
    dj: 0,
    image: 0,
    realtime: 0,
    lyria3: 3,
  },
  lyria3_pro: {
    background: 0,
    dj: 0,
    image: 0,
    realtime: 0,
    lyria3: 8,
  },
  lyria3_pro_60: {
    background: 0,
    dj: 0,
    image: 0,
    realtime: 0,
    lyria3: 5,
  },
  lyria3_pro_150: {
    background: 0,
    dj: 0,
    image: 0,
    realtime: 0,
    lyria3: 8,
  },
  lyria3_pro_180: {
    background: 0,
    dj: 0,
    image: 0,
    realtime: 0,
    lyria3: 10,
  },
}

function isValidMode(mode: string): mode is ChargeMode {
  return mode === 'background' || mode === 'dj' || mode === 'image' || mode === 'realtime' || mode === 'lyria3'
}

function isValidChargeType(type: string): type is ChargeType {
  return (
    type === 'time_block' ||
    type === 'image_analysis' ||
    type === 'realtime_prompt' ||
    type === 'lyria3_clip' ||
    type === 'lyria3_pro' ||
    type === 'lyria3_pro_60' ||
    type === 'lyria3_pro_150' ||
    type === 'lyria3_pro_180'
  )
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

    const deducted = await deductUserCredits(user.id, cost)
    if (!deducted.ok) {
      if (deducted.code === 'INSUFFICIENT_CREDITS') {
        return NextResponse.json({ error: deducted.error, code: 'INSUFFICIENT_CREDITS' }, { status: 402 })
      }
      return NextResponse.json({ error: deducted.error }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      charged: deducted.charged,
      balance: deducted.balance,
      mode,
      chargeType,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Lỗi không xác định.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

