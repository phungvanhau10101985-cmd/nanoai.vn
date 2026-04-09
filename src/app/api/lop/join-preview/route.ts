import { NextRequest, NextResponse } from 'next/server'
import { getUserForAction } from '@/lib/auth'
import { fetchClassJoinPreviewByJoinCodeFromPg } from '@/lib/db/classes-pg'
import { isPgConfigured } from '@/lib/db/pool'

/** HS xem trước lớp (tên, môn, GV) trước khi gửi form tham gia — cần đăng nhập. */
export async function GET(req: NextRequest) {
  const auth = await getUserForAction()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })

  if (!isPgConfigured()) {
    return NextResponse.json({ error: 'Database not configured.' }, { status: 503 })
  }

  const code = req.nextUrl.searchParams.get('code')?.trim().toUpperCase() ?? ''
  if (code.length < 4) {
    return NextResponse.json({ found: false, reason: 'short' })
  }

  const fromPg = await fetchClassJoinPreviewByJoinCodeFromPg(code)
  if (fromPg) {
    return NextResponse.json({
      found: true,
      classId: fromPg.id,
      className: String(fromPg.name ?? '').trim(),
      subjectLabel: String(fromPg.subject_label ?? '').trim(),
      teacherDisplayName: String(fromPg.teacher_display_name ?? '').trim(),
      schoolName: String(fromPg.school_name ?? '').trim(),
    })
  }

  return NextResponse.json({ found: false, reason: 'not_found' })
}
