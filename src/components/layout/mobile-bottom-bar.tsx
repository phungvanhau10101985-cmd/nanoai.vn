'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { LayoutDashboard, LayoutGrid, Sparkles, Wallet } from 'lucide-react'
import { cn } from '@/lib/utils'
import { readWebLocaleFromDocumentCookie } from '@/lib/i18n/read-web-locale-cookie'
import { subscribeToUrlChanges } from '@/lib/client-history-navigation'

const MOBILE_BAR_ITEMS = [
  {
    href: '/',
    label: (tr: (vi: string, en: string, zh: string, ja: string, ko: string) => string) =>
      tr('Danh mục tính năng', 'Features', '功能目录', '機能一覧', '기능 목록'),
    icon: LayoutGrid,
  },
  { href: '/dashboard', label: (tr: (vi: string, en: string, zh: string, ja: string, ko: string) => string) => tr('Bảng điều khiển', 'Dashboard', '仪表盘', 'ダッシュボード', '대시보드'), icon: LayoutDashboard },
  { href: '/thu-do-online', label: (tr: (vi: string, en: string, zh: string, ja: string, ko: string) => string) => tr('Thử đồ', 'Try-on', '试衣', '試着', '가상피팅'), icon: Sparkles },
  { href: '/wallet', label: (tr: (vi: string, en: string, zh: string, ja: string, ko: string) => string) => tr('Ví', 'Wallet', '钱包', 'ウォレット', '지갑'), icon: Wallet },
]

export function MobileBottomBar() {
  const [uiLocale, setUiLocale] = useState<'vi' | 'en' | 'zh' | 'ja' | 'ko'>('vi')
  const [pathname, setPathname] = useState('/')
  const hideOnAuth = pathname.startsWith('/auth')
  const tr = (vi: string, en: string, zh: string, ja: string, ko: string) => {
    if (uiLocale === 'en') return en
    if (uiLocale === 'zh') return zh
    if (uiLocale === 'ja') return ja
    if (uiLocale === 'ko') return ko
    return vi
  }

  useEffect(() => {
    const syncPath = () => setPathname(window.location.pathname || '/')
    syncPath()
    return subscribeToUrlChanges(syncPath)
  }, [])

  useEffect(() => {
    const syncLocale = () => {
      setUiLocale(readWebLocaleFromDocumentCookie())
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
      className="fixed bottom-0 left-0 right-0 z-40 px-2 pb-2 md:hidden safe-area-pb"
      aria-label={tr('Điều hướng nhanh', 'Quick navigation', '快速导航', 'クイックナビ', '빠른 탐색')}
    >
      <div className="mx-auto flex h-16 max-w-xl items-center justify-around rounded-2xl border border-border/70 bg-background/92 px-2 shadow-[0_-8px_24px_rgba(2,6,23,0.08)] backdrop-blur-xl supports-[backdrop-filter]:bg-background/80 dark:shadow-[0_-8px_24px_rgba(2,6,23,0.45)]">
        {MOBILE_BAR_ITEMS.map((item) => {
          const Icon = item.icon
          const isActive =
            pathname === item.href ||
            (item.href !== '/' && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.href === '/' ? tr('Danh mục tính năng NanoAI', 'NanoAI feature catalog', 'NanoAI 功能目录', 'NanoAI 機能一覧', 'NanoAI 기능 목록') : undefined}
              className={cn(
                'mx-1 flex min-w-0 flex-1 touch-manipulation flex-col items-center justify-center gap-1 rounded-xl py-2 transition-colors',
                isActive
                  ? 'bg-primary/8 text-primary font-semibold'
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
