import { NextResponse } from 'next/server'
import { getUserForAction } from '@/lib/auth'
import { deleteClassByOwnerPg } from '@/lib/db/classes-pg'
import { isPgConfigured } from '@/lib/db/pool'

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const auth = await getUserForAction()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })

  if (!isPgConfigured()) {
    return NextResponse.json({ error: 'Chưa cấu hình cơ sở dữ liệu.' }, { status: 503 })
  }

  const result = await deleteClassByOwnerPg(id, auth.user.id)
  if (result === null) {
    return NextResponse.json({ error: 'Không xóa được lớp.' }, { status: 500 })
  }
  if (result === 'not_found') {
    return NextResponse.json({ error: 'Không tìm thấy lớp.' }, { status: 404 })
  }
  /** Chỉ người tạo lớp (cột teacher_id) được xóa — không phải học sinh hay tài khoản khác. */
  if (result === 'not_owner') {
    return NextResponse.json({ error: 'Chỉ người tạo lớp mới có quyền xóa lớp này.' }, { status: 403 })
  }

  return NextResponse.json({ success: true })
}
