'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { ChevronRight, LayoutDashboard, List, Sparkles, Wallet } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useWebLocaleFromDocumentCookie } from '@/hooks/use-web-locale-from-cookie'
import { subscribeToUrlChanges } from '@/lib/client-history-navigation'
import { NAV_GROUPS } from '@/lib/nav-config'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'

const MOBILE_BAR_ITEMS = [
  {
    href: '/',
    label: (tr: (vi: string, en: string, zh: string, ja: string, ko: string) => string) =>
      tr('Danh mục tính năng', 'Features', '功能目录', '機能一覧', '기능 목록'),
    icon: List,
    /** Nút này mở sheet danh sách, không điều hướng thẳng tới lưới trang chủ. */
    openCatalogSheet: true as const,
  },
  {
    href: '/dashboard',
    label: (tr: (vi: string, en: string, zh: string, ja: string, ko: string) => string) =>
      tr('Bảng điều khiển', 'Dashboard', '仪表盘', 'ダッシュボード', '대시보드'),
    icon: LayoutDashboard,
  },
  {
    href: '/thu-do-online',
    label: (tr: (vi: string, en: string, zh: string, ja: string, ko: string) => string) =>
      tr('Thử đồ', 'Try-on', '试衣', '試着', '가상피팅'),
    icon: Sparkles,
  },
  {
    href: '/wallet',
    label: (tr: (vi: string, en: string, zh: string, ja: string, ko: string) => string) =>
      tr('Ví', 'Wallet', '钱包', 'ウォレット', '지갑'),
    icon: Wallet,
  },
] as const

export function MobileBottomBar() {
  const uiLocale = useWebLocaleFromDocumentCookie()
  const [pathname, setPathname] = useState('/')
  const [catalogOpen, setCatalogOpen] = useState(false)
  const hideOnAuth = pathname.startsWith('/auth')
  const tr = (vi: string, en: string, zh: string, ja: string, ko: string) => {
    if (uiLocale === 'en') return en
    if (uiLocale === 'zh') return zh
    if (uiLocale === 'ja') return ja
    if (uiLocale === 'ko') return ko
    return vi
  }

  const dict = useMemo(() => getDictionary(uiLocale), [uiLocale])

  useEffect(() => {
    const syncPath = () => setPathname(window.location.pathname || '/')
    syncPath()
    return subscribeToUrlChanges(syncPath)
  }, [])

  if (hideOnAuth) return null

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 px-2 pb-2 md:hidden safe-area-pb"
        aria-label={tr('Điều hướng nhanh', 'Quick navigation', '快速导航', 'クイックナビ', '빠른 탐색')}
      >
        <div className="mx-auto flex h-16 max-w-xl items-center justify-around rounded-2xl border border-border/70 bg-background/92 px-2 shadow-[0_-8px_24px_rgba(2,6,23,0.08)] backdrop-blur-xl supports-[backdrop-filter]:bg-background/80 dark:shadow-[0_-8px_24px_rgba(2,6,23,0.45)]">
          {MOBILE_BAR_ITEMS.map((item) => {
            const Icon = item.icon
            const isCatalog = 'openCatalogSheet' in item && item.openCatalogSheet
            const isActive = isCatalog
              ? catalogOpen || pathname === '/'
              : pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
            const itemClass = cn(
              'mx-1 flex min-w-0 flex-1 touch-manipulation flex-col items-center justify-center gap-1 rounded-xl py-2 transition-colors',
              isActive ? 'bg-primary/8 text-primary font-semibold' : 'text-muted-foreground hover:text-foreground active:bg-muted/50'
            )
            if (isCatalog) {
              return (
                <button
                  key={item.href}
                  type="button"
                  className={itemClass}
                  aria-expanded={catalogOpen}
                  aria-haspopup="dialog"
                  title={tr('Danh mục tính năng NanoAI', 'NanoAI feature catalog', 'NanoAI 功能目录', 'NanoAI 機能一覧', 'NanoAI 기능 목록')}
                  onClick={() => setCatalogOpen(true)}
                >
                  <Icon className={cn('h-5 w-5 shrink-0', isActive && 'stroke-[2.5px]')} />
                  <span className="max-w-full truncate px-1 text-xs font-medium leading-none">{item.label(tr)}</span>
                </button>
              )
            }
            return (
              <Link
                key={item.href}
                href={item.href}
                className={itemClass}
              >
                <Icon className={cn('h-5 w-5 shrink-0', isActive && 'stroke-[2.5px]')} />
                <span className="max-w-full truncate px-1 text-xs font-medium leading-none">{item.label(tr)}</span>
              </Link>
            )
          })}
        </div>
      </nav>

      <Sheet open={catalogOpen} onOpenChange={setCatalogOpen}>
        <SheetContent
          side="bottom"
          className="flex h-[85dvh] max-h-[90dvh] flex-col gap-0 rounded-t-2xl p-0 z-[60]"
        >
          <SheetHeader className="shrink-0 space-y-1 border-b px-4 pb-3 pt-2 text-left">
            <SheetTitle className="text-base">
              {tr('Danh mục tính năng', 'Features', '功能目录', '機能一覧', '기능 목록')}
            </SheetTitle>
            <p className="text-xs text-muted-foreground">
              {tr(
                'Chọn mục để mở trang công cụ.',
                'Pick an item to open its page.',
                '选择一项以打开工具页面。',
                '項目を選んでページを開きます。',
                '항목을 선택하면 해당 페이지로 이동합니다.'
              )}
            </p>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-3">
            <div className="space-y-5">
              {NAV_GROUPS.map((group) => {
                const homeLinks = group.links.filter((l) => l.showOnHomepage !== false)
                if (homeLinks.length === 0) return null
                return (
                  <div key={group.titleKey}>
                    <h3 className="mb-2 flex items-center gap-2 px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <span className="h-1 w-6 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500" />
                      {dict.navGroup[group.titleKey]}
                    </h3>
                    <ul className="space-y-0.5">
                      {homeLinks.map((linkItem) => {
                        const Icon = linkItem.icon
                        return (
                          <li key={linkItem.href}>
                            <Link
                              href={linkItem.href}
                              onClick={() => setCatalogOpen(false)}
                              className="flex min-h-[44px] items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/80 active:bg-muted"
                            >
                              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/8 text-primary">
                                <Icon className="h-5 w-5" />
                              </span>
                              <span className="min-w-0 flex-1 leading-tight">{dict.tool[linkItem.labelKey]}</span>
                              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                            </Link>
                            {linkItem.subLinks?.length ? (
                              <ul className="ml-4 mt-0.5 space-y-0.5 border-l-2 border-border/70 pl-2">
                                {linkItem.subLinks.map((sub) => {
                                  const SubIcon = sub.icon
                                  return (
                                    <li key={sub.href}>
                                      <Link
                                        href={sub.href}
                                        onClick={() => setCatalogOpen(false)}
                                        className="flex min-h-[40px] items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-foreground/90 transition-colors hover:bg-muted/70"
                                      >
                                        <SubIcon className="h-4 w-4 shrink-0 text-primary" />
                                        <span className="min-w-0 flex-1">{dict.tool[sub.labelKey]}</span>
                                        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                                      </Link>
                                    </li>
                                  )
                                })}
                              </ul>
                            ) : null}
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )
              })}
            </div>
          </div>
          <div className="shrink-0 border-t bg-muted/20 px-3 py-3 safe-area-pb">
            <Link
              href="/"
              onClick={() => setCatalogOpen(false)}
              className="flex min-h-[44px] items-center justify-center rounded-xl border border-border bg-background px-3 text-sm font-medium text-primary transition-colors hover:bg-muted/50 active:bg-muted/70"
            >
              {tr(
                'Mở trang chủ (dạng lưới)',
                'Open homepage (grid view)',
                '打开首页（网格视图）',
                'ホームページを開く（グリッド）',
                '홈 열기 (격자 보기)'
              )}
            </Link>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
