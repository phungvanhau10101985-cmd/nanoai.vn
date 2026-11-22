import { NextResponse } from 'next/server'
import { EMAIL_SESSION_COOKIE, EMAIL_SESSION_COOKIE_LEGACY } from '@/lib/auth/email-auth-config'
import { createEmailSessionTokenString, getEmailSessionCookieOptions } from '@/lib/auth/email-session-token'
import {
  LOCAL_PHONE_NGROK_ORIGIN,
  phoneRemoteBrowserOrigin,
  readLanDevOrigin,
  readRunningNgrokOrigin,
} from '@/lib/curriculum/phone-remote-public-origin'
import { phoneTeacherReturnPath, redeemPhoneRemoteLogin } from '@/lib/curriculum/phone-remote-store'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const redeemed = await redeemPhoneRemoteLogin(url.searchParams.get('k') || '')
  if (!redeemed) {
    return new NextResponse('Mã điều khiển không còn hiệu lực. Tạo mã mới trên máy giáo viên.', {
      status: 404,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    })
  }
  const token = await createEmailSessionTokenString(redeemed.userId, redeemed.email)
  if (!token) {
    return new NextResponse('Không đăng nhập được tài khoản giáo viên.', {
      status: 500,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    })
  }
  const browserOrigin =
    phoneRemoteBrowserOrigin({
      forwardedHost: req.headers.get('x-forwarded-host'),
      host: req.headers.get('host'),
      forwardedProto: req.headers.get('x-forwarded-proto'),
    }) || readLanDevOrigin(Number(url.port || 3000)) || (await readRunningNgrokOrigin()) || LOCAL_PHONE_NGROK_ORIGIN
  const next = new URL(phoneTeacherReturnPath(redeemed.snapshot, redeemed.id), browserOrigin)
  const res = NextResponse.redirect(next)
  const opts = getEmailSessionCookieOptions()
  res.cookies.set(EMAIL_SESSION_COOKIE, token, opts)
  res.cookies.set(EMAIL_SESSION_COOKIE_LEGACY, token, opts)
  return res
}
