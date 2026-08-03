"use client"

import { readWebLocaleFromDocumentCookie } from '@/lib/i18n/read-web-locale-cookie'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { sanitizeLoginNext } from '@/lib/auth/sanitize-login-next'
import { EmailAuthPanel } from './email-auth-panel'
import { signInWithGoogle } from '../actions'

type LoginClientProps = {
  message?: string
  notice?: string
  error?: string
  nextPath?: string
  emailAuthEnabled?: boolean
  googleAuthEnabled?: boolean
}

export default function LoginClient({
  message,
  notice,
  error,
  nextPath,
  emailAuthEnabled,
  googleAuthEnabled,
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
      case 'google_auth_disabled':
        return m(
          'Đăng nhập Google chưa bật trên server (GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET).',
          'Google sign-in is not enabled on the server (GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET).',
          '服务器未启用 Google 登录。',
          'Google ログインが有効ではありません。',
          '서버에서 Google 로그인이 활성화되지 않았습니다.'
        )
      case 'google_oauth_denied':
        return m('Bạn đã hủy đăng nhập Google.', 'Google sign-in was cancelled.', '已取消 Google 登录。', 'Google ログインがキャンセルされました。', 'Google 로그인이 취소되었습니다.')
      case 'google_oauth_failed':
        return m('Đăng nhập Google thất bại. Thử lại hoặc dùng email OTP.', 'Google sign-in failed. Try again or use email OTP.', 'Google 登录失败。请重试或使用邮箱 OTP。', 'Google ログインに失敗しました。', 'Google 로그인에 실패했습니다.')
      case 'google_email_unverified':
        return m('Email Google chưa xác minh.', 'Google email is not verified.', 'Google 邮箱未验证。', 'Google メールが未確認です。', 'Google 이메일이 인증되지 않았습니다.')
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
            {googleAuthEnabled
              ? tr(
                  'Đăng nhập bằng Google hoặc email (mã OTP / link trong email).',
                  'Sign in with Google or email (OTP code or inbox link).',
                  '使用 Google 或邮箱登录（验证码或邮件链接）。',
                  'Google またはメール（OTP/リンク）でログイン。',
                  'Google 또는 이메일(OTP/링크)로 로그인.'
                )
              : tr(
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
            <>
              {googleAuthEnabled ? (
                <>
                  <form action={signInWithGoogle} className="space-y-3">
                    <input type="hidden" name="next" value={safeNextPath} />
                    <Button type="submit" variant="outline" className="flex w-full h-11 items-center justify-center">
                      <GoogleIcon />
                      <span className="ml-2">
                        {tr('Đăng nhập bằng Google', 'Continue with Google', '使用 Google 登录', 'Google でログイン', 'Google로 로그인')}
                      </span>
                    </Button>
                  </form>
                  <div className="relative my-5">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background px-2 text-muted-foreground">
                        {tr('Hoặc dùng email', 'Or use email', '或使用邮箱', 'またはメール', '또는 이메일')}
                      </span>
                    </div>
                  </div>
                </>
              ) : null}
              <EmailAuthPanel nextPath={safeNextPath} tr={tr} />
            </>
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

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  )
}
