'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Loader2, Trash2, Mail, ExternalLink } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { readWebLocaleFromDocumentCookie } from '@/lib/i18n/read-web-locale-cookie'
import {
  confirmAdminDeleteUserWithOtp,
  requestAdminDeleteUserOtp,
} from './actions'

export function DeleteUserDialog({
  userId,
  userEmail,
  userName,
}: {
  userId: string
  userEmail: string
  userName: string | null
}) {
  const [uiLocale, setUiLocale] = useState<'vi' | 'en' | 'zh' | 'ja' | 'ko'>('vi')
  const [open, setOpen] = useState(false)
  const [otpStep, setOtpStep] = useState<'send' | 'confirm'>('send')
  const [otpInput, setOtpInput] = useState('')
  const [busy, setBusy] = useState(false)
  const { toast } = useToast()

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
      if (cookieValue === 'en' || cookieValue === 'zh' || cookieValue === 'ja' || cookieValue === 'ko') {
        setUiLocale(cookieValue)
      } else setUiLocale('vi')
    }
    syncLocale()
  }, [])

  const resetDialog = () => {
    setOtpStep('send')
    setOtpInput('')
  }

  const sendOtp = async () => {
    setBusy(true)
    const res = await requestAdminDeleteUserOtp(userId)
    setBusy(false)
    if ('error' in res) {
      toast({ title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'), description: res.error, variant: 'destructive' })
      return
    }
    toast({
      title: tr('Đã gửi OTP', 'OTP sent', '已发送OTP', 'OTPを送信しました', 'OTP 전송됨'),
      description: tr(
        'Kiểm tra email admin của bạn.',
        'Check your admin email.',
        '请查收管理员邮箱。',
        '管理者メールを確認してください。',
        '관리자 이메일을 확인하세요.'
      ),
    })
    setOtpStep('confirm')
  }

  const confirmDelete = async () => {
    const otp = otpInput.replace(/\D/g, '').trim()
    if (otp.length !== 6) {
      toast({
        title: tr('OTP không hợp lệ', 'Invalid OTP', 'OTP无效', 'OTPが無効です', 'OTP가 유효하지 않습니다'),
        variant: 'destructive',
      })
      return
    }
    setBusy(true)
    const res = await confirmAdminDeleteUserWithOtp(userId, otp)
    setBusy(false)
    if ('error' in res) {
      toast({ title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'), description: res.error, variant: 'destructive' })
      return
    }
    toast({
      title: tr('Đã xóa tài khoản', 'Account deleted', '账户已删除', 'アカウント削除', '계정 삭제됨'),
      description: userEmail,
    })
    setOpen(false)
    resetDialog()
    window.location.reload()
  }

  const label = userName?.trim() || userEmail

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) resetDialog()
      }}
    >
      <DialogTrigger asChild>
        <Button variant="destructive" size="sm" className="ml-2">
          <Trash2 className="mr-1 h-3.5 w-3.5" />
          {tr('Xóa', 'Delete', '删除', '削除', '삭제')}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{tr('Xóa tài khoản thành viên', 'Delete member account', '删除成员账户', 'メンバー削除', '회원 계정 삭제')}</DialogTitle>
          <DialogDescription>
            {tr(
              `Xóa vĩnh viễn tài khoản "${label}". Mỗi lần xóa cần OTP mới gửi tới email admin. Không hoàn tác.`,
              `Permanently delete "${label}". A fresh admin OTP is required each time. Cannot be undone.`,
              `永久删除“${label}”。每次删除需新的管理员OTP。不可撤销。`,
              `「${label}」を完全削除。毎回新しい管理者OTPが必要です。元に戻せません。`,
              `"${label}" 계정을 영구 삭제합니다. 매번 새 관리자 OTP가 필요합니다. 되돌릴 수 없습니다.`
            )}
          </DialogDescription>
        </DialogHeader>
        {otpStep === 'send' ? (
          <DialogFooter>
            <Button onClick={() => void sendOtp()} disabled={busy}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {tr('Gửi OTP xóa', 'Send delete OTP', '发送删除OTP', '削除OTP送信', '삭제 OTP 보내기')}
            </Button>
          </DialogFooter>
        ) : (
          <div className="space-y-4">
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
                  href="https://mail.google.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-semibold text-foreground shadow-xs transition-colors hover:bg-accent"
                >
                  <Mail className="h-3.5 w-3.5 text-red-500" />
                  <span>{tr('Mở Gmail kiểm tra mã', 'Open Gmail to check code', '打开 Gmail 查看验证码', 'Gmailを開いて確認', 'Gmail 열어 확인하기')}</span>
                  <ExternalLink className="h-3 w-3 opacity-60" />
                </a>
              </div>
            </div>
            <Input
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder={tr('Nhập 6 số OTP', 'Enter 6-digit OTP', '输入6位OTP', '6桁OTP', '6자리 OTP')}
              value={otpInput}
              onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
            />
            <DialogFooter className="gap-2 sm:justify-between">
              <Button type="button" variant="outline" onClick={() => setOtpStep('send')} disabled={busy}>
                {tr('Gửi lại', 'Resend', '重新发送', '再送信', '다시 보내기')}
              </Button>
              <Button variant="destructive" onClick={() => void confirmDelete()} disabled={busy}>
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {tr('Xác nhận xóa', 'Confirm delete', '确认删除', '削除確認', '삭제 확인')}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
