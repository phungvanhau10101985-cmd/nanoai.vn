import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getServerDictionary } from '@/lib/i18n/server'
import { cn } from '@/lib/utils'
import {
  CREATION_SIDEBAR_POPULAR_LINKS,
  getCreationRelatedLinks,
  type CreationRelatedItem,
} from '@/lib/creation-tool-sidebar-config'

type Props = {
  children: React.ReactNode
  /** URL hiện tại để highlight & suy ra menu liên quan (vd /tao-banner). */
  currentHref: string
  /** Mặc định: Bảng điều khiển (hub công cụ). */
  backHref?: string
  /** Ghi đè menu liên quan (vd trang /lop/[id]/gan-phieu). */
  relatedLinks?: CreationRelatedItem[] | null
}

export function CreationToolPageShell({
  children,
  currentHref,
  backHref = '/dashboard',
  relatedLinks: relatedOverride,
}: Props) {
  const { t } = getServerDictionary()
  const path = currentHref.replace(/\/$/, '') || '/'
  const relatedLinks =
    relatedOverride === undefined ? getCreationRelatedLinks(path) : (relatedOverride ?? [])

  const renderBackButton = () => (
    <Button
      variant="outline"
      size="sm"
      className="w-full touch-manipulation justify-start gap-2 lg:w-auto lg:shrink-0 lg:border-border/80 lg:bg-background/90"
      asChild
    >
      <Link href={backHref}>
        <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
        {t.creationSidebar.back}
      </Link>
    </Button>
  )

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-3 sm:px-6 lg:flex-row lg:items-start lg:gap-8 lg:px-8 xl:gap-10">
      {/* DOM: nội dung trước — mobile hiển thị công cụ + nút quay lại trước menu; lg:order-2 để desktop vẫn sidebar trái */}
      <div className="min-w-0 flex-1 lg:order-2 lg:min-h-0 lg:pl-0.5 xl:pl-1">
        <div
          className={cn(
            'sticky top-[4.5rem] z-[9] -mx-0.5 mb-5 border-b border-border/50 bg-background/90 px-0.5 pb-3 pt-0.5 backdrop-blur-sm'
          )}
        >
          {renderBackButton()}
        </div>
        {children}
      </div>

      <aside
        className={cn(
          /* Mobile: menu dưới nội dung; desktop: cột trái */
          'w-full shrink-0 space-y-6 border-t border-border/60 pt-6 pb-6 lg:order-1 lg:border-t-0 lg:pt-0 lg:pb-5',
          'lg:w-56 lg:space-y-5 lg:border lg:border-border/70 lg:rounded-xl lg:bg-card/80 lg:p-4 lg:shadow-sm lg:backdrop-blur-sm xl:rounded-2xl xl:p-5 xl:shadow-md',
          'lg:sticky lg:top-[4.5rem] lg:z-10 lg:self-start lg:max-h-[calc(100dvh-5.5rem)] lg:overflow-y-auto lg:overflow-x-hidden lg:overscroll-contain',
          'xl:w-60'
        )}
      >
        {relatedLinks.length > 0 && (
          <nav className="space-y-1" aria-label={t.creationSidebar.relatedTitle}>
            <p className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground lg:mb-0.5 lg:px-0.5">
              {t.creationSidebar.relatedTitle}
            </p>
            {relatedLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'block rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150 touch-manipulation',
                  'lg:px-2.5 lg:py-2 lg:leading-snug lg:ring-offset-background',
                  'lg:focus-visible:outline-none lg:focus-visible:ring-2 lg:focus-visible:ring-ring lg:focus-visible:ring-offset-2',
                  item.href === path
                    ? 'bg-primary/10 text-primary lg:bg-primary/[0.12]'
                    : 'text-foreground hover:bg-muted/80 lg:hover:bg-muted/70'
                )}
              >
                {t.tool[item.labelKey]}
              </Link>
            ))}
          </nav>
        )}

        <nav
          className="space-y-1 border-t border-border/60 pt-6 lg:border-border/50 lg:pt-5"
          aria-label={t.creationSidebar.popularTitle}
        >
          <p className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground lg:mb-0.5 lg:px-0.5">
            {t.creationSidebar.popularTitle}
          </p>
          {CREATION_SIDEBAR_POPULAR_LINKS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'block touch-manipulation rounded-lg px-3 py-2 text-sm transition-colors duration-150',
                'lg:px-2.5 lg:py-2 lg:leading-snug lg:ring-offset-background',
                'lg:focus-visible:outline-none lg:focus-visible:ring-2 lg:focus-visible:ring-ring lg:focus-visible:ring-offset-2',
                item.href === path
                  ? 'bg-muted/60 font-medium text-foreground lg:bg-muted/50'
                  : 'text-muted-foreground hover:bg-muted/80 hover:text-foreground lg:hover:bg-muted/60'
              )}
            >
              {t.tool[item.labelKey]}
            </Link>
          ))}
        </nav>
      </aside>
    </div>
  )
}
