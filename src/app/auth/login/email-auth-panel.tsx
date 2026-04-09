'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { sanitizeLoginNext } from '@/lib/auth/sanitize-login-next'
import { Mail } from 'lucide-react'

type Props = {
  nextPath: string
  tr: (vi: string, en: string, zh: string, ja: string, ko: string) => string
}

export function EmailAuthPanel({ nextPath, tr }: Props) {
  const safeNext = sanitizeLoginNext(nextPath)
  const [step, setStep] = useState<'email' | 'otp'>('email')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function sendOtp(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    setLoading(true)
    try {
      const res = await fetch('/api/auth/email/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), next: safeNext }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        const code = typeof data.error === 'string' ? data.error : ''
        if (code === 'rate_limited') {
          setErr(tr('Quá nhiều lần gửi. Thử lại sau.', 'Too many requests.', '请求过多。', 'リクエストが多すぎます。', '요청이 너무 많습니다.'))
        } else if (code === 'smtp_not_configured') {
          setErr(
            tr(
              'Chưa cấu hình SMTP (SMTP_HOST / SMTP_USER / SMTP_PASS / SMTP_FROM).',
              'SMTP is not configured (SMTP_HOST / SMTP_USER / SMTP_PASS / SMTP_FROM).',
              '未配置 SMTP。',
              'SMTP が未設定です。',
              'SMTP가 설정되지 않았습니다.'
            )
          )
        } else if (code === 'email_auth_disabled') {
          setErr(tr('Đăng nhập email chưa bật (EMAIL_AUTH_ENABLED).', 'Email sign-in is disabled.', '未启用邮箱登录。', 'メールログインが無効です。', '이메일 로그인이 꺼져 있습니다.'))
        } else if (code === 'database_not_configured') {
          setErr(tr('Chưa cấu hình DATABASE_URL.', 'Database is not configured.', '数据库未配置。', 'DB が未設定です。', 'DB가 설정되지 않았습니다.'))
        } else if (code && code.length < 400) {
          setErr(
            tr(
              `Không gửi được email. Chi tiết: ${code}`,
              `Could not send email. Details: ${code}`,
              `无法发送邮件：${code}`,
              `メール送信失敗: ${code}`,
              `이메일 전송 실패: ${code}`
            )
          )
        } else {
          setErr(
            tr(
              'Không gửi được email. Kiểm tra SMTP; xem thư mục spam. Khởi động lại server sau khi sửa .env.local.',
              'Could not send email. Check SMTP and spam folder. Restart the server after changing .env.local.',
              '无法发送邮件。请检查 SMTP 与垃圾邮件。',
              'メールを送信できません。SMTPと迷惑メールを確認。',
              '이메일을 보낼 수 없습니다. SMTP·스팸함 확인.'
            )
          )
        }
        setLoading(false)
        return
      }
      setStep('otp')
    } catch {
      setErr(tr('Lỗi mạng.', 'Network error.', '网络错误。', 'ネットワークエラー。', '네트워크 오류.'))
    }
    setLoading(false)
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    setLoading(true)
    try {
      const res = await fetch('/api/auth/email/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), otp: otp.replace(/\D/g, '') }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setErr(
          data.error === 'wrong_otp'
            ? tr('Sai mã OTP.', 'Invalid code.', '验证码错误。', 'コードが違います。', '코드가 올바르지 않습니다.')
            : tr('Đăng nhập thất bại.', 'Sign-in failed.', '登录失败。', 'ログインに失敗しました。', '로그인 실패.')
        )
        setLoading(false)
        return
      }
      window.location.href = safeNext
    } catch {
      setErr(tr('Lỗi mạng.', 'Network error.', '网络错误。', 'ネットワークエラー。', '네트워크 오류.'))
    }
    setLoading(false)
  }

  if (step === 'email') {
    return (
      <form onSubmit={sendOtp} className="space-y-3">
        {err && <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">{err}</div>}
        <p className="text-sm text-muted-foreground">
          {tr(
            'Nhập email — bạn sẽ nhận mã OTP và link đăng nhập (hết hạn 15 phút).',
            'Enter your email — you will receive an OTP and a sign-in link (expires in 15 minutes).',
            '输入邮箱 — 您将收到验证码和登录链接（15 分钟内有效）。',
            'メールを入力 — OTPとログインリンクが届きます（15分で失効）。',
            '이메일을 입력하세요 — OTP와 로그인 링크가 전송됩니다(15분 유효).'
          )}
        </p>
        <Input
          type="email"
          name="email"
          autoComplete="email"
          placeholder={tr('Email', 'Email', '邮箱', 'メール', '이메일')}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="h-11"
        />
        <Button type="submit" disabled={loading} className="w-full h-11">
          <Mail className="mr-2 h-4 w-4" />
          {loading
            ? tr('Đang gửi…', 'Sending…', '发送中…', '送信中…', '전송 중…')
            : tr('Gửi mã OTP', 'Send code', '发送验证码', 'コードを送る', '코드 보내기')}
        </Button>
      </form>
    )
  }

  return (
    <form onSubmit={verifyOtp} className="space-y-3">
      {err && <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">{err}</div>}
      <p className="text-sm text-muted-foreground">
        {tr('Nhập mã 6 số trong email (hoặc bấm link trong email).', 'Enter the 6-digit code from your email.', '请输入邮件中的 6 位验证码。', 'メールの6桁コードを入力。', '이메일의 6자리 코드를 입력하세요.')}
      </p>
      <Input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={6}
        placeholder="000000"
        value={otp}
        onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
        className="h-11 text-center text-lg tracking-widest"
        autoComplete="one-time-code"
      />
      <div className="flex gap-2">
        <Button type="button" variant="outline" className="flex-1" onClick={() => { setStep('email'); setOtp(''); setErr(null) }}>
          {tr('Quay lại', 'Back', '返回', '戻る', '뒤로')}
        </Button>
        <Button type="submit" disabled={loading || otp.length !== 6} className="flex-1">
          {loading ? '…' : tr('Đăng nhập', 'Sign in', '登录', 'ログイン', '로그인')}
        </Button>
      </div>
    </form>
  )
}
