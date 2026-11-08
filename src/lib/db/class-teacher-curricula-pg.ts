import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'
import { isPgConfigured } from '@/lib/db/pool'

export type ClassSavedCurriculumRow = {
  id: string
  topic: string
  subjectId: string
  gradeLevelId: string
  lessonNumber: number | null
  openedAt: string | null
}

const HIDDEN_SQL = `not exists (
  select 1 from public.user_hidden_curricula h
  where h.user_id = $2::uuid and h.curriculum_id = c.id
)`

function mapRow(row: {
  id: string
  topic: string | null
  subject_id: string | null
  grade_level_id: string | null
  lesson_number: number | string | null
  opened_at: string | null
}): ClassSavedCurriculumRow {
  const lesson = row.lesson_number == null || row.lesson_number === '' ? null : Number(row.lesson_number)
  return {
    id: row.id,
    topic: String(row.topic ?? '').trim() || '—',
    subjectId: String(row.subject_id ?? ''),
    gradeLevelId: String(row.grade_level_id ?? ''),
    lessonNumber: lesson != null && Number.isFinite(lesson) ? lesson : null,
    openedAt: row.opened_at,
  }
}

/** Ghi vào lớp các giáo trình cô đã tạo hoặc đã mở, đúng môn và đúng khối của lớp đó. */
export async function syncTeacherSubjectCurriculaIntoClass(opts: {
  classId: string
  teacherId: string
  subjectId: string
  gradeLevelId: string
}): Promise<void> {
  if (!isPgConfigured()) return
  const subjectId = opts.subjectId.trim()
  const gradeLevelId = opts.gradeLevelId.trim()
  if (!subjectId || !gradeLevelId) return
  await pgQuery(
    `insert into public.class_teacher_curricula (class_id, teacher_id, subject_id, curriculum_id)
     select $1::uuid, $2::uuid, $3::text, c.id
     from public.worksheet_curricula c
     left join public.user_opened_curricula o
       on o.curriculum_id = c.id and o.user_id = $2::uuid
     where (c.user_id = $2::uuid or o.user_id is not null)
       and c.subject_id = $3
       and c.grade_level_id = $4
       and ${HIDDEN_SQL}
     on conflict (class_id, teacher_id, subject_id, curriculum_id) do nothing`,
    [opts.classId, opts.teacherId, subjectId, gradeLevelId]
  )
}

export async function listClassTeacherCurricula(opts: {
  classId: string
  teacherId: string
  subjectId: string
  gradeLevelId: string
}): Promise<ClassSavedCurriculumRow[]> {
  if (!isPgConfigured()) return []
  const gradeLevelId = opts.gradeLevelId.trim()
  if (!gradeLevelId) return []
  const rows = await pgQuery<{
    id: string
    topic: string | null
    subject_id: string | null
    grade_level_id: string | null
    lesson_number: number | string | null
    opened_at: string | null
  }>(
    `select c.id::text as id,
            c.topic,
            c.subject_id,
            c.grade_level_id,
            c.lesson_number::float as lesson_number,
            o.opened_at::text as opened_at
     from public.class_teacher_curricula s
     join public.worksheet_curricula c on c.id = s.curriculum_id
     left join public.user_opened_curricula o
       on o.curriculum_id = c.id and o.user_id = s.teacher_id
     where s.class_id = $1::uuid
       and s.teacher_id = $2::uuid
       and s.subject_id = $3
       and c.subject_id = $3
       and c.grade_level_id = $4
       and ${HIDDEN_SQL}
     order by coalesce(o.opened_at, s.saved_at) desc
     limit 80`,
    [opts.classId, opts.teacherId, opts.subjectId, gradeLevelId]
  )
  return rows.map(mapRow)
}

/** Giáo trình cô đã tạo hoặc đã mở, cùng môn và cùng khối, chưa có trong lớp này. */
export async function listTeacherCurriculaNotInClass(opts: {
  classId: string
  teacherId: string
  subjectId: string
  gradeLevelId: string
}): Promise<ClassSavedCurriculumRow[]> {
  if (!isPgConfigured()) return []
  const gradeLevelId = opts.gradeLevelId.trim()
  if (!gradeLevelId) return []
  const rows = await pgQuery<{
    id: string
    topic: string | null
    subject_id: string | null
    grade_level_id: string | null
    lesson_number: number | string | null
    opened_at: string | null
  }>(
    `select c.id::text as id,
            c.topic,
            c.subject_id,
            c.grade_level_id,
            c.lesson_number::float as lesson_number,
            o.opened_at::text as opened_at
     from public.worksheet_curricula c
     left join public.user_opened_curricula o
       on o.curriculum_id = c.id and o.user_id = $2::uuid
     where (c.user_id = $2::uuid or o.user_id is not null)
       and c.subject_id = $3
       and c.grade_level_id = $4
       and ${HIDDEN_SQL}
       and not exists (
         select 1 from public.class_teacher_curricula s
         where s.class_id = $1::uuid
           and s.teacher_id = $2::uuid
           and s.subject_id = $3
           and s.curriculum_id = c.id
       )
     order by o.opened_at desc nulls last, c.created_at desc
     limit 40`,
    [opts.classId, opts.teacherId, opts.subjectId, gradeLevelId]
  )
  return rows.map(mapRow)
}

export async function teacherCanSaveCurriculumPg(
  teacherId: string,
  curriculumId: string
): Promise<boolean> {
  if (!isPgConfigured()) return false
  const row = await pgQueryOne<{ id: string }>(
    `select c.id::text as id
     from public.worksheet_curricula c
     left join public.user_opened_curricula o
       on o.curriculum_id = c.id and o.user_id = $1::uuid
     where c.id = $2::uuid
       and (c.user_id = $1::uuid or o.user_id is not null)
     limit 1`,
    [teacherId, curriculumId]
  )
  return Boolean(row?.id)
}

export async function insertClassTeacherCurriculumPg(opts: {
  classId: string
  teacherId: string
  subjectId: string
  curriculumId: string
}): Promise<void> {
  if (!isPgConfigured()) return
  await pgQuery(
    `insert into public.class_teacher_curricula (class_id, teacher_id, subject_id, curriculum_id)
     values ($1::uuid, $2::uuid, $3::text, $4::uuid)
     on conflict (class_id, teacher_id, subject_id, curriculum_id) do nothing`,
    [opts.classId, opts.teacherId, opts.subjectId, opts.curriculumId]
  )
}
