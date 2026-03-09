import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { code: string } }
) {
  const code = params.code?.toUpperCase()
  if (!code) return NextResponse.json({ error: 'Thiếu mã.' }, { status: 400 })

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Vui lòng đăng nhập.' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { status } = body as { status?: string }
  if (status !== 'revealed') return NextResponse.json({ error: 'Trạng thái không hợp lệ.' }, { status: 400 })

  const admin = createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data: session } = await admin.from('slide_quiz_sessions').select('id, created_by').eq('code', code).single()
  if (!session || session.created_by !== user.id) {
    return NextResponse.json({ error: 'Không có quyền.' }, { status: 403 })
  }

  await admin.from('slide_quiz_sessions').update({ status: 'revealed' }).eq('id', session.id)
  return NextResponse.json({ success: true })
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { code: string } }
) {
  const code = params.code?.toUpperCase()
  if (!code) {
    return NextResponse.json({ error: 'Thiếu mã.' }, { status: 400 })
  }

  const supabase = createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data, error } = await supabase
    .from('slide_quiz_sessions')
    .select('id, code, quiz_data, status')
    .eq('code', code)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Không tìm thấy phiên.' }, { status: 404 })
  }

  const quiz = data.quiz_data as { question: string; options: string[]; correctIndex: number }
  const payload: { sessionId: string; code: string; question: string; options: string[]; status: string; correctIndex?: number } = {
    sessionId: data.id,
    code: data.code,
    question: quiz?.question ?? '',
    options: quiz?.options ?? [],
    status: data.status,
  }
  if (data.status === 'revealed') payload.correctIndex = quiz?.correctIndex ?? 0
  return NextResponse.json(payload)
}
