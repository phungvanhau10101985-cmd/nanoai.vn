import { NextRequest, NextResponse } from 'next/server'
import { getUserForAction } from '@/lib/auth'
import { fetchClassGradebookData } from '@/lib/lop/class-gradebook'

function gradebookScope(req: NextRequest) {
  const subjectId = String(req.nextUrl.searchParams.get('subject') ?? '').trim().slice(0, 40)
  const teacherId = String(req.nextUrl.searchParams.get('teacher') ?? '').trim()
  if (!subjectId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(teacherId)) {
    return null
  }
  return { subjectId, teacherId }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: classId } = await params
  const auth = await getUserForAction()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })

  const result = await fetchClassGradebookData(classId, auth.user.id, gradebookScope(req))
  if (!result.ok) {
    if (result.error === 'db') {
      return NextResponse.json({ error: 'Không thể tải bảng điểm.' }, { status: 503 })
    }
    const status = result.error === 'not_found' ? 404 : 403
    return NextResponse.json({ error: result.error }, { status })
  }

  return NextResponse.json(result.data)
}
