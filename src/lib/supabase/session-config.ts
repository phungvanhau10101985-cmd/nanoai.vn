import type { CookieOptions } from '@supabase/ssr'

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365

function isProd() {
  return process.env.NODE_ENV === 'production'
}

/**
 * Cookie options dùng chung cho Supabase auth cookies.
 * Giữ phiên đăng nhập dài hạn và tự gia hạn qua middleware.
 */
export function getSupabaseCookieOptions(): CookieOptions {
  return {
    path: '/',
    sameSite: 'lax',
    secure: isProd(),
    httpOnly: false, // Supabase SSR cần đọc cookie ở client để refresh session
    maxAge: ONE_YEAR_SECONDS,
  }
}

/**
 * Browser auth options: luôn lưu session và tự refresh token.
 */
export function getBrowserAuthOptions() {
  return {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  }
}

