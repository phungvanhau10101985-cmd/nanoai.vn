import { NextRequest, NextResponse } from 'next/server'
import { getUserForAction } from '@/lib/auth'
import { isPgConfigured } from '@/lib/db/pool'
import {
  classExistsWithJoinCodePg,
  fetchClassesMineListForTeacherPg,
  fetchTeacherSchoolDefaultsMinePg,
  fetchTeacherSchoolSettingsPrevMinePg,
  insertClassMinePg,
  schoolExistsByIdPg,
  upsertTeacherSchoolSettingsMinePg,
} from '@/lib/db/classes-pg'

function generateJoinCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

export async function GET() {
  const auth = await getUserForAction()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })
  const { user } = auth

  if (!isPgConfigured()) {
    return NextResponse.json({ error: 'Server database is not configured.' }, { status: 503 })
  }

  const classes = await fetchClassesMineListForTeacherPg(user.id)
  const defaults = await fetchTeacherSchoolDefaultsMinePg(user.id)

  if (classes === null) {
    return NextResponse.json({ error: 'Could not load classes.' }, { status: 500 })
  }

  const defaultSchool = defaults
    ? {
        id: defaults.schoolId,
        name: defaults.schoolName,
        teacherDisplayName: defaults.teacherDisplayName,
        defaultSubjectLabel: defaults.defaultSubjectLabel,
      }
    : null

  return NextResponse.json({
    items: classes.map((c) => ({
      id: c.id,
      name: c.name,
      joinCode: c.join_code,
      schoolId: c.school_id ?? '',
      schoolName: c.school_name ?? '',
      gradeLevelId: c.grade_level_id ?? '',
      subjectLabel: (c.subject_label ?? '').trim(),
      teacherDisplayName: (c.teacher_display_name ?? '').trim(),
      createdAt: c.created_at,
    })),
    defaultSchool,
  })
}

export async function POST(req: NextRequest) {
  const auth = await getUserForAction()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })
  const { user } = auth

  if (!isPgConfigured()) {
    return NextResponse.json({ error: 'Server database is not configured.' }, { status: 503 })
  }

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

  const schoolOk = await schoolExistsByIdPg(schoolId)
  if (schoolOk !== true) {
    return NextResponse.json({ error: 'Không tìm thấy trường đã chọn.' }, { status: 404 })
  }

  let joinCode = generateJoinCode()
  for (let i = 0; i < 10; i++) {
    const taken = await classExistsWithJoinCodePg(joinCode)
    if (taken === false) break
    if (taken === null) {
      return NextResponse.json({ error: 'Tạo lớp thất bại.' }, { status: 500 })
    }
    joinCode = generateJoinCode()
  }

  const created = await insertClassMinePg({
    teacherId: user.id,
    name,
    joinCode,
    schoolId,
    gradeLevelId: gradeLevelId || null,
    subjectLabel: subjectLabel || null,
    teacherDisplayName: teacherDisplayName || null,
  })
  if (!created) {
    return NextResponse.json({ error: 'Tạo lớp thất bại.' }, { status: 500 })
  }

  const prevSetting = await fetchTeacherSchoolSettingsPrevMinePg(user.id)

  const upsertOk = await upsertTeacherSchoolSettingsMinePg({
    teacherId: user.id,
    schoolId,
    teacherDisplayName: teacherDisplayName || prevSetting?.teacher_display_name || null,
    defaultSubjectLabel: subjectLabel || prevSetting?.default_subject_label || null,
  })
  if (!upsertOk) {
    return NextResponse.json({ error: 'Đã tạo lớp nhưng không lưu được cài đặt trường.' }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    item: {
      id: created.id,
      name: created.name,
      joinCode: created.join_code,
      schoolId: created.school_id ?? '',
      schoolName: created.school_name ?? '',
      gradeLevelId: created.grade_level_id ?? '',
      subjectLabel: (created.subject_label ?? '').trim(),
      teacherDisplayName: (created.teacher_display_name ?? '').trim(),
      createdAt: created.created_at,
    },
  })
}
