'use client'

import { useEffect } from 'react'
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

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const uiLocale = getWebLocaleFromCookie()
  const tr = (vi: string, en: string, zh: string, ja: string, ko: string) =>
    uiLocale === 'en' ? en : uiLocale === 'zh' ? zh : uiLocale === 'ja' ? ja : uiLocale === 'ko' ? ko : vi
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center gap-4 p-8">
      <h2 className="text-xl font-semibold">{tr('Đã xảy ra lỗi', 'An error occurred', '发生错误', 'エラーが発生しました', '오류가 발생했습니다')}</h2>
      <p className="text-muted-foreground text-center max-w-md">
        {error.message || tr('Có lỗi không mong muốn xảy ra.', 'Unexpected error occurred.', '发生了意外错误。', '予期しないエラーが発生しました。', '예기치 않은 오류가 발생했습니다.')}
      </p>
      <Button onClick={reset}>{tr('Thử lại', 'Retry', '重试', '再試行', '다시 시도')}</Button>
    </div>
  )
}
