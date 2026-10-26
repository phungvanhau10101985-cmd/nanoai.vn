import { NextRequest, NextResponse } from 'next/server'
import { getUserForAction } from '@/lib/auth'
import { fetchClassesAtSchoolPg, schoolExistsByIdPg } from '@/lib/db/classes-pg'
import { isPgConfigured } from '@/lib/db/pool'

export async function GET(req: NextRequest) {
  const auth = await getUserForAction()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })

  if (!isPgConfigured()) {
    return NextResponse.json({ error: 'Server database is not configured.' }, { status: 503 })
  }

  const schoolId = String(req.nextUrl.searchParams.get('schoolId') ?? '').trim()
  if (!schoolId) return NextResponse.json({ error: 'Thiếu trường.' }, { status: 400 })

  const schoolOk = await schoolExistsByIdPg(schoolId)
  if (schoolOk !== true) {
    return NextResponse.json({ error: 'Không tìm thấy trường đã chọn.' }, { status: 404 })
  }

  const classes = await fetchClassesAtSchoolPg(schoolId)
  if (classes === null) {
    return NextResponse.json({ error: 'Không tải được danh sách lớp.' }, { status: 500 })
  }

  return NextResponse.json({
    items: classes.map((c) => ({
      id: c.id,
      name: c.name,
      gradeLevelId: c.grade_level_id ?? '',
      choice: c.choice,
    })),
  })
}
