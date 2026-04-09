import { NextRequest, NextResponse } from 'next/server'
import { getUserForAction } from '@/lib/auth'
import { fetchClassTeacherIdFromPg, updateClassNameForTeacherPg } from '@/lib/db/classes-pg'
import { isPgConfigured } from '@/lib/db/pool'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const auth = await getUserForAction()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })

  if (!isPgConfigured()) {
    return NextResponse.json({ error: 'Chưa cấu hình cơ sở dữ liệu.' }, { status: 503 })
  }

  const teacherId = await fetchClassTeacherIdFromPg(id)
  if (teacherId === null || teacherId !== auth.user.id) {
    return NextResponse.json({ error: 'Bạn không có quyền sửa lớp này.' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const name = String(body?.name ?? '').trim()
  if (!name) return NextResponse.json({ error: 'Vui lòng nhập tên lớp.' }, { status: 400 })

  const updated = await updateClassNameForTeacherPg(id, auth.user.id, name)
  if (updated === null) {
    return NextResponse.json({ error: 'Lỗi cập nhật tên lớp.' }, { status: 500 })
  }
  if (!updated) {
    return NextResponse.json({ error: 'Bạn không có quyền sửa lớp này.' }, { status: 403 })
  }

  return NextResponse.json({ success: true })
}
