import { NextResponse } from 'next/server'
import { sanitizeLoginNext } from '@/lib/auth/sanitize-login-next'

/** OAuth/PKCE đã bỏ — chỉ đăng nhập email (OTP). */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const forwardedHost = request.headers.get('x-forwarded-host') ?? request.headers.get('host')
  const forwardedProto = request.headers.get('x-forwarded-proto') ?? 'https'
  const envOrigin = process.env.APP_URL || process.env.NEXT_PUBLIC_BASE_URL || ''
  const isLocal = forwardedHost?.includes('localhost') || forwardedHost?.includes('127.0.0.1')
  const origin = isLocal
    ? url.origin
    : forwardedHost
      ? `${forwardedProto}://${forwardedHost}`.replace(/\/$/, '')
      : envOrigin.replace(/\/$/, '') || url.origin

  const next = sanitizeLoginNext(url.searchParams.get('next'))
  const q = new URLSearchParams()
  q.set('notice', 'Đăng nhập bằng email (OTP) — không còn OAuth.')
  if (next) q.set('next', next)

  return NextResponse.redirect(`${origin}/auth/login?${q.toString()}`)
}
