import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import type { NavGroupLinkItem } from '@/lib/nav-config'

type Variant = 'surface' | 'card'

export function NavHubLinkTile({ item, t, variant }: { item: NavGroupLinkItem; t: Dictionary; variant: Variant }) {
  const Icon = item.icon
  const subLinks = item.subLinks

  if (subLinks?.length) {
    if (variant === 'card') {
      return (
        <Card className="tool-tile h-full border-border/70 shadow-sm">
          <CardContent className="flex h-full flex-col gap-0 p-2 sm:p-3">
            <Link
              href={item.href}
              className="group flex min-h-[100px] flex-col items-center justify-center gap-2 rounded-lg p-1 text-center transition-colors hover:bg-muted/40 sm:min-h-[112px]"
            >
              <div className="flex aspect-square w-full max-w-[92px] items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500/10 to-indigo-500/10 transition-all group-hover:from-blue-500/20 group-hover:to-indigo-500/20 sm:max-w-[106px]">
                <Icon className="h-[82%] w-[82%] text-blue-600 dark:text-blue-400" />
              </div>
              <span className="mt-0.5 px-1 text-[11px] font-semibold leading-tight text-foreground group-hover:text-blue-600 dark:group-hover:text-blue-400 sm:text-sm md:text-[15px]">
                {t.tool[item.labelKey]}
              </span>
            </Link>
            <div className="mt-2 space-y-1.5 border-t border-border/60 pt-2">
              {subLinks.map((sub) => {
                const SubIcon = sub.icon
                return (
                  <Link
                    key={sub.href}
                    href={sub.href}
                    className="flex min-h-[44px] items-center gap-2 rounded-lg border border-blue-500/15 bg-blue-500/[0.07] px-2.5 py-2 transition-colors hover:border-blue-500/30 hover:bg-blue-500/10 dark:border-blue-400/20 dark:bg-blue-400/10 dark:hover:bg-blue-400/15"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-background/80">
                      <SubIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </span>
                    <span className="text-left text-[11px] font-medium leading-tight text-foreground sm:text-xs md:text-sm">
                      {t.tool[sub.labelKey]}
                    </span>
                  </Link>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )
    }

    return (
      <div className="flex h-full min-h-[132px] flex-col rounded-xl border border-border/70 bg-card/90 p-2 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-200/80 hover:shadow-lg hover:shadow-blue-500/10 dark:hover:border-blue-800/50 dark:hover:bg-slate-900/70 sm:min-h-[168px] sm:p-3">
        <Link
          href={item.href}
          className="group flex flex-1 flex-col items-center justify-center gap-2 rounded-lg p-1 text-center"
        >
          <div className="flex aspect-square w-full max-w-[92px] items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500/10 to-indigo-500/10 transition-all group-hover:from-blue-500/20 group-hover:to-indigo-500/20 sm:max-w-[110px]">
            <Icon className="h-[84%] w-[84%] text-blue-600 dark:text-blue-400 [&_svg]:stroke-[2]" />
          </div>
          <span className="mt-1 px-1 text-center text-[11px] font-semibold leading-tight text-foreground transition-colors group-hover:text-blue-600 dark:group-hover:text-blue-400 sm:text-sm md:text-[15px]">
            {t.tool[item.labelKey]}
          </span>
        </Link>
        <div className="mt-auto space-y-1.5 border-t border-border/60 pt-2">
          {subLinks.map((sub) => {
            const SubIcon = sub.icon
            return (
              <Link
                key={sub.href}
                href={sub.href}
                className="flex min-h-[44px] items-center gap-2 rounded-lg border border-blue-500/15 bg-blue-500/[0.07] px-2 py-2 transition-colors hover:border-blue-500/30 hover:bg-blue-500/10 dark:border-blue-400/20 dark:bg-blue-400/10 dark:hover:bg-blue-400/15"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-background/80">
                  <SubIcon className="h-5 w-5 text-blue-600 dark:text-blue-400 [&_svg]:stroke-[2]" />
                </span>
                <span className="text-left text-[11px] font-medium leading-tight sm:text-xs md:text-sm">{t.tool[sub.labelKey]}</span>
              </Link>
            )
          })}
        </div>
      </div>
    )
  }

  if (variant === 'card') {
    return (
      <Link href={item.href}>
        <Card className="tool-tile cursor-pointer">
          <CardContent className="flex min-h-[132px] flex-col items-center justify-center gap-2 p-2 text-center sm:min-h-[152px] sm:p-3">
            <div className="flex aspect-square w-full max-w-[92px] items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500/10 to-indigo-500/10 sm:max-w-[106px]">
              <Icon className="h-[82%] w-[82%] text-blue-600 dark:text-blue-400" />
            </div>
            <span className="mt-1 px-1 text-[11px] font-medium leading-tight sm:text-sm md:text-[15px]">{t.tool[item.labelKey]}</span>
          </CardContent>
        </Card>
      </Link>
    )
  }

  return (
    <Link
      href={item.href}
      className="group flex min-h-[132px] flex-col items-center justify-center gap-2 rounded-xl border border-border/70 bg-card/90 p-2 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-200/80 hover:shadow-lg hover:shadow-blue-500/10 dark:hover:border-blue-800/50 dark:hover:bg-slate-900/70 sm:min-h-[160px] sm:p-3"
    >
      <div className="flex aspect-square w-full max-w-[92px] items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500/10 to-indigo-500/10 transition-all group-hover:from-blue-500/20 group-hover:to-indigo-500/20 sm:max-w-[110px]">
        <Icon className="h-[84%] w-[84%] text-blue-600 dark:text-blue-400 [&_svg]:stroke-[2]" />
      </div>
      <span className="mt-1 px-1 text-center text-[11px] font-medium leading-tight text-foreground transition-colors group-hover:text-blue-600 dark:group-hover:text-blue-400 sm:text-sm md:text-[15px]">
        {t.tool[item.labelKey]}
      </span>
    </Link>
  )
}
