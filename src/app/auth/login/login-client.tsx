"use client"

import { readWebLocaleFromDocumentCookie } from '@/lib/i18n/read-web-locale-cookie'
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
      const cookieValue = readWebLocaleFromDocumentCookie()
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

  const errorDisplay = (() => {
    if (!error?.trim()) return null
    const code = error.trim()
    const m = (vi: string, en: string, zh: string, ja: string, ko: string) => tr(vi, en, zh, ja, ko)
    switch (code) {
      case 'wrong_link':
        return m(
          'Link đăng nhập không khớp. Hãy dùng link trong email mới nhất, hoặc nhập mã OTP.',
          'That sign-in link does not match. Use the link in your latest email, or enter the OTP code.',
          '登录链接无效。请使用最新邮件中的链接，或输入验证码。',
          'リンクが一致しません。最新のメールのリンクを使うか、OTPを入力してください。',
          '링크가 맞지 않습니다. 최신 메일의 링크를 쓰거나 OTP를 입력하세요.'
        )
      case 'expired_or_invalid_link':
      case 'expired_link':
        return m(
          'Link đăng nhập hết hạn hoặc không hợp lệ. Gửi lại mã OTP từ trang này.',
          'This sign-in link has expired or is invalid. Request a new code from this page.',
          '链接已失效。请在本页重新发送验证码。',
          'リンクの有効期限切れか無効です。再度コードを送信してください。',
          '만료되었거나 잘못된 링크입니다. 이 페이지에서 코드를 다시 요청하세요.'
        )
      case 'invalid_link':
        return m('Link không đúng định dạng.', 'Invalid link format.', '链接格式无效。', 'リンク形式が無効です。', '잘못된 링크입니다.')
      case 'email_auth_disabled':
        return m('Đăng nhập email chưa bật trên server.', 'Email sign-in is disabled on the server.', '服务器未启用邮箱登录。', 'メールログインが無効です。', '이메일 로그인이 꺼져 있습니다.')
      case 'database':
      case 'database_not_configured':
        return m('Chưa cấu hình cơ sở dữ liệu.', 'Database is not configured.', '数据库未配置。', 'データベースが未設定です。', 'DB가 설정되지 않았습니다.')
      case 'user':
        return m('Không tạo được tài khoản.', 'Could not create account.', '无法创建账户。', 'アカウントを作成できません。', '계정을 만들 수 없습니다.')
      case 'jwt':
        return m('Lỗi cấu hình phiên đăng nhập (AUTH_JWT_SECRET).', 'Sign-in session misconfigured (AUTH_JWT_SECRET).', '登录会话配置错误。', 'ログイン設定エラー。', '로그인 설정 오류.')
      case 'auth_instances':
        return m('Thiếu cấu hình auth (auth.instances). Cần schema auth đầy đủ trên Postgres (xem pg-ensure-auth-compat).', 'Auth is not fully configured (auth.instances).', '缺少 auth 实例配置。', 'auth.instances がありません。', 'auth.instances가 없습니다.')
      case 'server':
        return m('Lỗi máy chủ. Thử lại sau.', 'Server error. Try again later.', '服务器错误。', 'サーバーエラー。', '서버 오류.')
      default:
        return code
    }
  })()

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
          {errorDisplay && (
            <div className="mb-4 rounded-md bg-destructive/15 p-3 text-sm text-destructive">
              {errorDisplay}
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
