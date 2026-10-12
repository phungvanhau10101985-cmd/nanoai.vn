'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Sparkles, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useWebLocaleFromDocumentCookie } from '@/hooks/use-web-locale-from-cookie'
import { subscribeToUrlChanges } from '@/lib/client-history-navigation'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { AI_TOOLS, NAV_GROUPS, type NavIcon } from '@/lib/nav-config'
import {
  activeMobileFeatureHref,
  buildMobileFeatureDock,
  rememberFeatureVisit,
  type MobileFeatureDockItem,
} from '@/lib/mobile-feature-dock'

const ICON_BY_HREF = new Map<string, NavIcon>()
for (const tool of AI_TOOLS) ICON_BY_HREF.set(tool.href, tool.icon)
for (const group of NAV_GROUPS) {
  for (const link of group.links) {
    ICON_BY_HREF.set(link.href, link.icon)
    for (const sub of link.subLinks ?? []) ICON_BY_HREF.set(sub.href, sub.icon)
  }
}

function iconFor(href: string): NavIcon | LucideIcon {
  return ICON_BY_HREF.get(href) ?? Sparkles
}

export function MobileBottomBar() {
  const uiLocale = useWebLocaleFromDocumentCookie()
  const [pathname, setPathname] = useState('/')
  const [recentHrefs, setRecentHrefs] = useState<string[]>([])
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
    const syncPath = () => {
      const path = window.location.pathname || '/'
      setPathname(path)
      setRecentHrefs(rememberFeatureVisit(path))
    }
    syncPath()
    return subscribeToUrlChanges(syncPath)
  }, [])

  const items = useMemo(() => buildMobileFeatureDock(pathname, recentHrefs), [pathname, recentHrefs])
  const activeHref = activeMobileFeatureHref(pathname, items)
  const relatedStart = items.findIndex((item) => item.kind === 'related')
  const scrollerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = scrollerRef.current
    if (!root || !activeHref) return
    const current = root.querySelector<HTMLElement>(`[data-dock-href="${CSS.escape(activeHref)}"]`)
    current?.scrollIntoView({ inline: 'center', block: 'nearest' })
  }, [activeHref, items])

  if (hideOnAuth) return null

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 px-2 pb-2 md:hidden safe-area-pb"
      aria-label={tr(
        'Tính năng vừa mở và liên quan',
        'Recent and related features',
        '最近和相关功能',
        '最近と関連の機能',
        '최근 및 관련 기능'
      )}
    >
      <div
        ref={scrollerRef}
        className="mx-auto flex h-16 max-w-xl snap-x snap-proximity items-stretch overflow-x-auto overscroll-x-contain rounded-2xl border border-border/70 bg-background/92 shadow-[0_-8px_24px_rgba(2,6,23,0.08)] backdrop-blur-xl [scrollbar-width:none] supports-[backdrop-filter]:bg-background/80 dark:shadow-[0_-8px_24px_rgba(2,6,23,0.45)] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((item, index) => (
          <FeatureDockLink
            key={`${item.kind}-${item.href}`}
            item={item}
            label={dict.tool[item.labelKey]}
            active={item.href === activeHref}
            showDivider={relatedStart > 0 && index === relatedStart}
          />
        ))}
      </div>
    </nav>
  )
}

function FeatureDockLink({
  item,
  label,
  active,
  showDivider,
}: {
  item: MobileFeatureDockItem
  label: string
  active: boolean
  showDivider: boolean
}) {
  const Icon = iconFor(item.href)
  return (
    <>
      {showDivider ? <span className="my-3 w-px shrink-0 bg-border/80" aria-hidden /> : null}
      <Link
        href={item.href}
        data-dock-href={item.href}
        aria-current={active ? 'page' : undefined}
        title={label}
        className={cn(
          'mx-0.5 flex w-[4.75rem] shrink-0 touch-manipulation snap-start flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-center transition-colors',
          active ? 'bg-primary/8 text-primary font-semibold' : 'text-muted-foreground hover:text-foreground active:bg-muted/50'
        )}
      >
        <Icon className={cn('h-5 w-5 shrink-0', active && 'stroke-[2.5px]')} />
        <span className="line-clamp-2 w-full text-[10px] font-medium leading-tight">{label}</span>
      </Link>
    </>
  )
}
