import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserForAction } from '@/lib/auth'
import { fetchClassGradebookData } from '@/lib/lop/class-gradebook'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: classId } = await params
  const supabase = createClient()
  const auth = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập.')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })

  const result = await fetchClassGradebookData(supabase, classId, auth.user.id)
  if (!result.ok) {
    const status = result.error === 'not_found' ? 404 : 403
    return NextResponse.json({ error: result.error }, { status })
  }

  return NextResponse.json(result.data)
}
