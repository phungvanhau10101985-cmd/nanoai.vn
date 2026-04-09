"use client"

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { sanitizeLoginNext } from '@/lib/auth/sanitize-login-next'
import { EmailAuthPanel } from './email-auth-panel'

type LoginClientProps = {
  message?: string
  notice?: string
  error?: string
  nextPath?: string
  emailAuthEnabled?: boolean
}

export default function LoginClient({
  message,
  notice,
  error,
  nextPath,
  emailAuthEnabled,
}: LoginClientProps) {
  const safeNextPath = sanitizeLoginNext(nextPath)
  const [uiLocale, setUiLocale] = useState<'vi' | 'en' | 'zh' | 'ja' | 'ko'>('vi')
  const tr = (vi: string, en: string, zh: string, ja: string, ko: string) => {
    if (uiLocale === 'en') return en
    if (uiLocale === 'zh') return zh
    if (uiLocale === 'ja') return ja
    if (uiLocale === 'ko') return ko
    return vi
  }

  useEffect(() => {
    const syncLocale = () => {
      const cookieValue = document.cookie
        .split(';')
        .map((x) => x.trim())
        .find((x) => x.startsWith('nanoai_locale='))
        ?.split('=')[1]
        ?.trim()
        .toLowerCase()
      if (cookieValue === 'en' || cookieValue === 'zh' || cookieValue === 'ja' || cookieValue === 'ko') setUiLocale(cookieValue)
      else setUiLocale('vi')
    }
    syncLocale()
    const timer = window.setInterval(syncLocale, 1000)
    window.addEventListener('focus', syncLocale)
    document.addEventListener('visibilitychange', syncLocale)
    return () => {
      window.removeEventListener('focus', syncLocale)
      document.removeEventListener('visibilitychange', syncLocale)
      window.clearInterval(timer)
    }
  }, [])

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-white to-indigo-50 px-4 py-10">
      <Card className="w-full max-w-md border-muted/60 shadow-lg">
        <CardHeader className="text-center space-y-2">
          <CardTitle className="text-2xl font-bold">{tr('Đăng nhập', 'Sign in', '登录', 'ログイン', '로그인')}</CardTitle>
          <CardDescription>
            {tr(
              'Đăng nhập bằng email (mã OTP hoặc link trong email).',
              'Sign in with email (OTP code or link in your inbox).',
              '使用邮箱登录（验证码或邮件中的链接）。',
              'メール（OTPまたは受信トレイのリンク）でログイン。',
              '이메일(OTP 또는 받은편지함 링크)로 로그인.'
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {message && (
            <div className="mb-4 rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">
              {message}
            </div>
          )}
          {notice && (
            <div className="mb-4 rounded-md bg-sky-50 p-3 text-sm text-sky-800">
              {notice}
            </div>
          )}
          {error && (
            <div className="mb-4 rounded-md bg-destructive/15 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {emailAuthEnabled ? (
            <EmailAuthPanel nextPath={safeNextPath} tr={tr} />
          ) : (
            <p className="text-sm text-muted-foreground text-center">
              {tr(
                'Chưa bật EMAIL_AUTH_ENABLED trên server — liên hệ quản trị.',
                'EMAIL_AUTH_ENABLED is not set — contact your administrator.',
                '服务器未启用邮箱登录，请联系管理员。',
                'サーバーでメールログインが有効ではありません。',
                '서버에서 이메일 로그인이 켜져 있지 않습니다.'
              )}
            </p>
          )}
        </CardContent>
        <CardFooter className="text-xs text-muted-foreground">
          {tr('Thông tin cá nhân của bạn được bảo mật an toàn.', 'Your personal information is securely protected.', '你的个人信息将被安全保护。', '個人情報は安全に保護されます。', '개인정보는 안전하게 보호됩니다.')}
        </CardFooter>
      </Card>
    </div>
  )
}
