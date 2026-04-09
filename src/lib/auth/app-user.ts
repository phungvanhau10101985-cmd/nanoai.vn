/**
 * Người dùng đã đăng nhập — kiểu nội bộ (không dùng SDK hosted cũ).
 * Giữ các trường tối thiểu mà app đang đọc (id, email, user_metadata, identities…).
 */
export type AppUser = {
  id: string
  email?: string | null
  aud?: string
  app_metadata?: Record<string, unknown>
  user_metadata?: Record<string, unknown>
  created_at?: string
  /** Tương thích đọc email từ provider cũ (hiếm) */
  identities?: Array<{ identity_data?: Record<string, unknown> }>
}
