'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { LayoutDashboard, Sparkles, Wallet, Home } from 'lucide-react'
import { cn } from '@/lib/utils'

const MOBILE_BAR_ITEMS = [
  { href: '/', label: (tr: (vi: string, en: string, zh: string, ja: string, ko: string) => string) => tr('Trang chủ', 'Home', '首页', 'ホーム', '홈'), icon: Home },
  { href: '/dashboard', label: (tr: (vi: string, en: string, zh: string, ja: string, ko: string) => string) => tr('Bảng điều khiển', 'Dashboard', '仪表盘', 'ダッシュボード', '대시보드'), icon: LayoutDashboard },
  { href: '/thu-do-online', label: (tr: (vi: string, en: string, zh: string, ja: string, ko: string) => string) => tr('Thử đồ', 'Try-on', '试衣', '試着', '가상피팅'), icon: Sparkles },
  { href: '/wallet', label: (tr: (vi: string, en: string, zh: string, ja: string, ko: string) => string) => tr('Ví', 'Wallet', '钱包', 'ウォレット', '지갑'), icon: Wallet },
]

export function MobileBottomBar() {
  const [uiLocale, setUiLocale] = useState<'vi' | 'en' | 'zh' | 'ja' | 'ko'>('vi')
  const pathname = usePathname()
  const hideOnAuth = pathname.startsWith('/auth')
  const tr = (vi: string, en: string, zh: string, ja: string, ko: string) => {
    if (uiLocale === 'en') return en
    if (uiLocale === 'zh') return zh
    if (uiLocale === 'ja') return ja
    if (uiLocale === 'ko') return ko
    return vi
  }

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

  if (hideOnAuth) return null

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 md:hidden border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 safe-area-pb"
      aria-label={tr('Điều hướng nhanh', 'Quick navigation', '快速导航', 'クイックナビ', '빠른 탐색')}
    >
      <div className="flex items-center justify-around h-16 px-2">
        {MOBILE_BAR_ITEMS.map((item) => {
          const Icon = item.icon
          const isActive =
            pathname === item.href ||
            (item.href !== '/' && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center justify-center flex-1 min-w-0 gap-1 py-2 touch-manipulation transition-colors rounded-lg mx-1',
                isActive
                  ? 'text-primary font-medium'
                  : 'text-muted-foreground hover:text-foreground active:bg-muted/50'
              )}
            >
              <Icon
                className={cn(
                  'h-5 w-5 shrink-0',
                  isActive && 'stroke-[2.5px]'
                )}
              />
              <span className="text-xs font-medium truncate max-w-full px-1 leading-none">
                {item.label(tr)}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
