'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
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

export default function TienTrinhError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const router = useRouter()
  const uiLocale = getWebLocaleFromCookie()
  const tr = (vi: string, en: string, zh: string, ja: string, ko: string) => {
    if (uiLocale === 'en') return en
    if (uiLocale === 'zh') return zh
    if (uiLocale === 'ja') return ja
    if (uiLocale === 'ko') return ko
    return vi
  }
  useEffect(() => {
    console.error('[tien-trinh]', error)
  }, [error])

  return (
    <div className="max-w-2xl mx-auto p-6 flex flex-col items-center justify-center min-h-[200px] gap-4">
      <h2 className="text-xl font-semibold text-red-700">{tr('Đã xảy ra lỗi', 'An error occurred', '发生错误', 'エラーが発生しました', '오류가 발생했습니다')}</h2>
      <p className="text-muted-foreground text-center">{error.message || tr('Có lỗi không mong muốn.', 'Unexpected error occurred.', '发生了意外错误。', '予期しないエラーが発生しました。', '예기치 않은 오류가 발생했습니다.')}</p>
      <div className="flex gap-2">
        <Button variant="outline" onClick={reset}>{tr('Thử lại', 'Retry', '重试', '再試行', '다시 시도')}</Button>
        <Button onClick={() => router.back()}>{tr('Về trang dịch ảnh', 'Back to translator', '返回翻译页', '翻訳ページへ戻る', '번역 페이지로 돌아가기')}</Button>
      </div>
    </div>
  )
}
