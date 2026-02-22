import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserForAction } from '@/lib/auth'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('audio') as File | null
    if (!file || file.size === 0) {
      return NextResponse.json({ error: 'Thiếu file audio.' }, { status: 400 })
    }

    const supabase = createClient()
    const auth = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập để tải audio.')
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })
    const { user } = auth

    const adminSupabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const timestamp = Date.now()
    const uploadPath = `music-history/${user.id}/music_${timestamp}.wav`
    const buffer = Buffer.from(await file.arrayBuffer())
    const { error: uploadError } = await adminSupabase.storage
      .from('try-on-images')
      .upload(uploadPath, buffer, { contentType: 'audio/wav', upsert: true })

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message || 'Không upload được audio.' }, { status: 500 })
    }

    const { data } = adminSupabase.storage.from('try-on-images').getPublicUrl(uploadPath)
    return NextResponse.json({ audioUrl: data.publicUrl })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Lỗi không xác định.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

