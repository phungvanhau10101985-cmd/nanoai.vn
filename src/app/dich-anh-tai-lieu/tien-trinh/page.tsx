'use client'

import { readWebLocaleFromDocumentCookie } from '@/lib/i18n/read-web-locale-cookie'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
const STORAGE_KEY = 'lastTranslateBatchId'
type UiLocale = 'vi' | 'en' | 'zh' | 'ja' | 'ko'

function getWebLocaleFromCookie(): UiLocale {
  if (typeof document === 'undefined') return 'vi'
  const cookieValue = readWebLocaleFromDocumentCookie()
  if (cookieValue === 'en' || cookieValue === 'zh' || cookieValue === 'ja' || cookieValue === 'ko') return cookieValue
  return 'vi'
}

export default function TranslateProgressLandingPage() {
  const router = useRouter()
  const [checking] = useState(true)
  const [uiLocale, setUiLocale] = useState<UiLocale>('vi')

  useEffect(() => {
    const syncLocale = () => setUiLocale(getWebLocaleFromCookie())
    syncLocale()
    const timer = window.setInterval(syncLocale, 1000)
    window.addEventListener('focus', syncLocale)
    document.addEventListener('visibilitychange', syncLocale)
    try {
      const batchId = localStorage.getItem(STORAGE_KEY)
      if (batchId) {
        router.replace(`/dich-anh-tai-lieu?batchId=${encodeURIComponent(batchId)}`)
        return
      }
    } catch {
      //
    }
    router.replace('/dich-anh-tai-lieu')
    return () => {
      window.removeEventListener('focus', syncLocale)
      document.removeEventListener('visibilitychange', syncLocale)
      window.clearInterval(timer)
    }
  }, [router])

  if (checking) {
    return (
      <div className="max-w-2xl mx-auto p-6 flex flex-col items-center justify-center min-h-[200px]">
        <p className="text-muted-foreground">{uiLocale === 'en' ? 'Checking...' : uiLocale === 'zh' ? '正在检查...' : uiLocale === 'ja' ? '確認中...' : uiLocale === 'ko' ? '확인 중...' : 'Đang kiểm tra...'}</p>
      </div>
    )
  }

  return null
}
