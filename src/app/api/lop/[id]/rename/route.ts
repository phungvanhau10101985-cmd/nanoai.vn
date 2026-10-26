import { NextRequest, NextResponse } from 'next/server'
import { getUserForAction } from '@/lib/auth'
import {
  fetchClassAtSchoolByNamePg,
  fetchClassTeacherAndSchoolIdPg,
  fetchClassTeacherIdFromPg,
  updateClassNameForTeacherPg,
} from '@/lib/db/classes-pg'
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

  const owned = await fetchClassTeacherAndSchoolIdPg(id)
  if (!owned || owned.teacher_id !== auth.user.id) {
    return NextResponse.json({ error: 'Bạn không có quyền sửa lớp này.' }, { status: 403 })
  }
  if (owned.school_id) {
    const taken = await fetchClassAtSchoolByNamePg(owned.school_id, name, id)
    if (taken) {
      return NextResponse.json(
        {
          error: 'Trường này đã có lớp trùng tên. Hãy thêm người vào lớp đã có.',
          code: 'class_exists',
          existing: {
            id: taken.id,
            name: taken.name,
            joinCode: taken.join_code,
            schoolName: taken.school_name,
          },
        },
        { status: 409 }
      )
    }
  }

  const updated = await updateClassNameForTeacherPg(id, auth.user.id, name)
  if (updated === 'has_students') {
    return NextResponse.json(
      {
        error: 'Lớp đã có học sinh, không đổi tên được.',
        code: 'class_has_students',
      },
      { status: 409 }
    )
  }
  if (updated === null) {
    return NextResponse.json({ error: 'Lỗi cập nhật tên lớp.' }, { status: 500 })
  }
  if (!updated) {
    return NextResponse.json({ error: 'Bạn không có quyền sửa lớp này.' }, { status: 403 })
  }

  return NextResponse.json({ success: true })
}
