import { syncCurriculumIntoMatchingClasses } from '@/lib/db/class-teacher-curricula-pg'
import { isPgConfigured } from '@/lib/db/pool'
import {
  deleteUserHiddenCurriculumPg,
  fetchWorksheetCurriculumRowByIdPg,
  upsertUserOpenedCurriculumPg,
} from '@/lib/db/tao-giao-trinh-curriculum-pg'
import { isValidUuidString } from '@/lib/validate-uuid'

/**
 * Gắn một giáo trình có sẵn vào danh sách của tài khoản:
 * bỏ ẩn nếu từng ẩn, ghi lần mở, rồi đưa vào các lớp cùng môn và cùng khối.
 */
export async function attachOpenedCurriculumToAccount(
  userId: string,
  curriculumId: string,
): Promise<{ error?: string }> {
  const accountId = userId.trim()
  const id = curriculumId.trim()
  if (!isValidUuidString(accountId) || !isValidUuidString(id)) {
    return { error: 'Mã giáo trình không hợp lệ.' }
  }
  if (!isPgConfigured()) return { error: 'DATABASE_URL is not set' }

  const row = await fetchWorksheetCurriculumRowByIdPg(id)
  if (!row) return { error: 'Không tìm thấy giáo trình.' }

  const unhide = await deleteUserHiddenCurriculumPg(accountId, id)
  if (unhide.error) return { error: unhide.error }

  const opened = await upsertUserOpenedCurriculumPg(accountId, id, new Date().toISOString(), null)
  if (opened.error) return { error: opened.error }

  await syncCurriculumIntoMatchingClasses({ teacherId: accountId, curriculumId: id })
  return {}
}
