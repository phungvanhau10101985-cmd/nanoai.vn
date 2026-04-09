import { NextResponse } from 'next/server'
import { getUserForAction } from '@/lib/auth'
import { getProfileRoleWithFallback } from '@/lib/db/read-user-dashboard-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { fetchQuizQuestionReportsAdminPendingPg } from '@/lib/db/quiz-reports-pg'

/** Admin: danh sách báo cáo câu hỏi sai chờ duyệt */
export async function GET() {
  try {
    const authResult = await getUserForAction()
    if ('error' in authResult) return NextResponse.json({ error: authResult.error }, { status: 401 })

    const role = await getProfileRoleWithFallback(authResult.user!.id)
    if (role !== 'admin') {
      return NextResponse.json({ error: 'Chỉ quản trị viên mới được xem.' }, { status: 403 })
    }

    if (!isPgConfigured()) {
      return NextResponse.json({ error: 'Chưa cấu hình cơ sở dữ liệu.' }, { status: 503 })
    }

    const items = await fetchQuizQuestionReportsAdminPendingPg()
    if (items === null) {
      return NextResponse.json({ error: 'Không đọc được danh sách báo cáo.' }, { status: 500 })
    }

    return NextResponse.json({ items })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[admin/quiz-reports] GET:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
