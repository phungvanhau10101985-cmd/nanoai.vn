'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { X, Share, Plus } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

interface WindowWithPWA extends Window {
  MSStream?: boolean
  standalone?: boolean
}

export function InstallPrompt() {
  const [uiLocale, setUiLocale] = useState<'vi' | 'en' | 'zh' | 'ja' | 'ko'>('vi')
  const [isIOS, setIsIOS] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)
  const [showPrompt, setShowPrompt] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)

  const tr = (vi: string, en: string, zh: string, ja: string, ko: string) => {
    if (uiLocale === 'en') return en
    if (uiLocale === 'zh') return zh
    if (uiLocale === 'ja') return ja
    if (uiLocale === 'ko') return ko
    return vi
  }

  useEffect(() => {
    const ua = navigator.userAgent
    const win = window as WindowWithPWA
    const ios = /iPad|iPhone|iPod/.test(ua) && !win.MSStream
    const standalone =
      win.standalone === true ||
      window.matchMedia('(display-mode: standalone)').matches ||
      document.referrer?.includes('android-app')

    setIsIOS(ios)
    setIsStandalone(standalone)

    if (!standalone) {
      if (ios) {
        setShowPrompt(true)
      } else {
        const handler = (e: Event) => {
          e.preventDefault()
          setDeferredPrompt(e as BeforeInstallPromptEvent)
          setShowPrompt(true)
        }
        window.addEventListener('beforeinstallprompt', handler)
        return () => window.removeEventListener('beforeinstallprompt', handler)
      }
    }
  }, [])

  useEffect(() => {
    const syncLocale = () => {
      const cookieValue = document.cookie
        .split(';')
        .map((x) => x.trim())
        .find((x) => x.startsWith('nanoai_locale='))
        ?.split('=')[1]
        ?.trim()
        .toLowerCase()
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

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === 'accepted') setShowPrompt(false)
    }
  }

  if (isStandalone || !showPrompt) return null

  return (
    <div className="fixed bottom-20 md:bottom-4 left-4 right-4 z-50 md:max-w-sm md:left-auto">
      <div className="flex items-start gap-3 p-4 rounded-xl bg-background border shadow-lg safe-area-pb">
        <button
          onClick={() => setShowPrompt(false)}
          className="absolute top-2 right-2 p-1 rounded-full hover:bg-muted transition-colors touch-manipulation"
          aria-label={tr('Đóng', 'Close', '关闭', '閉じる', '닫기')}
        >
          <X className="h-4 w-4" />
        </button>
        <div className="flex-1 pr-8">
          <h3 className="font-semibold text-sm mb-1">{tr('Cài đặt ứng dụng', 'Install app', '安装应用', 'アプリをインストール', '앱 설치')}</h3>
          {isIOS ? (
            <p className="text-xs text-muted-foreground">
              {tr('Nhấn', 'Tap', '点击', 'タップ', '탭')} <Share className="inline h-3 w-3 mx-0.5" /> {tr('rồi chọn', 'then choose', '然后选择', '次を選択', '그리고 선택')} &quot;{tr('Thêm vào Màn hình chính', 'Add to Home Screen', '添加到主屏幕', 'ホーム画面に追加', '홈 화면에 추가')}&quot; <Plus className="inline h-3 w-3 mx-0.5" /> {tr('để cài đặt.', 'to install.', '进行安装。', 'してインストール。', '하여 설치하세요.')}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground mb-2">
              {tr('Thêm vào màn hình chính để truy cập nhanh như ứng dụng.', 'Add to Home Screen for quick app-like access.', '添加到主屏幕，像应用一样快速访问。', 'ホーム画面に追加してアプリのように素早くアクセス。', '홈 화면에 추가해 앱처럼 빠르게 사용하세요.')}
            </p>
          )}
          {!isIOS && (
            <Button size="sm" onClick={handleInstall} className="mt-2">
              {tr('Cài đặt', 'Install', '安装', 'インストール', '설치')}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
