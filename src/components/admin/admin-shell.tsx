'use client'

import { useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronDown, Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  ADMIN_NAV_GROUPS,
  ADMIN_OVERVIEW_HREF,
  ADMIN_OVERVIEW_ICON,
  ADMIN_OVERVIEW_TITLE,
  adminNavLabel,
  findActiveAdminNavItem,
  isAdminNavItemActive,
  type AdminNavLabel,
} from '@/lib/admin/admin-nav'

type Props = {
  locale: string
  children: ReactNode
}

function trLabel(labels: AdminNavLabel, locale: string) {
  return adminNavLabel(labels, locale)
}

export function AdminShell({ locale, children }: Props) {
  const pathname = usePathname() || ADMIN_OVERVIEW_HREF
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  const sidebarTitle = useMemo(() => {
    if (locale === 'en') return 'Admin menu'
    if (locale === 'zh') return '管理目录'
    if (locale === 'ja') return '管理メニュー'
    if (locale === 'ko') return '관리 메뉴'
    return 'Danh mục quản trị'
  }, [locale])

  const activeItem = findActiveAdminNavItem(pathname)
  const isOverview = pathname === ADMIN_OVERVIEW_HREF || pathname === `${ADMIN_OVERVIEW_HREF}/`
  const mobileCurrentLabel = isOverview
    ? trLabel(ADMIN_OVERVIEW_TITLE, locale)
    : activeItem
      ? trLabel(activeItem.title, locale)
      : sidebarTitle

  const OverviewIcon = ADMIN_OVERVIEW_ICON

  const navLinkClass = (active: boolean) =>
    cn(
      'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors',
      active
        ? 'bg-violet-500/10 font-medium text-violet-700 dark:text-violet-300'
        : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
    )

  function renderNav() {
    return (
      <nav className="flex flex-col gap-1" aria-label={sidebarTitle}>
        <Link
          href={ADMIN_OVERVIEW_HREF}
          onClick={() => setMobileNavOpen(false)}
          className={navLinkClass(isOverview)}
          aria-current={isOverview ? 'page' : undefined}
        >
          <OverviewIcon className="h-4 w-4 shrink-0" aria-hidden />
          <span className="truncate">{trLabel(ADMIN_OVERVIEW_TITLE, locale)}</span>
        </Link>

        {ADMIN_NAV_GROUPS.map((group) => (
          <div key={group.id} className="mt-1">
            <p className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {trLabel(group.title, locale)}
            </p>
            {group.items.map((item) => {
              const Icon = item.icon
              const active = isAdminNavItemActive(pathname, item)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileNavOpen(false)}
                  className={navLinkClass(active)}
                  aria-current={active ? 'page' : undefined}
                  title={trLabel(item.description, locale)}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden />
                  <span className="truncate">{trLabel(item.title, locale)}</span>
                </Link>
              )
            })}
          </div>
        ))}
      </nav>
    )
  }

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-6">
      <div className="lg:hidden">
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-between"
          onClick={() => setMobileNavOpen((v) => !v)}
          aria-expanded={mobileNavOpen}
        >
          <span className="flex min-w-0 items-center gap-2 truncate">
            <Menu className="h-4 w-4 shrink-0" />
            <span className="truncate">{mobileCurrentLabel}</span>
          </span>
          <ChevronDown
            className={cn(
              'h-4 w-4 shrink-0 transition-transform duration-200',
              mobileNavOpen && 'rotate-180'
            )}
          />
        </Button>
        {mobileNavOpen ? (
          <div className="mt-2 max-h-[min(70dvh,28rem)] overflow-y-auto rounded-xl border border-border/70 bg-card/90 p-2 shadow-sm">
            {renderNav()}
          </div>
        ) : null}
      </div>

      <aside className="hidden w-full shrink-0 lg:block lg:w-56 xl:w-64">
        <div className="rounded-xl border border-border/70 bg-card/90 p-2 shadow-sm lg:sticky lg:top-[calc(var(--site-header-height,3.5rem)+1rem)]">
          <p className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {sidebarTitle}
          </p>
          <div className="max-h-[calc(100dvh-var(--site-header-height,3.5rem)-4rem)] overflow-y-auto">
            {renderNav()}
          </div>
        </div>
      </aside>

      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}
