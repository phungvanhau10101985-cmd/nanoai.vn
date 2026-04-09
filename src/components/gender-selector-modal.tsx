"use client"

import { readWebLocaleFromDocumentCookie } from '@/lib/i18n/read-web-locale-cookie'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { UserRound, UserRoundCheck } from 'lucide-react'
import { getClientUserId } from '@/lib/auth/get-client-user-id'

type Gender = 'male' | 'female'
type UiLocale = 'vi' | 'en' | 'zh' | 'ja' | 'ko'

function getWebLocaleFromCookie(): UiLocale {
  if (typeof document === 'undefined') return 'vi'
  const cookieValue = readWebLocaleFromDocumentCookie()
  if (cookieValue === 'en' || cookieValue === 'zh' || cookieValue === 'ja' || cookieValue === 'ko') return cookieValue
  return 'vi'
}

export default function GenderSelectorModal() {
  const [uiLocale, setUiLocale] = useState<UiLocale>('vi')
  const [open, setOpen] = useState(false)
  const [selectedGender, setSelectedGender] = useState<Gender>('male')
  const [loading, setLoading] = useState(false)
  const tr = (vi: string, en: string, zh: string, ja: string, ko: string) => {
    if (uiLocale === 'en') return en
    if (uiLocale === 'zh') return zh
    if (uiLocale === 'ja') return ja
    if (uiLocale === 'ko') return ko
    return vi
  }

  useEffect(() => {
    const syncLocale = () => setUiLocale(getWebLocaleFromCookie())
    syncLocale()
    const timer = window.setInterval(syncLocale, 1000)
    window.addEventListener('focus', syncLocale)
    document.addEventListener('visibilitychange', syncLocale)
    void checkUserGender()
    return () => {
      window.removeEventListener('focus', syncLocale)
      document.removeEventListener('visibilitychange', syncLocale)
      window.clearInterval(timer)
    }
  }, [])

  const checkUserGender = async () => {
    try {
      const uid = await getClientUserId()
      if (!uid) return
      const res = await fetch('/api/profile/gender', { credentials: 'same-origin' })
      if (!res.ok) return
      const j = (await res.json()) as { gender?: string | null }
      const g = String(j.gender ?? '').toLowerCase()
      if (g === 'male' || g === 'female') {
        setSelectedGender(g)
        return
      }
      setTimeout(() => {
        setOpen(true)
      }, 1000)
    } catch (error) {
      console.error('Error checking user gender:', error)
    }
  }

  const handleGenderSelect = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/profile/gender', {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gender: selectedGender }),
      })
      if (!res.ok) {
        console.error('Error updating gender:', await res.text())
        return
      }

      setOpen(false)

      alert(`${tr('Đã lưu giới tính', 'Saved gender', '性别已保存', '性別を保存しました', '성별이 저장되었습니다')}: ${selectedGender === 'male' ? tr('Nam', 'Male', '男', '男性', '남성') : tr('Nữ', 'Female', '女', '女性', '여성')}. ${tr('Bạn có thể thay đổi trong cài đặt tài khoản.', 'You can change it later in account settings.', '您可以稍后在账户设置中更改。', 'アカウント設定で後から変更できます。', '계정 설정에서 나중에 변경할 수 있습니다.')}`)
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserRound className="h-5 w-5" />
            {tr('Chọn giới tính', 'Select gender', '选择性别', '性別を選択', '성별 선택')}
          </DialogTitle>
          <DialogDescription>
            {tr(
              'Giúp chúng tôi cá nhân hóa trải nghiệm của bạn.',
              'Help us personalize your experience.',
              '帮助我们为您个性化体验。',
              '体験をパーソナライズするために使用します。',
              '맞춤 경험을 위해 사용됩니다.'
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 py-4">
          <Button
            type="button"
            variant={selectedGender === 'male' ? 'default' : 'outline'}
            className="h-auto py-4 flex flex-col gap-2"
            onClick={() => setSelectedGender('male')}
          >
            <UserRound className="h-8 w-8" />
            <span>{tr('Nam', 'Male', '男', '男性', '남성')}</span>
          </Button>
          <Button
            type="button"
            variant={selectedGender === 'female' ? 'default' : 'outline'}
            className="h-auto py-4 flex flex-col gap-2"
            onClick={() => setSelectedGender('female')}
          >
            <UserRoundCheck className="h-8 w-8" />
            <span>{tr('Nữ', 'Female', '女', '女性', '여성')}</span>
          </Button>
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            {tr('Để sau', 'Skip', '跳过', 'スキップ', '건너뛰기')}
          </Button>
          <Button type="button" onClick={handleGenderSelect} disabled={loading}>
            {loading
              ? tr('Đang lưu...', 'Saving...', '保存中...', '保存中...', '저장 중...')
              : tr('Xác nhận', 'Confirm', '确认', '確認', '확인')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
