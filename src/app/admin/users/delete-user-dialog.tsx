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
import { Loader2, Trash2 } from 'lucide-react'
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
