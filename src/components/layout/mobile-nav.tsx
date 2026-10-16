'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger, SheetClose, SheetTitle } from '@/components/ui/sheet'
import { Menu, BarChart3, Sparkles, type LucideIcon } from 'lucide-react'
import { AI_TOOLS, NAV_GROUPS, type NavIcon } from '@/lib/nav-config'
import { subscribeToUrlChanges } from '@/lib/client-history-navigation'
import {
  activeMobileFeatureHref,
  buildMobileFeatureGrid,
  readFeatureVisitCounts,
  rememberFeatureVisit,
  type MobileFeatureDockItem,
} from '@/lib/mobile-feature-dock'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import { cn } from '@/lib/utils'

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

interface MobileNavProps {
  isAdmin: boolean
  t: Dictionary
}

export function MobileNav({ isAdmin, t }: MobileNavProps) {
  const [pathname, setPathname] = useState('/')
  const [recentHrefs, setRecentHrefs] = useState<string[]>([])
  const [visitCounts, setVisitCounts] = useState<Record<string, number>>({})

  useEffect(() => {
    const syncPath = () => {
      const path = window.location.pathname || '/'
      setPathname(path)
      setRecentHrefs(rememberFeatureVisit(path))
      setVisitCounts(readFeatureVisitCounts())
    }
    syncPath()
    return subscribeToUrlChanges(syncPath)
  }, [])

  const { lead, rest } = useMemo(
    () => buildMobileFeatureGrid(pathname, recentHrefs, visitCounts),
    [pathname, recentHrefs, visitCounts]
  )
  const activeHref = activeMobileFeatureHref(pathname, [...lead, ...rest])
  const personalLead = lead.length > 0

  const trigger = (
    <SheetTrigger asChild>
      <Button
        variant="ghost"
        className="h-full w-full min-h-0 flex-col gap-1 rounded-none px-1 text-[10px] font-medium leading-tight text-foreground touch-manipulation"
        aria-label={t.menu.openMenu}
      >
        <Menu className="h-5 w-5 shrink-0" />
        <span className="line-clamp-2 w-full">{t.menu.catalogButton}</span>
      </Button>
    </SheetTrigger>
  )

  return (
    <Sheet>
      {trigger}
      <SheetContent
        side="bottom"
        className="flex h-[min(85dvh,40rem)] flex-col gap-0 rounded-t-2xl p-0 [&>button]:right-3 [&>button]:top-3 [&>button]:z-10 [&>button]:flex [&>button]:h-8 [&>button]:w-8 [&>button]:items-center [&>button]:justify-center [&>button]:rounded-full [&>button]:bg-muted"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b py-3 pl-4 pr-14">
          <SheetTitle className="shrink-0 text-base">{t.menu.mainMenu}</SheetTitle>
          <SheetClose asChild>
            <Link href="/" className="flex min-w-0 items-center gap-1.5 text-sm font-semibold">
              <Image
                src="/icons/icon-192x192.png"
                alt={t.app.siteName}
                width={28}
                height={28}
                unoptimized
                className="h-7 w-7 shrink-0 rounded-md"
              />
              <span className="truncate">{t.app.siteName}</span>
            </Link>
          </SheetClose>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3 safe-area-pb">
          {personalLead ? (
            <section className="mb-4">
              <h3 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t.menu.featureGridLead}
              </h3>
              <FeatureGrid items={lead} activeHref={activeHref} labelFor={(key) => t.tool[key]} />
            </section>
          ) : null}
          <section>
            {personalLead ? (
              <h3 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t.menu.featureGridRest}
              </h3>
            ) : null}
            <FeatureGrid
              items={personalLead ? rest : [...lead, ...rest]}
              activeHref={activeHref}
              labelFor={(key) => t.tool[key]}
            />
          </section>
          {isAdmin ? (
            <div className="mt-4 space-y-1 border-t pt-3">
              <h3 className="px-1 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t.menu.system}
              </h3>
              <SheetClose asChild>
                <Link href="/admin/users" className="flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-medium">
                  <BarChart3 className="h-4 w-4" />
                  {t.menu.admin}
                </Link>
              </SheetClose>
              <SheetClose asChild>
                <Link
                  href="/admin/english-coach"
                  className="flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-medium"
                >
                  <BarChart3 className="h-4 w-4" />
                  Chuẩn hóa từ vựng
                </Link>
              </SheetClose>
              <SheetClose asChild>
                <Link
                  href="/admin/curriculum-edit-reviews"
                  className="flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-medium"
                >
                  <BarChart3 className="h-4 w-4" />
                  Duyệt giáo trình
                </Link>
              </SheetClose>
            </div>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function FeatureGrid({
  items,
  activeHref,
  labelFor,
}: {
  items: MobileFeatureDockItem[]
  activeHref: string | null
  labelFor: (key: MobileFeatureDockItem['labelKey']) => string
}) {
  return (
    <div className="grid grid-cols-3 gap-2.5">
      {items.map((item) => {
        const Icon = iconFor(item.href)
        const label = labelFor(item.labelKey)
        const active = item.href === activeHref
        return (
          <SheetClose asChild key={item.href}>
            <Link
              href={item.href}
              aria-current={active ? 'page' : undefined}
              title={label}
              className={cn(
                'flex min-h-[7.25rem] flex-col items-center justify-start gap-2 rounded-2xl border border-transparent px-1.5 pb-2.5 pt-2.5 text-center touch-manipulation active:bg-muted/70',
                active ? 'border-primary/30 bg-primary/8 font-semibold text-primary' : 'bg-muted/30 text-foreground'
              )}
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center">
                <Icon className={cn('h-11 w-11 max-h-full max-w-full shrink-0', active && 'stroke-[2.25px]')} />
              </span>
              <span className="line-clamp-2 w-full text-sm font-semibold leading-snug">{label}</span>
            </Link>
          </SheetClose>
        )
      })}
    </div>
  )
}
