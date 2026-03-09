import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  const arr = new Uint8Array(6)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(arr)
    for (let i = 0; i < 6; i++) code += chars[arr[i]! % chars.length]
  } else {
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Vui lòng đăng nhập.' }, { status: 401 })
  }

  const body = await req.json()
  const { curriculumId, slideIndex, blockIndex, quizData } = body as {
    curriculumId: string
    slideIndex: number
    blockIndex: number
    quizData: { question: string; options: string[]; correctIndex: number }
  }

  if (!curriculumId || typeof slideIndex !== 'number' || typeof blockIndex !== 'number' || !quizData?.question || !Array.isArray(quizData.options)) {
    return NextResponse.json({ error: 'Thiếu dữ liệu.' }, { status: 400 })
  }

  const admin = createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  let code = generateCode()
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data, error } = await admin.from('slide_quiz_sessions').insert({
      code,
      curriculum_id: curriculumId,
      slide_index: slideIndex,
      block_index: blockIndex,
      quiz_data: quizData,
      status: 'active',
      created_by: user.id,
    }).select('id, code').single()

    if (!error) {
      return NextResponse.json({ success: true, code: data.code, sessionId: data.id })
    }
    if ((error as { code?: string }).code === '23505') {
      code = generateCode()
      continue
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ error: 'Không tạo được mã.' }, { status: 500 })
}
