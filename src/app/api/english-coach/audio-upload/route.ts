import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserForAction } from '@/lib/auth'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { uploadTryOnImagePublic } from '@/lib/storage/try-on-public-upload'

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('audio') as File | null
    const sessionId = String(formData.get('sessionId') || '').trim()
    const messageId = String(formData.get('messageId') || '').trim()

    if (!file || file.size === 0) {
      return NextResponse.json({ error: 'Thiếu file audio.' }, { status: 400 })
    }
    if (!sessionId || !messageId) {
      return NextResponse.json({ error: 'Thiếu sessionId hoặc messageId.' }, { status: 400 })
    }

    const supabase = createClient()
    const auth = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập để tải audio.')
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })
    const { user } = auth

    const adminSupabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const extension = file.type.includes('wav') ? 'wav' : 'bin'
    const uploadPath = `english-coach-history/${user.id}/${sessionId}/${messageId}.${extension}`
    const buffer = Buffer.from(await file.arrayBuffer())
    try {
      const { publicUrl } = await uploadTryOnImagePublic(adminSupabase, uploadPath, buffer, {
        contentType: file.type || 'audio/wav',
        upsert: true,
      })
      return NextResponse.json({ audioUrl: publicUrl })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Không upload được audio.'
      return NextResponse.json({ error: msg }, { status: 500 })
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Lỗi không xác định.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

