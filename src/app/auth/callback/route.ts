import { createSupabaseMutableCookiesClient } from '@/lib/supabase/mutable-cookies-client'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { FORCE_REAL_LOGIN_COOKIE } from '@/lib/auth'
import { sanitizeLoginNext } from '@/lib/auth/sanitize-login-next'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const searchParams = url.searchParams
  const forwardedHost = request.headers.get('x-forwarded-host') ?? request.headers.get('host')
  const forwardedProto = request.headers.get('x-forwarded-proto') ?? 'https'
  const envOrigin = process.env.APP_URL || process.env.NEXT_PUBLIC_BASE_URL || ''
  // Localhost: dùng url.origin (đúng protocol từ request), tránh redirect về https://localhost
  const isLocal = forwardedHost?.includes('localhost') || forwardedHost?.includes('127.0.0.1')
  const origin = isLocal
    ? url.origin
    : forwardedHost
      ? `${forwardedProto}://${forwardedHost}`.replace(/\/$/, '')
      : (envOrigin || url.origin)
  const code = searchParams.get('code')
  const next = sanitizeLoginNext(searchParams.get('next'))

  const supabase = createSupabaseMutableCookiesClient()

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      const cookieStore = cookies()
      const pendingGender = cookieStore?.get('pending_gender')?.value

      if (pendingGender) {
        await supabase.auth.updateUser({
          data: {
            gender: pendingGender,
          },
        })
      }

      const response = NextResponse.redirect(`${origin}${next}`)
      if (pendingGender) {
        response.cookies.set('pending_gender', '', { path: '/', maxAge: 0 })
      }
      response.cookies.set(FORCE_REAL_LOGIN_COOKIE, '', { path: '/', maxAge: 0 })

      return response
    }

    // Mã OAuth/magic link thường chỉ dùng 1 lần: lần gọi thứ 2 (prefetch email, double-click, tab trùng)
    // sẽ lỗi dù phiên đã được thiết lập ở lần 1 — đừng đẩy user sang trang lỗi nếu đã đăng nhập.
    if (error) {
      console.warn('[auth/callback] exchangeCodeForSession failed:', error.message)
    }
    const {
      data: { user: recoveredUser },
    } = await supabase.auth.getUser()
    if (recoveredUser) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  } else {
    // Không có ?code= nhưng đã có phiên (ví dụ mở lại URL callback cũ)
    const {
      data: { user: existingUser },
    } = await supabase.auth.getUser()
    if (existingUser) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/auth/auth-code-error`)
}
