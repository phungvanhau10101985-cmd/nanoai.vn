import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getSupabaseCookieOptions } from './session-config'

/**
 * Client cho Server Action & Route Handler — ghi cookie session/PKCE bình thường.
 * Khác `server.ts`: không try/catch nuốt lỗi `cookies().set`, tránh OAuth đổi mã thành công
 * nhưng cookie không lưu → user không đăng nhập được.
 */
export function createSupabaseMutableCookiesClient() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: getSupabaseCookieOptions(),
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          cookieStore.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          cookieStore.set({ name, value: '', ...options })
        },
      },
    }
  )
}
