import type { AppUser } from '@/lib/auth/app-user'

/** Tài khoản đăng nhập thật. Khách dùng thử và crawler xem trang giá công khai. */
export function isCatalogShopper(user: AppUser | null): user is AppUser {
  if (!user) return false
  if (user.user_metadata?.guest_trial === true) return false
  return true
}
