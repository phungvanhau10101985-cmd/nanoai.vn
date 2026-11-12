import { redirect } from 'next/navigation'
import { getUserOrBypass } from '@/lib/auth'
import { isCatalogShopper } from '@/lib/catalog/catalog-shopper'
import { isPgConfigured } from '@/lib/db/pool'
import { pgCountFreeLiveStarts } from '@/lib/db/language-coach-free-live'
import { shouldLeaveLanguageLanding } from '@/lib/english-coach-free-lessons'

/**
 * Tài khoản đã học đủ hai buổi live miễn phí thì vào thẳng phòng luyện nói.
 * Phòng đó có nút tạo bài nhanh và danh sách bài cũ. Khách chưa đăng nhập vẫn xem trang giới thiệu.
 */
export async function redirectToPracticeRoomWhenFreeLessonsUsed(roomHref: string): Promise<void> {
  const user = await getUserOrBypass()
  if (!isCatalogShopper(user) || !isPgConfigured()) return
  let room: string | null = null
  try {
    const used = await pgCountFreeLiveStarts(user.id)
    if (shouldLeaveLanguageLanding(used)) room = roomHref
  } catch {
    room = null
  }
  if (room) redirect(room)
}
