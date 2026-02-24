"use client"

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { UserRound, UserRoundCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type Gender = 'male' | 'female'
type UiLocale = 'vi' | 'en' | 'zh' | 'ja' | 'ko'

function getWebLocaleFromCookie(): UiLocale {
  if (typeof document === 'undefined') return 'vi'
  const cookieValue = document.cookie
    .split(';')
    .map((x) => x.trim())
    .find((x) => x.startsWith('nanoai_locale='))
    ?.split('=')[1]
    ?.trim()
    .toLowerCase()
  if (cookieValue === 'en' || cookieValue === 'zh' || cookieValue === 'ja' || cookieValue === 'ko') return cookieValue
  return 'vi'
}

export default function GenderSelectorModal() {
  const [uiLocale, setUiLocale] = useState<UiLocale>('vi')
  const [open, setOpen] = useState(false)
  const [selectedGender, setSelectedGender] = useState<Gender>('male')
  const [loading, setLoading] = useState(false)
  const supabase = createClient()
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
    checkUserGender()
    return () => {
      window.removeEventListener('focus', syncLocale)
      document.removeEventListener('visibilitychange', syncLocale)
      window.clearInterval(timer)
    }
  }, [])

  const checkUserGender = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const userGender = user.user_metadata?.gender
      
      // Nếu user chưa có giới tính, hiển thị popup
      if (!userGender) {
        // Đợi 1 giây để trang load xong rồi hiện popup
        setTimeout(() => {
          setOpen(true)
        }, 1000)
      }
    } catch (error) {
      console.error('Error checking user gender:', error)
    }
  }

  const handleGenderSelect = async () => {
    setLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          gender: selectedGender,
        },
      })

      if (error) {
        console.error('Error updating gender:', error)
        return
      }

      setOpen(false)
      
      // Hiển thị thông báo thành công
      alert(`${tr('Đã lưu giới tính', 'Saved gender', '性别已保存', '性別を保存しました', '성별이 저장되었습니다')}: ${selectedGender === 'male' ? tr('Nam', 'Male', '男', '男性', '남성') : tr('Nữ', 'Female', '女', '女性', '여성')}. ${tr('Bạn có thể thay đổi trong cài đặt tài khoản.', 'You can change it later in account settings.', '您可以稍后在账户设置中更改。', 'アカウント設定で後から変更できます。', '계정 설정에서 나중에 변경할 수 있습니다.')}`)
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSkip = () => {
    setOpen(false)
    alert(tr('Bạn có thể chọn giới tính sau trong cài đặt tài khoản.', 'You can choose gender later in account settings.', '您可以稍后在账户设置中选择性别。', 'アカウント設定で後から性別を選択できます。', '계정 설정에서 나중에 성별을 선택할 수 있습니다.'))
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">{tr('Chọn giới tính của bạn', 'Select your gender', '选择你的性别', '性別を選択', '성별 선택')}</DialogTitle>
          <DialogDescription>
            {tr('Giới tính giúp hệ thống tối ưu giao diện và gợi ý sản phẩm phù hợp với bạn.', 'Gender helps optimize UI and product suggestions for you.', '性别有助于系统优化界面并推荐更适合你的商品。', '性別によりUI最適化とおすすめ商品の精度が向上します。', '성별 정보는 UI 최적화와 맞춤 상품 추천에 도움이 됩니다.')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <label className="group cursor-pointer">
              <input
                type="radio"
                name="gender"
                value="male"
                checked={selectedGender === 'male'}
                onChange={() => setSelectedGender('male')}
                className="sr-only"
              />
              <div className={`
                rounded-lg border-2 p-4 transition-all duration-200
                ${selectedGender === 'male' 
                  ? 'border-blue-500 bg-blue-50 shadow-sm' 
                  : 'border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50/40'
                }
              `}>
                <div className="flex flex-col items-center gap-2">
                  <div className="rounded-full bg-blue-100 p-3">
                    <UserRound className="h-6 w-6 text-blue-600" />
                  </div>
                  <span className="font-medium text-gray-800">{tr('Nam', 'Male', '男', '男性', '남성')}</span>
                  <span className="text-xs text-gray-500 text-center">
                    {tr('Tối ưu cho nam giới', 'Optimized for men', '面向男性优化', '男性向けに最適化', '남성 맞춤 최적화')}
                  </span>
                </div>
              </div>
            </label>

            <label className="group cursor-pointer">
              <input
                type="radio"
                name="gender"
                value="female"
                checked={selectedGender === 'female'}
                onChange={() => setSelectedGender('female')}
                className="sr-only"
              />
              <div className={`
                rounded-lg border-2 p-4 transition-all duration-200
                ${selectedGender === 'female' 
                  ? 'border-pink-500 bg-pink-50 shadow-sm' 
                  : 'border-gray-200 bg-white hover:border-pink-300 hover:bg-pink-50/40'
                }
              `}>
                <div className="flex flex-col items-center gap-2">
                  <div className="rounded-full bg-pink-100 p-3">
                    <UserRoundCheck className="h-6 w-6 text-pink-600" />
                  </div>
                  <span className="font-medium text-gray-800">{tr('Nữ', 'Female', '女', '女性', '여성')}</span>
                  <span className="text-xs text-gray-500 text-center">
                    {tr('Tối ưu cho nữ giới', 'Optimized for women', '面向女性优化', '女性向けに最適化', '여성 맞춤 최적화')}
                  </span>
                </div>
              </div>
            </label>
          </div>

          <div className="rounded-lg bg-gray-50 p-3">
            <p className="text-sm text-gray-600">
              <span className="font-medium">{tr('Lưu ý', 'Note', '注意', '注意', '안내')}:</span> {tr('Giới tính chỉ dùng để tùy biến giao diện và gợi ý sản phẩm phù hợp. Bạn có thể thay đổi sau trong cài đặt tài khoản.', 'Gender is only used to personalize UI and recommendations. You can change it later in account settings.', '性别仅用于个性化界面和推荐。你可在账户设置中稍后修改。', '性別はUIとおすすめのパーソナライズにのみ使用されます。後でアカウント設定で変更できます。', '성별은 UI와 추천 개인화에만 사용됩니다. 계정 설정에서 나중에 변경할 수 있습니다.')}
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <Button 
            onClick={handleSkip}
            variant="outline" 
            className="flex-1"
          >
            {tr('Để sau', 'Later', '稍后', 'あとで', '나중에')}
          </Button>
          <Button 
            onClick={handleGenderSelect}
            disabled={loading}
            className="flex-1 bg-blue-600 hover:bg-blue-700"
          >
            {loading ? tr('Đang lưu...', 'Saving...', '保存中...', '保存中...', '저장 중...') : tr('Xác nhận', 'Confirm', '确认', '確認', '확인')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}