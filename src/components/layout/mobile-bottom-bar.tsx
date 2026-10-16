'use client'

import Link from 'next/link'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Sparkles, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useWebLocaleFromDocumentCookie } from '@/hooks/use-web-locale-from-cookie'
import { subscribeToUrlChanges } from '@/lib/client-history-navigation'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { AI_TOOLS, NAV_GROUPS, type NavIcon } from '@/lib/nav-config'
import { MobileNav } from '@/components/layout/mobile-nav'
import {
  activeMobileFeatureHref,
  buildMobileFeatureDock,
  dockHomeScrollLeft,
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

const HOME_RETURN_MS = 3000
const HOME_SLOP_PX = 12

function iconFor(href: string): NavIcon | LucideIcon {
  return ICON_BY_HREF.get(href) ?? Sparkles
}

function measureHomeScroll(root: HTMLElement): number | null {
  const startEl = root.querySelector<HTMLElement>('[data-dock-focus-start]')
  const endEl = root.querySelector<HTMLElement>('[data-dock-focus-end]')
  if (!startEl || !endEl) return null
  const seamEl = root.querySelector<HTMLElement>('[data-dock-focus-seam]')
  const clusterLeft = startEl.offsetLeft
  const clusterWidth = endEl.offsetLeft + endEl.offsetWidth - clusterLeft
  return dockHomeScrollLeft({
    clusterLeft,
    clusterWidth,
    seamLeft: seamEl ? seamEl.offsetLeft : null,
    viewport: root.clientWidth,
    maxScroll: Math.max(0, root.scrollWidth - root.clientWidth),
  })
}

export function MobileBottomBar() {
  const uiLocale = useWebLocaleFromDocumentCookie()
  const [pathname, setPathname] = useState('/')
  const [recentHrefs, setRecentHrefs] = useState<string[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const hideOnAuth = pathname.startsWith('/auth')
  const tr = (vi: string, en: string, zh: string, ja: string, ko: string) => {
    if (uiLocale === 'en') return en
    if (uiLocale === 'zh') return zh
    if (uiLocale === 'ja') return ja
    if (uiLocale === 'ko') return ko
    return vi
  }
  const dict = useMemo(() => getDictionary(uiLocale), [uiLocale])
  const scrollerRef = useRef<HTMLDivElement>(null)
  const homeScrollRef = useRef(0)
  const returnTimerRef = useRef<number | null>(null)
  const touchingRef = useRef(false)
  const programmaticRef = useRef(false)

  useEffect(() => {
    setIsAdmin(document.getElementById('nanoai-is-admin')?.getAttribute('data-admin') === '1')
  }, [])

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
  const focusStart = items.findIndex((item) => item.kind !== 'catalog')
  const focusEnd = items.reduce((last, item, index) => (item.kind !== 'catalog' ? index : last), -1)
  const seamIndex = items.findIndex(
    (item, index) => index >= focusStart && (item.kind === 'current' || item.kind === 'recent')
  )

  useLayoutEffect(() => {
    const root = scrollerRef.current
    if (!root) return
    const target = measureHomeScroll(root)
    if (target == null) return
    homeScrollRef.current = target
    programmaticRef.current = true
    root.scrollTo({ left: target, behavior: 'auto' })
    programmaticRef.current = false
  }, [items])

  useEffect(() => {
    const root = scrollerRef.current
    if (!root) return

    const clearTimer = () => {
      if (returnTimerRef.current == null) return
      window.clearTimeout(returnTimerRef.current)
      returnTimerRef.current = null
    }

    const scrollHome = (behavior: ScrollBehavior) => {
      const target = measureHomeScroll(root)
      if (target == null) return
      homeScrollRef.current = target
      if (Math.abs(root.scrollLeft - target) <= HOME_SLOP_PX) {
        root.scrollTo({ left: target, behavior: 'auto' })
        return
      }
      const motion = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : behavior
      programmaticRef.current = true
      root.scrollTo({ left: target, behavior: motion })
      const release = () => {
        programmaticRef.current = false
      }
      if (motion === 'auto') {
        release()
        return
      }
      root.addEventListener('scrollend', release, { once: true })
      window.setTimeout(release, 900)
    }

    const armReturn = () => {
      clearTimer()
      if (touchingRef.current || programmaticRef.current) return
      if (Math.abs(root.scrollLeft - homeScrollRef.current) <= HOME_SLOP_PX) return
      returnTimerRef.current = window.setTimeout(() => {
        returnTimerRef.current = null
        scrollHome('smooth')
      }, HOME_RETURN_MS)
    }

    const onScroll = () => {
      if (programmaticRef.current) return
      armReturn()
    }

    const onPointerDown = () => {
      touchingRef.current = true
      clearTimer()
      if (!programmaticRef.current) return
      programmaticRef.current = false
      root.scrollTo({ left: root.scrollLeft, behavior: 'auto' })
    }

    const onPointerUp = () => {
      touchingRef.current = false
      armReturn()
    }

    const onClick = (event: MouseEvent) => {
      const target = event.target
      if (!(target instanceof Element) || !target.closest('a')) return
      clearTimer()
    }

    const onResize = () => {
      const target = measureHomeScroll(root)
      if (target == null) return
      homeScrollRef.current = target
      if (Math.abs(root.scrollLeft - target) <= 48) {
        programmaticRef.current = true
        root.scrollTo({ left: target, behavior: 'auto' })
        programmaticRef.current = false
      }
    }

    root.addEventListener('scroll', onScroll, { passive: true })
    root.addEventListener('pointerdown', onPointerDown)
    root.addEventListener('pointerup', onPointerUp)
    root.addEventListener('pointercancel', onPointerUp)
    root.addEventListener('click', onClick)
    window.addEventListener('resize', onResize)
    return () => {
      clearTimer()
      root.removeEventListener('scroll', onScroll)
      root.removeEventListener('pointerdown', onPointerDown)
      root.removeEventListener('pointerup', onPointerUp)
      root.removeEventListener('pointercancel', onPointerUp)
      root.removeEventListener('click', onClick)
      window.removeEventListener('resize', onResize)
    }
  }, [items])

  if (hideOnAuth) return null

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 px-2 pb-2 md:hidden safe-area-pb"
      aria-label={tr(
        'Mọi tính năng. Giữa là tính năng liên quan và vừa xem',
        'All features. Related and recent features in the center',
        '全部功能。中间是相关和最近使用的功能',
        'すべての機能。中央は関連機能と最近使った機能',
        '모든 기능. 가운데는 관련 기능과 최근 기능'
      )}
    >
      <div className="mx-auto flex h-16 w-full max-w-xl items-stretch overflow-hidden rounded-2xl border border-border/70 bg-background/92 shadow-[0_-8px_24px_rgba(2,6,23,0.08)] backdrop-blur-xl supports-[backdrop-filter]:bg-background/80 dark:shadow-[0_-8px_24px_rgba(2,6,23,0.45)]">
        <div
          ref={scrollerRef}
          className="flex min-w-0 flex-1 items-stretch overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {items.map((item, index) => (
            <FeatureDockLink
              key={`${item.kind}-${item.href}`}
              item={item}
              label={dict.tool[item.labelKey]}
              active={item.href === activeHref}
              showDivider={
                (focusStart > 0 && index === focusStart) ||
                (seamIndex > focusStart && index === seamIndex) ||
                (focusEnd >= 0 && focusEnd < items.length - 1 && index === focusEnd + 1)
              }
              focusStart={index === focusStart}
              focusEnd={index === focusEnd}
              focusSeam={index === seamIndex && seamIndex > focusStart}
            />
          ))}
        </div>
        <div className="flex w-[4.5rem] shrink-0 items-stretch border-l border-border/70 bg-background">
          <MobileNav isAdmin={isAdmin} t={dict} />
        </div>
      </div>
    </nav>
  )
}

function FeatureDockLink({
  item,
  label,
  active,
  showDivider,
  focusStart,
  focusEnd,
  focusSeam,
}: {
  item: MobileFeatureDockItem
  label: string
  active: boolean
  showDivider: boolean
  focusStart: boolean
  focusEnd: boolean
  focusSeam: boolean
}) {
  const Icon = iconFor(item.href)
  return (
    <>
      {showDivider ? <span className="my-3 w-px shrink-0 bg-border/80" aria-hidden /> : null}
      <Link
        href={item.href}
        data-dock-href={item.href}
        data-dock-focus-start={focusStart ? 'true' : undefined}
        data-dock-focus-end={focusEnd ? 'true' : undefined}
        data-dock-focus-seam={focusSeam ? 'true' : undefined}
        aria-current={active ? 'page' : undefined}
        title={label}
        className={cn(
          'mx-0.5 flex w-[4.75rem] shrink-0 touch-manipulation flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-center transition-colors',
          active ? 'bg-primary/8 text-primary font-semibold' : 'text-muted-foreground hover:text-foreground active:bg-muted/50'
        )}
      >
        <Icon className={cn('h-5 w-5 shrink-0', active && 'stroke-[2.5px]')} />
        <span className="line-clamp-2 w-full text-[10px] font-medium leading-tight">{label}</span>
      </Link>
    </>
  )
}
