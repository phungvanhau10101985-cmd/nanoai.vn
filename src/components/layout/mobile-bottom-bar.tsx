'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Sparkles, Wallet, Home } from 'lucide-react'
import { cn } from '@/lib/utils'

const MOBILE_BAR_ITEMS = [
  { href: '/', label: 'Trang chủ', icon: Home },
  { href: '/dashboard', label: 'Bảng điều khiển', icon: LayoutDashboard },
  { href: '/thu-do-online', label: 'Thử đồ', icon: Sparkles },
  { href: '/wallet', label: 'Ví', icon: Wallet },
]

export function MobileBottomBar() {
  const pathname = usePathname()
  const hideOnAuth = pathname.startsWith('/auth')

  if (hideOnAuth) return null

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 md:hidden border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 safe-area-pb"
      aria-label="Điều hướng nhanh"
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
                {item.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
