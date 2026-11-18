'use client'

import { subscribeToUrlChanges } from '@/lib/client-history-navigation'
import { readWebLocaleFromDocumentCookie } from '@/lib/i18n/read-web-locale-cookie'

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

const STORAGE_KEY = 'nanoai_pwa_prompt_dismissed_v1'
const VISIT_KEY = 'nanoai_visit_count_v1'
const SESSION_BUMP_KEY = 'nanoai_pwa_visit_bumped_session'

export function InstallPrompt() {
  const [uiLocale, setUiLocale] = useState<'vi' | 'en' | 'zh' | 'ja' | 'ko'>('vi')
  const [isIOS, setIsIOS] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)
  const [showPrompt, setShowPrompt] = useState(false)
  const [keyboardOpen, setKeyboardOpen] = useState(false)
  const [pathname, setPathname] = useState('/')
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
    if (standalone) return
    if (localStorage.getItem(STORAGE_KEY) === '1') return
    if (location.pathname.startsWith('/auth/')) return

    const narrow = window.matchMedia('(max-width: 768px)').matches
    if (!sessionStorage.getItem(SESSION_BUMP_KEY)) {
      sessionStorage.setItem(SESSION_BUMP_KEY, '1')
      const visits = Number(localStorage.getItem(VISIT_KEY) || '0') + 1
      localStorage.setItem(VISIT_KEY, String(visits))
    }
    const visits = Number(localStorage.getItem(VISIT_KEY) || '0')
    if (visits < 2) return

    if (ios && narrow) {
      setShowPrompt(true)
      return
    }
    if (!narrow) return

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      if (!location.pathname.startsWith('/auth/')) setShowPrompt(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  useEffect(() => {
    const syncPath = () => setPathname(window.location.pathname || '/')
    syncPath()
    return subscribeToUrlChanges(syncPath)
  }, [])

  useEffect(() => {
    const onFocusIn = (event: FocusEvent) => {
      const target = event.target
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) setKeyboardOpen(true)
    }
    const onFocusOut = () => setKeyboardOpen(false)
    document.addEventListener('focusin', onFocusIn)
    document.addEventListener('focusout', onFocusOut)
    return () => {
      document.removeEventListener('focusin', onFocusIn)
      document.removeEventListener('focusout', onFocusOut)
    }
  }, [])

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

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, '1')
    setShowPrompt(false)
  }

  const handleInstall = async () => {
    if (!deferredPrompt) return
    const choicePromise = deferredPrompt.userChoice
    void Promise.resolve(deferredPrompt.prompt()).catch(() => undefined)
    try {
      const { outcome } = await choicePromise
      if (outcome === 'accepted') dismiss()
    } catch {
      /* Install may still succeed; hide only when the dialog was accepted. */
    }
    setDeferredPrompt(null)
  }

  if (isStandalone || !showPrompt || keyboardOpen || pathname.startsWith('/auth/')) return null

  return (
    <div
      data-nanoai-chrome=""
      role="dialog"
      aria-label={tr('Cài đặt ứng dụng', 'Install app', '安装应用', 'アプリをインストール', '앱 설치')}
      className="fixed left-4 right-4 z-50 md:left-auto md:max-w-sm bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] md:bottom-4"
    >
      <div className="relative rounded-2xl border border-border/70 bg-background p-3 shadow-lg">
        <button
          type="button"
          onClick={dismiss}
          className="absolute right-1 top-1 grid size-11 place-items-center rounded-full hover:bg-muted touch-manipulation"
          aria-label={tr('Đóng', 'Close', '关闭', '閉じる', '닫기')}
        >
          <X className="h-4 w-4" />
        </button>
        <div className="pr-10">
          <h2 className="mb-1 text-sm font-semibold">{tr('Cài đặt ứng dụng', 'Install app', '安装应用', 'アプリをインストール', '앱 설치')}</h2>
          {isIOS ? (
            <p className="text-sm text-muted-foreground">
              {tr('Nhấn', 'Tap', '点击', 'タップ', '탭')} <Share className="mx-0.5 inline h-3 w-3" /> {tr('rồi chọn', 'then choose', '然后选择', '次を選択', '그리고 선택')} &quot;{tr('Thêm vào Màn hình chính', 'Add to Home Screen', '添加到主屏幕', 'ホーム画面に追加', '홈 화면에 추가')}&quot; <Plus className="mx-0.5 inline h-3 w-3" />
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
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
