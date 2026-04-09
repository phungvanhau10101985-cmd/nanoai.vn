'use client'

import { readWebLocaleFromDocumentCookie } from '@/lib/i18n/read-web-locale-cookie'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { updateUserCredit } from './actions'
import { useToast } from '@/hooks/use-toast'
import { Loader2 } from 'lucide-react'

export function EditCreditDialog({ userId, currentBalance }: { userId: string; currentBalance: number }) {
  const [uiLocale, setUiLocale] = useState<'vi' | 'en' | 'zh' | 'ja' | 'ko'>('vi')
  const [open, setOpen] = useState(false)
  const [newBalance, setNewBalance] = useState(currentBalance)
  const [isLoading, setIsLoading] = useState(false)
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

  const handleSubmit = async () => {
    setIsLoading(true)
    const result = await updateUserCredit(userId, newBalance)
    setIsLoading(false)

    if (result.error) {
      toast({ title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'), description: result.error, variant: 'destructive' })
    } else {
      toast({ title: tr('Thành công', 'Success', '成功', '成功', '성공'), description: tr('Đã cập nhật số dư tín dụng.', 'Credit balance updated.', '积分余额已更新。', 'クレジット残高を更新しました。', '크레딧 잔액을 업데이트했습니다.') })
      setOpen(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">{tr('Chỉnh sửa', 'Edit', '编辑', '編集', '수정')}</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{tr('Chỉnh sửa tín dụng', 'Edit credits', '编辑积分', 'クレジットを編集', '크레딧 수정')}</DialogTitle>
          <DialogDescription>
            {tr('Nhập số dư tín dụng mới cho người dùng. Nhấn lưu để áp dụng.', 'Enter new credit balance for this user. Click save to apply.', '输入该用户新的积分余额，点击保存以应用。', 'このユーザーの新しい残高を入力し、保存して適用します。', '사용자의 새 크레딧 잔액을 입력하고 저장을 누르세요.')}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="balance" className="text-right">
              {tr('Số dư mới', 'New balance', '新余额', '新しい残高', '새 잔액')}
            </Label>
            <Input
              id="balance"
              type="number"
              value={newBalance}
              onChange={(e) => setNewBalance(Number(e.target.value))}
              className="col-span-3"
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {tr('Lưu thay đổi', 'Save changes', '保存更改', '変更を保存', '변경 저장')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
