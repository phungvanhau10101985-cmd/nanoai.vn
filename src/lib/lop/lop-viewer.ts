import type { AppUser } from '@/lib/auth/app-user'
import { getUserForAction, getUserOrBypass } from '@/lib/auth'
import { pgQueryOne } from '@/lib/db/pg-query'
import { isPgConfigured } from '@/lib/db/pool'
import { readClassBrowserSession } from '@/lib/lop/class-browser-session'
import { isValidUuidString } from '@/lib/validate-uuid'

function asUser(id: string, email: string | null | undefined): AppUser {
  return {
    id,
    email: email || null,
    aud: 'authenticated',
    app_metadata: {},
    user_metadata: {},
    created_at: new Date().toISOString(),
  }
}

async function isClassTeacher(classId: string, userId: string): Promise<boolean> {
  if (!isPgConfigured() || !isValidUuidString(classId) || !isValidUuidString(userId)) return false
  try {
    const row = await pgQueryOne<{ ok: number }>(
      `select 1 as ok
       where exists (select 1 from public.classes c where c.id = $1::uuid and c.teacher_id = $2::uuid)
          or exists (select 1 from public.class_subjects s where s.class_id = $1::uuid and s.teacher_id = $2::uuid)
       limit 1`,
      [classId, userId]
    )
    return row != null
  } catch {
    return false
  }
}

async function opensClassAsSelf(classId: string, userId: string): Promise<boolean> {
  if (!isPgConfigured() || !isValidUuidString(classId) || !isValidUuidString(userId)) return false
  try {
    const row = await pgQueryOne<{ ok: number }>(
      `select 1 as ok
       where exists (select 1 from public.classes c where c.id = $1::uuid and c.teacher_id = $2::uuid)
          or exists (select 1 from public.class_subjects s where s.class_id = $1::uuid and s.teacher_id = $2::uuid)
          or exists (select 1 from public.class_members m where m.class_id = $1::uuid and m.user_id = $2::uuid)
       limit 1`,
      [classId, userId]
    )
    return row != null
  } catch {
    return false
  }
}

async function linkedStudentInClass(classId: string, googleUserId: string): Promise<string | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<{ user_id: string }>(
      `select m.user_id::text as user_id
       from public.class_members m
       join auth.users u on u.id = m.user_id
       where m.class_id = $1::uuid
         and u.raw_user_meta_data->>'linked_google_user_id' = $2::text
       limit 1`,
      [classId, googleUserId]
    )
    const id = String(row?.user_id ?? '').trim()
    return isValidUuidString(id) ? id : null
  } catch {
    return null
  }
}

/**
 * Hồ sơ học sinh dùng để vào lớp và làm bài.
 * Tài khoản đang đăng nhập nếu đã là thành viên. Nếu không, hồ sơ đã gắn Gmail, rồi cookie mã định danh.
 */
export async function actingStudentUserId(accountUserId: string, classId: string | null | undefined): Promise<string> {
  if (!classId) return accountUserId
  if (await isClassTeacher(classId, accountUserId)) return accountUserId
  const browser = await readClassBrowserSession()
  if (browser && browser.classId === classId && (await opensClassAsSelf(classId, browser.userId))) {
    return browser.userId
  }
  if (await opensClassAsSelf(classId, accountUserId)) return accountUserId
  const linked = await linkedStudentInClass(classId, accountUserId)
  if (linked) return linked
  return accountUserId
}

/** Đã vào lớp này thì mới được mở bài thi gắn lớp. */
export async function canTakeClassExam(classId: string, accountUserId: string | null): Promise<boolean> {
  if (accountUserId && (await isClassTeacher(classId, accountUserId))) return true
  if (accountUserId && (await opensClassAsSelf(classId, accountUserId))) return true
  if (accountUserId) {
    const linked = await linkedStudentInClass(classId, accountUserId)
    if (linked) return true
  }
  const browser = await readClassBrowserSession()
  return Boolean(browser && browser.classId === classId && (await opensClassAsSelf(classId, browser.userId)))
}

/** Phiên làm bài: tài khoản đang đăng nhập, hoặc cookie mã định danh khi chưa đăng nhập Google. */
export async function resolveExamActor(): Promise<AppUser | null> {
  const auth = await getUserForAction()
  if (!('error' in auth)) return auth.user
  const browser = await readClassBrowserSession()
  if (!browser) return null
  return asUser(browser.userId, browser.email)
}

/** Người xem lớp: giáo viên giữ tài khoản của mình. Học sinh Gmail đã gắn mã thì mở đúng một hồ sơ. */
export async function getLopViewer(classId: string): Promise<AppUser | null> {
  const session = await getUserOrBypass()
  if (!session) {
    const browser = await readClassBrowserSession()
    if (browser && browser.classId === classId && (await opensClassAsSelf(classId, browser.userId))) {
      return asUser(browser.userId, browser.email)
    }
    return null
  }
  const actorId = await actingStudentUserId(session.id, classId)
  if (actorId === session.id) return session
  return asUser(actorId, session.email)
}
