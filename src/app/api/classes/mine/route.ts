import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserForAction } from '@/lib/auth'
import { createClient as createAdminClient } from '@supabase/supabase-js'

function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

function generateJoinCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

/** Supabase nested `schools(...)` select is untyped on admin client — avoid `never` from generic client. */
function joinedSchoolName(schools: unknown): string {
  if (schools == null) return ''
  if (Array.isArray(schools)) {
    const row = schools[0] as { name?: string | null } | undefined
    return String(row?.name ?? '')
  }
  const row = schools as { name?: string | null }
  return String(row.name ?? '')
}

export async function GET() {
  const supabase = createClient()
  const auth = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập.')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })
  const { user } = auth

  const admin = getAdminClient()
  const [{ data: classes, error: classErr }, { data: setting }] = await Promise.all([
    admin
      .from('classes')
      .select(
        'id, name, join_code, school_id, grade_level_id, subject_label, teacher_display_name, created_at, schools(name)'
      )
      .eq('teacher_id', user.id)
      .order('created_at', { ascending: false })
      .limit(200),
    admin
      .from('teacher_school_settings')
      .select('school_id, teacher_display_name, default_subject_label, schools(name)')
      .eq('teacher_id', user.id)
      .maybeSingle(),
  ])
  if (classErr) return NextResponse.json({ error: classErr.message }, { status: 500 })

  const defaultSchool = setting
    ? {
      id: String(setting.school_id ?? ''),
      name: joinedSchoolName(setting.schools),
      teacherDisplayName: String((setting as { teacher_display_name?: string | null }).teacher_display_name ?? '').trim(),
      defaultSubjectLabel: String((setting as { default_subject_label?: string | null }).default_subject_label ?? '').trim(),
    }
    : null

  return NextResponse.json({
    items: (classes ?? []).map((c) => ({
      id: String(c.id),
      name: String(c.name ?? ''),
      joinCode: String(c.join_code ?? ''),
      schoolId: c.school_id ? String(c.school_id) : '',
      schoolName: joinedSchoolName(c.schools),
      gradeLevelId: c.grade_level_id ? String(c.grade_level_id) : '',
      subjectLabel: String((c as { subject_label?: string | null }).subject_label ?? '').trim(),
      teacherDisplayName: String((c as { teacher_display_name?: string | null }).teacher_display_name ?? '').trim(),
      createdAt: String(c.created_at ?? ''),
    })),
    defaultSchool,
  })
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const auth = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập.')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })
  const { user } = auth

  const body = await req.json().catch(() => ({}))
  const name = String(body?.name ?? '').trim()
  const schoolId = String(body?.schoolId ?? '').trim()
  const gradeLevelId = String(body?.gradeLevelId ?? '').trim()
  const subjectLabelRaw = String(body?.subjectLabel ?? '').replace(/\s+/g, ' ').trim()
  const teacherDisplayNameRaw = String(body?.teacherDisplayName ?? '').replace(/\s+/g, ' ').trim()
  const subjectLabel = subjectLabelRaw.length > 120 ? subjectLabelRaw.slice(0, 120) : subjectLabelRaw
  const teacherDisplayName = teacherDisplayNameRaw.length > 120 ? teacherDisplayNameRaw.slice(0, 120) : teacherDisplayNameRaw
  if (!name) return NextResponse.json({ error: 'Vui lòng nhập tên lớp.' }, { status: 400 })
  if (!schoolId) return NextResponse.json({ error: 'Vui lòng chọn trường trước khi tạo lớp.' }, { status: 400 })

  const admin = getAdminClient()
  const { data: school } = await admin.from('schools').select('id').eq('id', schoolId).maybeSingle()
  if (!school) return NextResponse.json({ error: 'Không tìm thấy trường đã chọn.' }, { status: 404 })

  let joinCode = generateJoinCode()
  for (let i = 0; i < 10; i++) {
    const { data: existed } = await admin.from('classes').select('id').eq('join_code', joinCode).maybeSingle()
    if (!existed) break
    joinCode = generateJoinCode()
  }

  const { data: created, error: insertErr } = await admin
    .from('classes')
    .insert({
      teacher_id: user.id,
      name,
      join_code: joinCode,
      school_id: schoolId,
      grade_level_id: gradeLevelId || null,
      subject_label: subjectLabel || null,
      teacher_display_name: teacherDisplayName || null,
    })
    .select('id, name, join_code, school_id, grade_level_id, subject_label, teacher_display_name, created_at, schools(name)')
    .single()
  if (insertErr || !created) {
    return NextResponse.json({ error: insertErr?.message ?? 'Tạo lớp thất bại.' }, { status: 500 })
  }

  const { data: prevSetting } = await admin
    .from('teacher_school_settings')
    .select('teacher_display_name, default_subject_label')
    .eq('teacher_id', user.id)
    .maybeSingle()

  await admin.from('teacher_school_settings').upsert(
    {
      teacher_id: user.id,
      school_id: schoolId,
      teacher_display_name: teacherDisplayName || prevSetting?.teacher_display_name || null,
      default_subject_label: subjectLabel || prevSetting?.default_subject_label || null,
    },
    { onConflict: 'teacher_id' }
  )

  return NextResponse.json({
    success: true,
    item: {
      id: String(created.id),
      name: String(created.name ?? ''),
      joinCode: String(created.join_code ?? ''),
      schoolId: created.school_id ? String(created.school_id) : '',
      schoolName: joinedSchoolName(created.schools),
      gradeLevelId: created.grade_level_id ? String(created.grade_level_id) : '',
      subjectLabel: String((created as { subject_label?: string | null }).subject_label ?? '').trim(),
      teacherDisplayName: String((created as { teacher_display_name?: string | null }).teacher_display_name ?? '').trim(),
      createdAt: String(created.created_at ?? ''),
    },
  })
}
