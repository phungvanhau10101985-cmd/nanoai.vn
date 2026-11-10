import { classMemberExistsPg } from '@/lib/db/classes-pg'
import { lessonIsTaughtInClassPg, listTaughtLessonsPg } from '@/lib/db/class-taught-lessons-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'
import {
  SUBJECT_ITEM_KINDS,
  reviewLessonItemId,
  subjectItemKey,
  type SubjectItemKind,
  type SubjectItemOpenBody,
  type StudentSubjectInbox,
} from '@/lib/lop/subject-item-open'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function iso(value: unknown): string {
  if (value instanceof Date) return value.toISOString()
  return String(value ?? '')
}

export async function listSubjectItemOpenedAt(
  userId: string,
  classId: string
): Promise<Record<string, string>> {
  if (!isPgConfigured() || !UUID_RE.test(userId) || !UUID_RE.test(classId)) return {}
  try {
    const rows = await pgQuery<{ kind: string; item_id: string; opened_at: unknown }>(
      `select kind, item_id, opened_at
       from public.class_subject_item_opens
       where user_id = $1::uuid and class_id = $2::uuid`,
      [userId, classId]
    )
    const out: Record<string, string> = {}
    for (const row of rows) {
      if (!SUBJECT_ITEM_KINDS.includes(row.kind as SubjectItemKind)) continue
      const at = iso(row.opened_at)
      if (!at) continue
      out[subjectItemKey(row.kind as SubjectItemKind, row.item_id)] = at
    }
    return out
  } catch (error) {
    console.error('[class-subject-item-opens] list', error)
    return {}
  }
}

export async function loadStudentSubjectInbox(opts: {
  userId: string
  classId: string
  teacherId: string
  subjectId: string
}): Promise<StudentSubjectInbox> {
  const openedAtByKey = await listSubjectItemOpenedAt(opts.userId, opts.classId)
  let reviewItems: StudentSubjectInbox['reviewItems'] = []
  try {
    const lessons = await listTaughtLessonsPg({
      classId: opts.classId,
      teacherId: opts.teacherId,
      subjectId: opts.subjectId,
    })
    reviewItems = lessons.map((lesson) => ({
      id: reviewLessonItemId(lesson.curriculumId, lesson.lessonNo),
      taughtAt: lesson.taughtAt,
    }))
  } catch (error) {
    console.error('[class-subject-item-opens] review', error)
  }
  return { openedAtByKey, reviewItems }
}

function parseReviewItemId(itemId: string): { curriculumId: string; lessonNo: number } | null {
  const splitAt = itemId.lastIndexOf(':')
  if (splitAt <= 0) return null
  const curriculumId = itemId.slice(0, splitAt)
  const lessonNo = Number(itemId.slice(splitAt + 1))
  if (!UUID_RE.test(curriculumId) || !Number.isInteger(lessonNo) || lessonNo < 1 || lessonNo > 500) {
    return null
  }
  return { curriculumId, lessonNo }
}

async function itemBelongsToSubject(opts: SubjectItemOpenBody & { userId: string }): Promise<boolean> {
  if (opts.kind === 'review') {
    const parsed = parseReviewItemId(opts.itemId)
    if (!parsed) return false
    return lessonIsTaughtInClassPg({
      classId: opts.classId,
      teacherId: opts.teacherId,
      subjectId: opts.subjectId,
      curriculumId: parsed.curriculumId,
      lessonNo: parsed.lessonNo,
    })
  }
  const row = await pgQueryOne<{ is_practice_homework: boolean | null }>(
    `select is_practice_homework
     from public.exam_sessions
     where id = $1::uuid
       and class_id = $2::uuid
       and teacher_id = $3::uuid
       and subject_id = $4
     limit 1`,
    [opts.itemId, opts.classId, opts.teacherId, opts.subjectId]
  )
  if (!row) return false
  const homework = Boolean(row.is_practice_homework)
  if (opts.kind === 'exam') return !homework
  if (opts.kind === 'homework') return homework
  return true
}

export async function markSubjectItemOpenedForUser(
  userId: string,
  body: SubjectItemOpenBody
): Promise<{ ok: true } | { ok: false; status: number }> {
  if (!isPgConfigured()) return { ok: false, status: 503 }
  const subjectId = body.subjectId.trim()
  const itemId = body.itemId.trim()
  if (!UUID_RE.test(userId) || !UUID_RE.test(body.classId) || !UUID_RE.test(body.teacherId)) {
    return { ok: false, status: 400 }
  }
  if (!subjectId || subjectId.length > 120 || !itemId || itemId.length > 80) {
    return { ok: false, status: 400 }
  }
  if (!SUBJECT_ITEM_KINDS.includes(body.kind)) return { ok: false, status: 400 }
  if (body.kind !== 'review' && !UUID_RE.test(itemId)) return { ok: false, status: 400 }

  const member = await classMemberExistsPg(body.classId, userId)
  if (member == null) return { ok: false, status: 503 }
  if (!member) return { ok: false, status: 403 }

  const allowed = await itemBelongsToSubject({ ...body, userId, subjectId, itemId })
  if (!allowed) return { ok: false, status: 404 }

  await pgQuery(
    `insert into public.class_subject_item_opens (user_id, class_id, kind, item_id, opened_at)
     values ($1::uuid, $2::uuid, $3, $4, timezone('utc', now()))
     on conflict (user_id, class_id, kind, item_id)
     do update set opened_at = timezone('utc', now())`,
    [userId, body.classId, body.kind, itemId]
  )
  return { ok: true }
}

/** Học sinh mở /lam-bai/[code] của phiên gắn lớp thì coi bài thi hoặc bài tập đó là đã mở. */
export async function markLamBaiOpenedForMember(userId: string, code: string): Promise<void> {
  const examCode = String(code || '').trim().toUpperCase()
  if (!isPgConfigured() || examCode.length < 4 || !UUID_RE.test(userId)) return
  try {
    const row = await pgQueryOne<{
      id: string
      class_id: string | null
      teacher_id: string | null
      subject_id: string | null
      is_practice_homework: boolean | null
    }>(
      `select id::text, class_id::text, teacher_id::text, subject_id, is_practice_homework
       from public.exam_sessions
       where code = $1
       limit 1`,
      [examCode]
    )
    if (!row?.class_id || !row.teacher_id || !row.subject_id) return
    if (row.teacher_id === userId) return
    await markSubjectItemOpenedForUser(userId, {
      classId: row.class_id,
      subjectId: row.subject_id,
      teacherId: row.teacher_id,
      kind: row.is_practice_homework ? 'homework' : 'exam',
      itemId: row.id,
    })
  } catch (error) {
    console.error('[class-subject-item-opens] lam-bai', error)
  }
}
