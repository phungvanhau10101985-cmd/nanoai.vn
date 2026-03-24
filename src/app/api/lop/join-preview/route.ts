import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserForAction } from '@/lib/auth'

function schoolName(schools: unknown): string {
  if (schools == null) return ''
  if (Array.isArray(schools)) {
    const row = schools[0] as { name?: string | null } | undefined
    return String(row?.name ?? '').trim()
  }
  const row = schools as { name?: string | null }
  return String(row.name ?? '').trim()
}

/** HS xem trước lớp (tên, môn, GV) trước khi gửi form tham gia — cần đăng nhập. */
export async function GET(req: NextRequest) {
  const supabase = createClient()
  const auth = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập.')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })

  const code = req.nextUrl.searchParams.get('code')?.trim().toUpperCase() ?? ''
  if (code.length < 4) {
    return NextResponse.json({ found: false, reason: 'short' })
  }

  const { data: row, error } = await supabase
    .from('classes')
    .select('id, name, subject_label, teacher_display_name, schools(name)')
    .eq('join_code', code)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!row) return NextResponse.json({ found: false, reason: 'not_found' })

  return NextResponse.json({
    found: true,
    classId: String(row.id),
    className: String(row.name ?? '').trim(),
    subjectLabel: String((row as { subject_label?: string | null }).subject_label ?? '').trim(),
    teacherDisplayName: String((row as { teacher_display_name?: string | null }).teacher_display_name ?? '').trim(),
    schoolName: schoolName((row as { schools?: unknown }).schools),
  })
}
