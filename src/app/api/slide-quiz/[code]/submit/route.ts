import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export async function POST(
  req: NextRequest,
  { params }: { params: { code: string } }
) {
  const code = params.code?.toUpperCase()
  if (!code) {
    return NextResponse.json({ error: 'Thiếu mã.' }, { status: 400 })
  }

  const body = await req.json()
  const { answerIndex, deviceId, userId } = body as {
    answerIndex: number
    deviceId?: string
    userId?: string
  }

  if (typeof answerIndex !== 'number' || answerIndex < 0) {
    return NextResponse.json({ error: 'Đáp án không hợp lệ.' }, { status: 400 })
  }
  const did = deviceId || (userId ? `user-${userId}` : null)
  if (!did) {
    return NextResponse.json({ error: 'Cần deviceId.' }, { status: 400 })
  }

  const supabase = createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data: session } = await supabase
    .from('slide_quiz_sessions')
    .select('id')
    .eq('code', code)
    .single()

  if (!session) {
    return NextResponse.json({ error: 'Không tìm thấy phiên.' }, { status: 404 })
  }
  const row = {
    session_id: session.id,
    answer_index: answerIndex,
    user_id: userId || null,
    device_id: did,
  }

  const { error } = await supabase.from('slide_quiz_responses').upsert(row, {
    onConflict: 'session_id,device_id',
  })

  if (error) {
    if ((error as { code?: string }).code === '23505') {
      return NextResponse.json({ success: true, message: 'Bạn đã trả lời rồi.' })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
