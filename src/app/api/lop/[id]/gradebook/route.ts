import { NextRequest, NextResponse } from 'next/server'
import { getUserForAction } from '@/lib/auth'
import { fetchClassGradebookData } from '@/lib/lop/class-gradebook'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: classId } = await params
  const auth = await getUserForAction()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })

  const result = await fetchClassGradebookData(classId, auth.user.id)
  if (!result.ok) {
    if (result.error === 'db') {
      return NextResponse.json({ error: 'Không thể tải bảng điểm.' }, { status: 503 })
    }
    const status = result.error === 'not_found' ? 404 : 403
    return NextResponse.json({ error: result.error }, { status })
  }

  return NextResponse.json(result.data)
}
