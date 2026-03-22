import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserForAction } from '@/lib/auth'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = createClient()
  const auth = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập.')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })

  const { data: cls } = await supabase
    .from('classes')
    .select('teacher_id')
    .eq('id', id)
    .single()
  if (!cls || cls.teacher_id !== auth.user.id) {
    return NextResponse.json({ error: 'Bạn không có quyền sửa lớp này.' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const name = String(body?.name ?? '').trim()
  if (!name) return NextResponse.json({ error: 'Vui lòng nhập tên lớp.' }, { status: 400 })

  const { error } = await supabase
    .from('classes')
    .update({ name })
    .eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
