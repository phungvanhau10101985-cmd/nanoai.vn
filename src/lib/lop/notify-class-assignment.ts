import { deliverUserNotificationPg } from '@/lib/notifications/deliver-user-notification-pg'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'
import { isPgConfigured } from '@/lib/db/pool'

/** Gửi chuông và email cho học sinh trong lớp khi cô giao bài. Không gửi cho giáo viên. */
export async function notifyClassStudentsOfAssignment(opts: {
  classId: string
  teacherUserId: string
  sessionId: string
  title: string
  code: string
  homework: boolean
}): Promise<void> {
  if (!isPgConfigured()) return
  const classId = opts.classId.trim()
  const teacherUserId = opts.teacherUserId.trim()
  const sessionId = opts.sessionId.trim()
  if (!classId || !teacherUserId || !sessionId) return

  const cls = await pgQueryOne<{ name: string | null }>(
    `select name from public.classes where id = $1::uuid limit 1`,
    [classId]
  )
  if (!cls) return

  const members = await pgQuery<{ user_id: string }>(
    `select m.user_id::text
     from public.class_members m
     join public.classes c on c.id = m.class_id
     where m.class_id = $1::uuid
       and m.user_id <> $2::uuid
       and m.user_id <> c.teacher_id
       and not exists (
         select 1 from public.class_subjects s
         where s.class_id = m.class_id and s.teacher_id = m.user_id
       )`,
    [classId, teacherUserId]
  )
  if (members.length === 0) return

  const className = String(cls.name ?? '').trim() || 'Lớp'
  const workTitle = opts.title.trim() || (opts.homework ? 'Bài tập về nhà' : 'Bài thi')
  const title = opts.homework ? `Bài tập mới: ${workTitle}` : `Bài thi mới: ${workTitle}`
  const body = `${className} vừa được giao «${workTitle}». Mở bài trong lớp để làm.`
  const pushUrl = `/lam-bai/${encodeURIComponent(opts.code.trim())}`

  await Promise.all(
    members.map((member) =>
      deliverUserNotificationPg({
        user_id: member.user_id,
        type: 'class_assignment',
        title,
        body,
        meta: {
          idempotency_key: `class-assign:${sessionId}`,
          push_url: pushUrl,
          class_id: classId,
          session_id: sessionId,
        },
      }).catch((error) => {
        console.warn('[notifyClassStudentsOfAssignment]', member.user_id, error)
        return false
      })
    )
  )
}
