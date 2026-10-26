import { NextRequest, NextResponse } from 'next/server'
import { getUserForAction } from '@/lib/auth'
import {
  classExistsWithJoinCodePg,
  fetchClassAtSchoolByIdPg,
  fetchClassAtSchoolByNamePg,
  fetchTeacherSchoolDefaultsMinePg,
  insertClassMinePg,
  insertClassSubjectPg,
  schoolExistsByIdPg,
  upsertTeacherSchoolSettingsMinePg,
} from '@/lib/db/classes-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { resolveStoredTeachingSubject } from '@/lib/lop/normalize-teaching-subject'

function generateJoinCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

export async function POST(req: NextRequest) {
  const auth = await getUserForAction()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })
  const { user } = auth

  if (!isPgConfigured()) {
    return NextResponse.json({ error: 'Server database is not configured.' }, { status: 503 })
  }

  const body = await req.json().catch(() => ({}))
  const className = String(body?.className ?? body?.name ?? '').replace(/\s+/g, ' ').trim()
  const requestedClassId = String(body?.classId ?? '').trim()
  const schoolId = String(body?.schoolId ?? '').trim()
  const subjectId = String(body?.subjectId ?? '').trim()
  const gradeLevelId = String(body?.gradeLevelId ?? '').trim()
  const teacherDisplayNameRaw = String(body?.teacherDisplayName ?? '').replace(/\s+/g, ' ').trim()
  const teacherDisplayName =
    teacherDisplayNameRaw.length > 120 ? teacherDisplayNameRaw.slice(0, 120) : teacherDisplayNameRaw

  if (!schoolId) return NextResponse.json({ error: 'Vui lòng chọn trường.' }, { status: 400 })
  if (!className) return NextResponse.json({ error: 'Vui lòng chọn hoặc nhập tên lớp.' }, { status: 400 })
  const subject = await resolveStoredTeachingSubject(subjectId)
  if (!subject) {
    return NextResponse.json({ error: 'Vui lòng chọn môn.' }, { status: 400 })
  }
  const subjectLabel = subject.label

  const schoolOk = await schoolExistsByIdPg(schoolId)
  if (schoolOk !== true) {
    return NextResponse.json({ error: 'Không tìm thấy trường đã chọn.' }, { status: 404 })
  }

  const defaults = await fetchTeacherSchoolDefaultsMinePg(user.id)
  const displayName = teacherDisplayName || defaults?.teacherDisplayName || null

  const byId = requestedClassId ? await fetchClassAtSchoolByIdPg(schoolId, requestedClassId) : null
  const existing = byId ?? (await fetchClassAtSchoolByNamePg(schoolId, className))

  let classId = ''
  let classJoin = ''
  let classTitle = className
  let schoolName = ''
  let createdClass = false

  if (!existing) {
    let joinCode = generateJoinCode()
    for (let i = 0; i < 10; i++) {
      const taken = await classExistsWithJoinCodePg(joinCode)
      if (taken === false) break
      if (taken === null) {
        return NextResponse.json({ error: 'Tạo lớp thất bại.' }, { status: 500 })
      }
      joinCode = generateJoinCode()
    }

    const inserted = await insertClassMinePg({
      teacherId: user.id,
      name: className,
      joinCode,
      schoolId,
      gradeLevelId: gradeLevelId || null,
      subjectLabel,
      teacherDisplayName: displayName,
    })
    if (inserted.status === 'failed') {
      return NextResponse.json({ error: 'Tạo lớp thất bại.' }, { status: 500 })
    }
    if (inserted.status === 'created') {
      createdClass = true
      classId = inserted.row.id
      classJoin = inserted.row.join_code
      classTitle = inserted.row.name
      schoolName = inserted.row.school_name ?? ''
      await upsertTeacherSchoolSettingsMinePg({
        teacherId: user.id,
        schoolId,
        teacherDisplayName: displayName,
        defaultSubjectLabel: subjectLabel,
      })
    } else {
      classId = inserted.existing.id
      classJoin = inserted.existing.join_code
      classTitle = inserted.existing.name
      schoolName = inserted.existing.school_name
    }
  } else {
    classId = existing.id
    classJoin = existing.join_code
    classTitle = existing.name
    schoolName = existing.school_name
  }

  const subjectResult = await insertClassSubjectPg({
    classId,
    teacherId: user.id,
    subjectId,
    subjectLabel,
    teacherDisplayName: displayName,
  })
  if (subjectResult === null) {
    return NextResponse.json({ error: 'Không gắn được môn vào lớp.' }, { status: 500 })
  }

  const status = createdClass ? 'created' : subjectResult === 'inserted' ? 'attached' : 'already'

  return NextResponse.json({
    success: true,
    status,
    item: {
      id: classId,
      name: classTitle,
      joinCode: classJoin,
      schoolId,
      schoolName,
      subjectId,
      subjectLabel,
      teacherDisplayName: displayName ?? '',
    },
  })
}
