'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { readWebLocaleFromDocumentCookie } from '@/lib/i18n/read-web-locale-cookie'
import type { WebLocale } from '@/lib/i18n/config'
import { isStepUpRequiredError, type StepUpScope } from '@/lib/auth/step-up-otp-shared'
import {
  checkStepUpSessionAction,
  requestStepUpOtpAction,
  verifyStepUpOtpAction,
} from '@/lib/auth/step-up-actions'

type StepUpOtpContextValue = {
  scope: StepUpScope
  isActive: boolean
  expiresAt: string | null
  refreshSession: () => Promise<void>
  ensureStepUp: () => Promise<boolean>
  runWithStepUp: <T>(fn: () => Promise<T>) => Promise<T>
}

const StepUpOtpContext = createContext<StepUpOtpContextValue | null>(null)

function tr(locale: WebLocale, vi: string, en: string, zh: string, ja: string, ko: string) {
  if (locale === 'en') return en
  if (locale === 'zh') return zh
  if (locale === 'ja') return ja
  if (locale === 'ko') return ko
  return vi
}

export function StepUpOtpProvider({ scope, children }: { scope: StepUpScope; children: ReactNode }) {
  const { toast } = useToast()
  const [uiLocale, setUiLocale] = useState<WebLocale>('vi')
  const [isActive, setIsActive] = useState(false)
  const [expiresAt, setExpiresAt] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [otpStep, setOtpStep] = useState<'send' | 'confirm'>('send')
  const [otpInput, setOtpInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [pendingResolve, setPendingResolve] = useState<((ok: boolean) => void) | null>(null)

  useEffect(() => {
    const sync = () => setUiLocale(readWebLocaleFromDocumentCookie())
    sync()
    window.addEventListener('focus', sync)
    document.addEventListener('visibilitychange', sync)
    return () => {
      window.removeEventListener('focus', sync)
      document.removeEventListener('visibilitychange', sync)
    }
  }, [])

  const refreshSession = useCallback(async () => {
    const res = await checkStepUpSessionAction(scope)
    if ('error' in res) {
      setIsActive(false)
      setExpiresAt(null)
      return
    }
    setIsActive(res.active)
    setExpiresAt(res.expiresAt ?? null)
  }, [scope])

  useEffect(() => {
    void refreshSession()
  }, [refreshSession])

  const finishEnsure = useCallback(
    (ok: boolean) => {
      setDialogOpen(false)
      setOtpInput('')
      setOtpStep('send')
      pendingResolve?.(ok)
      setPendingResolve(null)
      if (ok) void refreshSession()
    },
    [pendingResolve, refreshSession]
  )

  const ensureStepUp = useCallback(async (): Promise<boolean> => {
    const res = await checkStepUpSessionAction(scope)
    if (!('error' in res) && res.active) {
      setIsActive(true)
      setExpiresAt(res.expiresAt ?? null)
      return true
    }
    return new Promise<boolean>((resolve) => {
      setPendingResolve(() => resolve)
      setOtpStep('send')
      setOtpInput('')
      setDialogOpen(true)
    })
  }, [scope])

  const runWithStepUp = useCallback(
    async <T,>(fn: () => Promise<T>): Promise<T> => {
      let result = await fn()
      if (isStepUpRequiredError(result)) {
        const ok = await ensureStepUp()
        if (!ok) return result
        result = await fn()
      }
      return result
    },
    [ensureStepUp]
  )

  const sendOtp = async () => {
    setBusy(true)
    const res = await requestStepUpOtpAction(scope)
    setBusy(false)
    if ('error' in res) {
      toast({ title: tr(uiLocale, 'Lỗi', 'Error', '错误', 'エラー', '오류'), description: res.error, variant: 'destructive' })
      return
    }
    const debugOtp = 'debugOtp' in res ? String(res.debugOtp ?? '').replace(/\D/g, '').slice(0, 6) : ''
    if (debugOtp) {
      setOtpInput(debugOtp)
      toast({
        title: tr(uiLocale, 'OTP dev', 'Dev OTP', '开发OTP', '開発OTP', 'Dev OTP'),
        description: tr(
          uiLocale,
          `Mã OTP (dev): ${debugOtp} — đã điền sẵn, bấm Xác minh.`,
          `Dev OTP: ${debugOtp} — prefilled, click Verify.`,
          `开发 OTP：${debugOtp} — 已填入，请点击验证。`,
          `開発 OTP: ${debugOtp} — 入力済み、確認を押してください。`,
          `Dev OTP: ${debugOtp} — 입력됨, 인증을 누르세요.`
        ),
      })
      setOtpStep('confirm')
      return
    }
    toast({
      title: tr(uiLocale, 'Đã gửi OTP', 'OTP sent', '已发送OTP', 'OTPを送信しました', 'OTP 전송됨'),
      description: tr(
        uiLocale,
        'Kiểm tra email đăng nhập của bạn.',
        'Check your login email.',
        '请查收登录邮箱。',
        'ログインメールを確認してください。',
        '로그인 이메일을 확인하세요.'
      ),
    })
    setOtpStep('confirm')
  }

  const verifyOtp = async () => {
    const otp = otpInput.replace(/\D/g, '').trim()
    if (otp.length !== 6) {
      toast({
        title: tr(uiLocale, 'OTP không hợp lệ', 'Invalid OTP', 'OTP无效', 'OTPが無効です', 'OTP가 유효하지 않습니다'),
        description: tr(uiLocale, 'Nhập đủ 6 số.', 'Enter 6 digits.', '请输入6位数字。', '6桁を入力してください。', '6자리를 입력하세요.'),
        variant: 'destructive',
      })
      return
    }
    setBusy(true)
    const res = await verifyStepUpOtpAction(scope, otp)
    setBusy(false)
    if ('error' in res) {
      toast({ title: tr(uiLocale, 'Lỗi', 'Error', '错误', 'エラー', '오류'), description: res.error, variant: 'destructive' })
      return
    }
    toast({
      title: tr(uiLocale, 'Xác minh thành công', 'Verified', '验证成功', '確認完了', '인증 완료'),
      description: tr(
        uiLocale,
        'Bạn có thể thực hiện thao tác nhạy cảm trong 15 phút.',
        'You can perform sensitive actions for 15 minutes.',
        '15分钟内可执行敏感操作。',
        '15分間、機密操作が可能です。',
        '15분 동안 민감한 작업을 수행할 수 있습니다.'
      ),
    })
    finishEnsure(true)
  }

  const value = useMemo(
    () => ({ scope, isActive, expiresAt, refreshSession, ensureStepUp, runWithStepUp }),
    [scope, isActive, expiresAt, refreshSession, ensureStepUp, runWithStepUp]
  )

  const title =
    scope === 'admin'
      ? tr(uiLocale, 'Xác minh OTP quản trị', 'Admin OTP verification', '管理员OTP验证', '管理者OTP確認', '관리자 OTP 인증')
      : tr(uiLocale, 'Xác minh OTP tài khoản', 'Account OTP verification', '账户OTP验证', 'アカウントOTP確認', '계정 OTP 인증')

  const description =
    scope === 'admin'
      ? tr(
          uiLocale,
          'Thao tác này yêu cầu OTP gửi tới email admin. Phiên xác minh có hiệu lực 15 phút.',
          'This action requires an OTP sent to the admin email. Verification lasts 15 minutes.',
          '此操作需要发送到管理员邮箱的OTP。验证有效期15分钟。',
          'この操作には管理者メールへのOTPが必要です。確認は15分間有効です。',
          '이 작업은 관리자 이메일로 OTP가 필요합니다. 인증은 15분간 유효합니다.'
        )
      : tr(
          uiLocale,
          'Thao tác này yêu cầu OTP gửi tới email đăng nhập. Phiên xác minh có hiệu lực 15 phút.',
          'This action requires an OTP sent to your login email. Verification lasts 15 minutes.',
          '此操作需要发送到登录邮箱的OTP。验证有效期15分钟。',
          'この操作にはログインメールへのOTPが必要です。確認は15分間有効です。',
          '이 작업은 로그인 이메일로 OTP가 필요합니다. 인증은 15분간 유효합니다.'
        )

  return (
    <StepUpOtpContext.Provider value={value}>
      {children}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open && pendingResolve) finishEnsure(false)
          else setDialogOpen(open)
        }}
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          {otpStep === 'send' ? (
            <DialogFooter>
              <Button onClick={() => void sendOtp()} disabled={busy}>
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {tr(uiLocale, 'Gửi mã OTP', 'Send OTP', '发送OTP', 'OTPを送信', 'OTP 보내기')}
              </Button>
            </DialogFooter>
          ) : (
            <div className="space-y-4">
              <Input
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder={tr(uiLocale, 'Nhập 6 số OTP', 'Enter 6-digit OTP', '输入6位OTP', '6桁OTP', '6자리 OTP')}
                value={otpInput}
                onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
              />
              <DialogFooter className="gap-2 sm:justify-between">
                <Button type="button" variant="outline" onClick={() => setOtpStep('send')} disabled={busy}>
                  {tr(uiLocale, 'Gửi lại', 'Resend', '重新发送', '再送信', '다시 보내기')}
                </Button>
                <Button onClick={() => void verifyOtp()} disabled={busy}>
                  {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {tr(uiLocale, 'Xác minh', 'Verify', '验证', '確認', '인증')}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </StepUpOtpContext.Provider>
  )
}

export function useStepUpOtp() {
  const ctx = useContext(StepUpOtpContext)
  if (!ctx) {
    throw new Error('useStepUpOtp must be used within StepUpOtpProvider')
  }
  return ctx
}

export function StepUpStatusBanner() {
  const { scope, isActive, expiresAt, ensureStepUp } = useStepUpOtp()
  const [uiLocale, setUiLocale] = useState<WebLocale>('vi')

  useEffect(() => {
    const sync = () => setUiLocale(readWebLocaleFromDocumentCookie())
    sync()
  }, [])

  if (isActive && expiresAt) {
    let when = expiresAt
    try {
      when = new Date(expiresAt).toLocaleTimeString(
        uiLocale === 'vi' ? 'vi-VN' : uiLocale === 'ja' ? 'ja-JP' : uiLocale === 'ko' ? 'ko-KR' : uiLocale === 'zh' ? 'zh-CN' : 'en-US'
      )
    } catch {
      // keep raw
    }
    return (
      <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
        {scope === 'admin'
          ? tr(uiLocale, `Đã xác minh OTP quản trị — hết hạn lúc ${when}.`, `Admin OTP verified — expires at ${when}.`, `管理员OTP已验证 — ${when} 过期。`, `管理者OTP確認済み — ${when} まで有効。`, `관리자 OTP 인증됨 — ${when} 만료.`)
          : tr(uiLocale, `Đã xác minh OTP — hết hạn lúc ${when}.`, `OTP verified — expires at ${when}.`, `OTP已验证 — ${when} 过期。`, `OTP確認済み — ${when} まで有効。`, `OTP 인증됨 — ${when} 만료.`)}
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
      <span>
        {scope === 'admin'
          ? tr(
              uiLocale,
              'Thao tác nhạy cảm (sửa tiền, cấu hình, xuất DB, duyệt nội dung) cần xác minh OTP.',
              'Sensitive admin actions require OTP verification.',
              '敏感管理操作需要OTP验证。',
              '機密の管理操作にはOTP確認が必要です。',
              '민감한 관리 작업에는 OTP 인증이 필요합니다.'
            )
          : tr(
              uiLocale,
              'Thao tác nhạy cảm (API key, thanh toán shop, nhân viên) cần xác minh OTP.',
              'Sensitive account actions require OTP verification.',
              '敏感账户操作需要OTP验证。',
              '機密のアカウント操作にはOTP確認が必要です。',
              '민감한 계정 작업에는 OTP 인증이 필요합니다.'
            )}
      </span>
      <Button type="button" size="sm" variant="outline" onClick={() => void ensureStepUp()}>
        {tr(uiLocale, 'Xác minh OTP', 'Verify OTP', '验证OTP', 'OTP確認', 'OTP 인증')}
      </Button>
    </div>
  )
}

/** Fetch helper for API routes that may return STEP_UP_REQUIRED */
export async function fetchWithStepUp(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  ensureStepUp: () => Promise<boolean>
): Promise<Response> {
  let res = await fetch(input, init)
  if (res.status === 403) {
    const clone = res.clone()
    try {
      const data = (await clone.json()) as { code?: string }
      if (data.code === 'STEP_UP_REQUIRED') {
        const ok = await ensureStepUp()
        if (ok) res = await fetch(input, init)
      }
    } catch {
      // ignore json parse errors
    }
  }
  return res
}
