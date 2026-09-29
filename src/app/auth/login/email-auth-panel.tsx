'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { sanitizeLoginNext } from '@/lib/auth/sanitize-login-next'
import { getStableEmailTrustedBrowserId } from '@/lib/auth/email-trusted-browser-client'
import {
  readGuestAuthRememberDevicePreference,
  writeGuestAuthRememberDevicePreference,
} from '@/lib/auth/guest-auth-remember-device-client'
import { fireMetaStandardEvent } from '@/lib/tracking/meta-standard-events-client'
import { ExternalLink, Mail } from 'lucide-react'
import { getWebmailInfo } from '@/lib/auth/email-webmail-helper'

const OTP_STEP_STORAGE_KEY = 'nanoai_login_otp_pending'
const OTP_STEP_MAX_AGE_MS = 20 * 60 * 1000

type OtpStepPersisted = { email: string; rememberDevice: boolean; sentAt: number }

type Props = {
  nextPath: string
  tr: (vi: string, en: string, zh: string, ja: string, ko: string) => string
}

function clearOtpStepStorage() {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.removeItem(OTP_STEP_STORAGE_KEY)
  } catch {
    // private mode / blocked
  }
}

function writeOtpStepStorage(payload: OtpStepPersisted) {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(OTP_STEP_STORAGE_KEY, JSON.stringify(payload))
  } catch {
    // ignore
  }
}

export function EmailAuthPanel({ nextPath, tr }: Props) {
  const safeNext = sanitizeLoginNext(nextPath)
  const [step, setStep] = useState<'email' | 'otp'>('email')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [rememberDevice, setRememberDevice] = useState(() => readGuestAuthRememberDevicePreference())
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const raw = window.sessionStorage.getItem(OTP_STEP_STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as Partial<OtpStepPersisted>
      const e = String(parsed.email || '').trim().toLowerCase()
      const sentAt = Number(parsed.sentAt)
      if (!e || !Number.isFinite(sentAt) || Date.now() - sentAt > OTP_STEP_MAX_AGE_MS) {
        clearOtpStepStorage()
        return
      }
      setEmail(e)
      setRememberDevice(parsed.rememberDevice !== false)
      setStep('otp')
    } catch {
      clearOtpStepStorage()
    }
  }, [])

  function persistRememberDevice(value: boolean) {
    setRememberDevice(value)
    writeGuestAuthRememberDevicePreference(value)
  }

  async function sendOtp(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    clearOtpStepStorage()
    setLoading(true)
    try {
      const res = await fetch('/api/auth/email/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          next: safeNext,
          rememberDevice,
          browserId: getStableEmailTrustedBrowserId(),
        }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        error?: string
        autoSignedIn?: boolean
        isNewUser?: boolean
        debugOtp?: string
      }
      if (!res.ok) {
        const code = typeof data.error === 'string' ? data.error : ''
        if (code === 'rate_limited') {
          setErr(tr('Quá nhiều lần gửi. Thử lại sau.', 'Too many requests.', '请求过多。', 'リクエストが多すぎます。', '요청이 너무 많습니다.'))
        } else if (code === 'resend_cooldown') {
          setErr(
            tr(
              'Vui lòng đợi một chút trước khi gửi lại mã.',
              'Please wait a moment before requesting another code.',
              '请稍后再请求验证码。',
              'しばらく待ってから再度お試しください。',
              '잠시 후 다시 요청하세요.'
            )
          )
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
      if (data.autoSignedIn) {
        if (data.isNewUser) {
          fireMetaStandardEvent('CompleteRegistration', { dedupeKey: 'auth_new_user_complete_registration' })
        }
        window.location.href = safeNext
        return
      }
      const emailNorm = email.trim().toLowerCase()
      const otpFromDev = String(data.debugOtp || '').replace(/\D/g, '').slice(0, 6)
      if (otpFromDev.length === 6) {
        setOtp(otpFromDev)
      }
      writeOtpStepStorage({ email: emailNorm, rememberDevice, sentAt: Date.now() })
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
        body: JSON.stringify({
          email: email.trim(),
          otp: otp.replace(/\D/g, ''),
          rememberDevice,
          browserId: getStableEmailTrustedBrowserId(),
          next: safeNext,
        }),
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
      const okData = (await res.json().catch(() => ({}))) as { isNewUser?: boolean }
      if (okData.isNewUser) {
        fireMetaStandardEvent('CompleteRegistration', { dedupeKey: 'auth_new_user_complete_registration' })
      }
      clearOtpStepStorage()
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
        <label className="flex items-start gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4"
            checked={rememberDevice}
            onChange={(e) => persistRememberDevice(e.target.checked)}
          />
          <span>
            {tr(
              'Tin cậy thiết bị/trình duyệt này lâu dài (không cần OTP khi đăng nhập lại).',
              'Trust this device/browser long term (skip OTP when signing in again).',
              '长期信任此设备/浏览器（再次登录时可免 OTP）。',
              'この端末/ブラウザを長期間信頼する（再ログイン時にOTP不要）。',
              '이 기기/브라우저를 장기간 신뢰(다시 로그인할 때 OTP 생략).'
            )}
          </span>
        </label>
        <Button type="submit" disabled={loading} className="w-full h-11">
          <Mail className="mr-2 h-4 w-4" />
          {loading
            ? tr('Đang gửi…', 'Sending…', '发送中…', '送信中…', '전송 중…')
            : tr('Gửi mã OTP', 'Send code', '发送验证码', 'コードを送る', '코드 보내기')}
        </Button>
      </form>
    )
  }

  const webmail = getWebmailInfo(email)

  return (
    <form onSubmit={verifyOtp} className="space-y-3">
      {err && <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">{err}</div>}
      <p className="text-sm text-muted-foreground">
        {tr('Nhập mã 6 số trong email (hoặc bấm link trong email).', 'Enter the 6-digit code from your email.', '请输入邮件中的 6 位验证码。', 'メールの6桁コードを入力。', '이메일의 6자리 코드를 입력하세요.')}
      </p>
      <div className="rounded-lg border border-amber-300 bg-amber-50/80 p-3 text-xs leading-relaxed text-amber-900 dark:border-amber-700/50 dark:bg-amber-950/30 dark:text-amber-200">
        <p className="font-semibold text-red-600 dark:text-red-400">
          {tr(
            'Vui lòng kiểm tra mã OTP trong Hộp thư đến, Thư rác (Spam) hoặc Thùng rác (Trash).',
            'Please check your OTP in Inbox, Spam/Junk, or Trash folder.',
            '请在收件箱、垃圾邮件或已删除邮件（废纸篓/垃圾箱）中查看 OTP 验证码。',
            '受信トレイ、迷惑メール、またはゴミ箱フォルダでOTPコードをご確認ください。',
            '받은편지함, 스팸함 또는 휴지통에서 OTP 코드를 확인해 주세요.'
          )}
        </p>
        <p className="mt-1 text-muted-foreground">
          {tr(
            'Email có thể bị bộ lọc chuyển vào Thư rác hoặc Thùng rác, hãy tìm mã cả ở Thùng rác.',
            'The email might be filtered into Spam or Trash, please check Trash as well.',
            '邮件可能被分类至垃圾箱或废纸篓中，请务必一并在废纸篓中查找验证码。',
            'メールが迷惑メールやゴミ箱に入っている可能性があるため、ゴミ箱内もご確認ください。',
            '이메일이 스팸함이나 휴지통으로 분류되었을 수 있으니 휴지통에서도 코드를 확인해 주세요.'
          )}
        </p>
        <div className="mt-2.5">
          <a
            href={webmail.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-semibold text-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <Mail className="h-3.5 w-3.5 text-red-500" />
            <span>
              {webmail.isGmail
                ? tr('Mở Gmail kiểm tra mã', 'Open Gmail to check code', '打开 Gmail 查看验证码', 'Gmailを開いて確認', 'Gmail 열어 확인하기')
                : tr('Mở hộp thư kiểm tra mã', 'Open mailbox to check code', '打开邮箱查看验证码', 'メールボックスを開いて確認', '메일함 열어 확인하기')}
            </span>
            <ExternalLink className="h-3 w-3 opacity-60" />
          </a>
        </div>
      </div>
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
      <label className="flex items-start gap-2 text-sm text-muted-foreground">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4"
          checked={rememberDevice}
          onChange={(e) => persistRememberDevice(e.target.checked)}
        />
        <span>
          {tr(
            'Tin cậy thiết bị/trình duyệt này lâu dài (không cần OTP khi đăng nhập lại).',
            'Trust this device/browser long term (skip OTP when signing in again).',
            '长期信任此设备/浏览器（再次登录时可免 OTP）。',
            'この端末/ブラウザを長期間信頼する（再ログイン時にOTP不要）。',
            '이 기기/브라우저를 장기간 신뢰(다시 로그인할 때 OTP 생략).'
          )}
        </span>
      </label>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          onClick={() => {
            clearOtpStepStorage()
            setStep('email')
            setOtp('')
            setErr(null)
          }}
        >
          {tr('Quay lại', 'Back', '返回', '戻る', '뒤로')}
        </Button>
        <Button type="submit" disabled={loading || otp.length !== 6} className="flex-1">
          {loading ? '…' : tr('Đăng nhập', 'Sign in', '登录', 'ログイン', '로그인')}
        </Button>
      </div>
    </form>
  )
}
