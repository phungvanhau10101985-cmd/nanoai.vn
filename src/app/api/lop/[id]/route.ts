import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserForAction } from '@/lib/auth'

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = createClient()
  const auth = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập.')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })

  const { data: cls, error: fetchErr } = await supabase
    .from('classes')
    .select('id, teacher_id')
    .eq('id', id)
    .maybeSingle()

  if (fetchErr || !cls) {
    return NextResponse.json({ error: 'Không tìm thấy lớp.' }, { status: 404 })
  }
  /** Chỉ người tạo lớp (cột teacher_id) được xóa — không phải học sinh hay tài khoản khác. */
  if (cls.teacher_id !== auth.user.id) {
    return NextResponse.json({ error: 'Chỉ người tạo lớp mới có quyền xóa lớp này.' }, { status: 403 })
  }

  const { error: delErr } = await supabase.from('classes').delete().eq('id', id).eq('teacher_id', auth.user.id)
  if (delErr) {
    return NextResponse.json({ error: delErr.message || 'Không xóa được lớp.' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
