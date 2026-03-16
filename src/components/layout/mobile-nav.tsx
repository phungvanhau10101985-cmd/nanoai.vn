'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger, SheetClose } from '@/components/ui/sheet'
import { Menu, ChevronRight, BarChart3 } from 'lucide-react'
import { NAV_GROUPS } from '@/lib/nav-config'
import type { Dictionary } from '@/lib/i18n/dictionaries'

interface MobileNavProps {
  isAdmin: boolean
  t: Dictionary
}

export function MobileNav({ isAdmin, t }: MobileNavProps) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-11 w-11 min-h-[44px] min-w-[44px] md:hidden touch-manipulation rounded-xl active:scale-95 transition-transform"
          aria-label={t.menu.openMenu}
        >
          <Menu className="h-6 w-6" />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="left"
        className="flex flex-col w-[min(340px,90vw)] max-w-[340px] p-0 gap-0 overflow-hidden border-r-0 rounded-r-2xl"
      >
        <div className="flex items-center justify-between px-5 pt-14 pb-4 border-b shrink-0 safe-area-pt">
          <SheetClose asChild>
            <Link
              href="/"
              className="flex items-center gap-2 font-bold text-lg tracking-tight"
            >
              <img src="/icons/icon-192x192.png" alt={t.app.siteName} width={40} height={40} className="rounded-lg" />
              {t.app.siteName}
            </Link>
          </SheetClose>
        </div>
        <nav
          className="flex-1 overflow-y-auto overscroll-contain py-4 px-3 safe-area-pb mobile-nav-scroll"
          aria-label={t.menu.mainMenu}
        >
          <div className="flex flex-col gap-6">
            {NAV_GROUPS.map((group) => (
              <div key={group.titleKey} className="space-y-1">
                <h3 className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t.navGroup[group.titleKey]}
                </h3>
                <div className="flex flex-col gap-0.5 rounded-xl overflow-hidden bg-muted/30">
                  {group.links.map((item) => {
                    const Icon = item.icon
                    return (
                      <SheetClose asChild key={item.href}>
                        <Link
                          href={item.href}
                          className="flex items-center gap-3 min-h-[48px] px-4 py-3 text-sm font-medium transition-colors touch-manipulation active:bg-muted/60 text-foreground hover:bg-muted/50"
                        >
                          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-background">
                            <Icon className="h-5 w-5" />
                          </span>
                          <span className="flex-1">{t.tool[item.labelKey]}</span>
                          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                        </Link>
                      </SheetClose>
                    )
                  })}
                </div>
              </div>
            ))}
            {isAdmin && (
              <div className="space-y-1">
                <h3 className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t.menu.system}
                </h3>
                <div className="flex flex-col gap-0.5 rounded-xl overflow-hidden bg-muted/30">
                  <SheetClose asChild>
                    <Link
                      href="/admin/users"
                      className="flex items-center gap-3 min-h-[48px] px-4 py-3 text-sm font-medium text-foreground hover:bg-muted/50 transition-colors touch-manipulation"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-background">
                        <BarChart3 className="h-4 w-4" />
                      </span>
                      <span>{t.menu.admin}</span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto" />
                    </Link>
                  </SheetClose>
                  <SheetClose asChild>
                    <Link
                      href="/admin/english-coach"
                      className="flex items-center gap-3 min-h-[48px] px-4 py-3 text-sm font-medium text-foreground hover:bg-muted/50 transition-colors touch-manipulation"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-background">
                        <BarChart3 className="h-4 w-4" />
                      </span>
                      <span>Chuẩn hóa từ vựng</span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto" />
                    </Link>
                  </SheetClose>
                  <SheetClose asChild>
                    <Link
                      href="/admin/curriculum-edit-reviews"
                      className="flex items-center gap-3 min-h-[48px] px-4 py-3 text-sm font-medium text-foreground hover:bg-muted/50 transition-colors touch-manipulation"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-background">
                        <BarChart3 className="h-4 w-4" />
                      </span>
                      <span>Duyệt giáo trình</span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto" />
                    </Link>
                  </SheetClose>
                </div>
              </div>
            )}
          </div>
        </nav>
      </SheetContent>
    </Sheet>
  )
}
