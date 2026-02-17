'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { Menu, ChevronRight, BarChart3 } from 'lucide-react'
import { NAV_GROUPS } from '@/lib/nav-config'

interface MobileNavProps {
  isAdmin: boolean
}

export function MobileNav({ isAdmin }: MobileNavProps) {
  const [isOpen, setIsOpen] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    setIsOpen(false)
  }, [pathname])

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-11 w-11 min-h-[44px] min-w-[44px] md:hidden touch-manipulation rounded-xl active:scale-95 transition-transform"
          aria-label="Mở menu"
        >
          <Menu className="h-6 w-6" />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="left"
        className="flex flex-col w-[min(340px,90vw)] max-w-[340px] p-0 gap-0 overflow-hidden border-r-0 rounded-r-2xl"
      >
        <div className="flex items-center justify-between px-5 pt-14 pb-4 border-b shrink-0 safe-area-pt">
          <Link
            href="/"
            className="flex items-center gap-2 font-bold text-lg tracking-tight"
            onClick={() => setIsOpen(false)}
          >
            <Image src="/icons/icon-192x192.png" alt="NanoAI" width={40} height={40} className="rounded-lg" />
            NanoAI
          </Link>
        </div>
        <nav
          className="flex-1 overflow-y-auto overscroll-contain py-4 px-3 safe-area-pb mobile-nav-scroll"
          aria-label="Menu chính"
        >
          <div className="flex flex-col gap-6">
            {NAV_GROUPS.map((group) => (
              <div key={group.title} className="space-y-1">
                <h3 className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {group.title}
                </h3>
                <div className="flex flex-col gap-0.5 rounded-xl overflow-hidden bg-muted/30">
                  {group.links.map((item) => {
                    const Icon = item.icon
                    const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setIsOpen(false)}
                        className={`flex items-center gap-3 min-h-[48px] px-4 py-3 text-sm font-medium transition-colors touch-manipulation active:bg-muted/60 ${
                          isActive
                            ? 'bg-primary/10 text-primary border-l-2 border-primary'
                            : 'text-foreground hover:bg-muted/50'
                        }`}
                      >
                        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${isActive ? 'bg-primary/20' : 'bg-background'}`}>
                          <Icon className="h-5 w-5" />
                        </span>
                        <span className="flex-1">{item.label}</span>
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      </Link>
                    )
                  })}
                </div>
              </div>
            ))}
            {isAdmin && (
              <div className="space-y-1">
                <h3 className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Hệ thống
                </h3>
                <Link
                  href="/admin/users"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-3 min-h-[48px] px-4 py-3 rounded-xl bg-muted/30 text-sm font-medium text-foreground hover:bg-muted/50 transition-colors touch-manipulation"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-background">
                    <BarChart3 className="h-4 w-4" />
                  </span>
                  <span>Quản trị</span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto" />
                </Link>
              </div>
            )}
          </div>
        </nav>
      </SheetContent>
    </Sheet>
  )
}
