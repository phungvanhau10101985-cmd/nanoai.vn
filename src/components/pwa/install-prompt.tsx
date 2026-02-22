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
  const [isIOS, setIsIOS] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)
  const [showPrompt, setShowPrompt] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)

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
          aria-label="Đóng"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="flex-1 pr-8">
          <h3 className="font-semibold text-sm mb-1">Cài đặt ứng dụng</h3>
          {isIOS ? (
            <p className="text-xs text-muted-foreground">
              Nhấn <Share className="inline h-3 w-3 mx-0.5" /> rồi chọn &quot;Thêm vào Màn hình chính&quot; <Plus className="inline h-3 w-3 mx-0.5" /> để cài đặt.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground mb-2">
              Thêm vào màn hình chính để truy cập nhanh như ứng dụng.
            </p>
          )}
          {!isIOS && (
            <Button size="sm" onClick={handleInstall} className="mt-2">
              Cài đặt
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
