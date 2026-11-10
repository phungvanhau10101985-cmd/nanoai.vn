import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'
import { isPgConfigured } from '@/lib/db/pool'

export type TeachClassOption = {
  classId: string
  className: string
  subjectId: string
  subjectLabel: string
  schoolName: string
}

export type TaughtLessonRow = {
  curriculumId: string
  lessonNo: number
  title: string
  topic: string
  taughtAt: string
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function listTeachClassesForSubjectPg(
  teacherId: string,
  subjectId: string
): Promise<TeachClassOption[]> {
  if (!isPgConfigured()) return []
  const subject = subjectId.trim()
  if (!subject) return []
  const rows = await pgQuery<{
    class_id: string
    class_name: string | null
    subject_id: string
    subject_label: string | null
    school_name: string | null
  }>(
    `select c.id::text as class_id,
            c.name as class_name,
            cs.subject_id,
            cs.subject_label,
            sch.name as school_name
     from public.class_subjects cs
     join public.classes c on c.id = cs.class_id
     left join public.schools sch on sch.id = c.school_id
     where cs.teacher_id = $1::uuid
       and cs.subject_id = $2
       and c.dissolved_at is null
       and (
         coalesce(c.class_kind, 'school') <> 'tutoring'
         or not exists (
           select 1 from public.teacher_tutoring_packages p
           where p.user_id = c.teacher_id
             and p.access_ends_at <= now()
         )
       )
     order by c.name asc`,
    [teacherId, subject]
  )
  return rows.map((row) => ({
    classId: row.class_id,
    className: String(row.class_name ?? '').trim() || row.class_id,
    subjectId: row.subject_id,
    subjectLabel: String(row.subject_label ?? '').trim(),
    schoolName: String(row.school_name ?? '').trim(),
  }))
}

export async function attachTaughtLessonPg(opts: {
  classId: string
  teacherId: string
  subjectId: string
  curriculumId: string
  lessonNo: number
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isPgConfigured()) return { ok: false, error: 'database_not_configured' }
  const lessonNo = Math.floor(opts.lessonNo)
  if (!UUID_RE.test(opts.classId) || !UUID_RE.test(opts.curriculumId) || lessonNo < 1 || lessonNo > 500) {
    return { ok: false, error: 'invalid' }
  }
  const subjectId = opts.subjectId.trim()
  if (!subjectId || subjectId.length > 80) return { ok: false, error: 'invalid' }
  const ownsSubject = await pgQueryOne<{ subject_id: string }>(
    `select subject_id
     from public.class_subjects
     where class_id = $1::uuid and teacher_id = $2::uuid and subject_id = $3
     limit 1`,
    [opts.classId, opts.teacherId, subjectId]
  )
  if (!ownsSubject) return { ok: false, error: 'not_subject_teacher' }
  const curriculum = await pgQueryOne<{ subject_id: string | null }>(
    `select subject_id from public.worksheet_curricula where id = $1::uuid limit 1`,
    [opts.curriculumId]
  )
  if (!curriculum || String(curriculum.subject_id ?? '') !== subjectId) {
    return { ok: false, error: 'subject_mismatch' }
  }
  const lesson = await pgQueryOne<{ lesson_no: number }>(
    `select lesson_no
     from public.worksheet_curriculum_lessons
     where curriculum_id = $1::uuid and lesson_no = $2::int
     limit 1`,
    [opts.curriculumId, lessonNo]
  )
  if (!lesson) return { ok: false, error: 'lesson_missing' }
  await pgQuery(
    `insert into public.class_taught_lessons
       (class_id, teacher_id, subject_id, curriculum_id, lesson_no, taught_at)
     values ($1::uuid, $2::uuid, $3, $4::uuid, $5::int, timezone('utc', now()))
     on conflict (class_id, teacher_id, subject_id, curriculum_id, lesson_no)
     do update set taught_at = timezone('utc', now())`,
    [opts.classId, opts.teacherId, subjectId, opts.curriculumId, lessonNo]
  )
  return { ok: true }
}

export async function listTaughtLessonsPg(opts: {
  classId: string
  teacherId: string
  subjectId: string
}): Promise<TaughtLessonRow[]> {
  if (!isPgConfigured()) return []
  const rows = await pgQuery<{
    curriculum_id: string
    lesson_no: number
    taught_at: string
    topic: string | null
    lesson_title: string | null
  }>(
    `select t.curriculum_id::text as curriculum_id,
            t.lesson_no,
            t.taught_at::text as taught_at,
            c.topic,
            l.lesson_title
     from public.class_taught_lessons t
     join public.worksheet_curricula c on c.id = t.curriculum_id
     left join public.worksheet_curriculum_lessons l
       on l.curriculum_id = t.curriculum_id and l.lesson_no = t.lesson_no
     where t.class_id = $1::uuid
       and t.teacher_id = $2::uuid
       and t.subject_id = $3
     order by t.taught_at desc
     limit 80`,
    [opts.classId, opts.teacherId, opts.subjectId.trim()]
  )
  return rows.map((row) => ({
    curriculumId: row.curriculum_id,
    lessonNo: Number(row.lesson_no),
    title: String(row.lesson_title ?? '').trim(),
    topic: String(row.topic ?? '').trim(),
    taughtAt: String(row.taught_at ?? ''),
  }))
}

export async function lessonIsTaughtInClassPg(opts: {
  classId: string
  teacherId: string
  subjectId: string
  curriculumId: string
  lessonNo: number
}): Promise<boolean> {
  if (!isPgConfigured()) return false
  const row = await pgQueryOne<{ lesson_no: number }>(
    `select lesson_no
     from public.class_taught_lessons
     where class_id = $1::uuid
       and teacher_id = $2::uuid
       and subject_id = $3
       and curriculum_id = $4::uuid
       and lesson_no = $5::int
     limit 1`,
    [opts.classId, opts.teacherId, opts.subjectId.trim(), opts.curriculumId, Math.floor(opts.lessonNo)]
  )
  return Boolean(row)
}

/** Slide học sinh ôn: bản chung, rồi bản gốc. Không lấy bản riêng của cô. */
export async function fetchReviewSlidesJsonPg(
  curriculumId: string,
  lessonNo: number
): Promise<{ slidesJson: unknown; topic: string; lessonTitle: string }> {
  const empty = { slidesJson: null as unknown, topic: '', lessonTitle: '' }
  if (!isPgConfigured() || !UUID_RE.test(curriculumId)) return empty
  const lesson = Math.floor(lessonNo)
  const meta = await pgQueryOne<{ topic: string | null; lesson_title: string | null }>(
    `select c.topic, l.lesson_title
     from public.worksheet_curricula c
     left join public.worksheet_curriculum_lessons l
       on l.curriculum_id = c.id and l.lesson_no = $2::int
     where c.id = $1::uuid
     limit 1`,
    [curriculumId, lesson]
  )
  const shared = await pgQueryOne<{ slides_json: unknown }>(
    `select slides_json
     from public.worksheet_curriculum_lesson_slides
     where curriculum_id = $1::uuid and lesson_no = $2::int and mode = 'shared' and user_id is null
     limit 1`,
    [curriculumId, lesson]
  )
  const original = shared?.slides_json
    ? null
    : await pgQueryOne<{ slides_json: unknown }>(
        `select slides_json
         from public.worksheet_curriculum_lesson_slides
         where curriculum_id = $1::uuid and lesson_no = $2::int and mode = 'original' and user_id is null
         limit 1`,
        [curriculumId, lesson]
      )
  return {
    slidesJson: shared?.slides_json ?? original?.slides_json ?? null,
    topic: String(meta?.topic ?? '').trim(),
    lessonTitle: String(meta?.lesson_title ?? '').trim(),
  }
}
