import { NextRequest, NextResponse } from 'next/server'
import { FORCE_REAL_LOGIN_COOKIE } from '@/lib/auth'

/** Đặt cookie để tắt bypass dev, chuyển sang trang đăng nhập tài khoản thật */
export async function GET(request: NextRequest) {
  const url = new URL('/auth/login', request.url)
  const res = NextResponse.redirect(url)
  res.cookies.set(FORCE_REAL_LOGIN_COOKIE, '1', { path: '/', maxAge: 60 * 60 * 24 })
  return res
}
