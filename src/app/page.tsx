import Link from 'next/link'
import { Metadata } from 'next'
import { buildMetadata } from '@/lib/seo'
import { NAV_GROUPS } from '@/lib/nav-config'
import { getServerDictionary } from '@/lib/i18n/server'

export const metadata: Metadata = buildMetadata({
  title: 'NanoAI - Sáng tạo không giới hạn cùng AI',
  description: 'Trải nghiệm phòng thử đồ ảo với AI. Thử đồ 1-5 người, phục dựng ảnh, làm nét ảnh, ghép ảnh. Nhanh chóng, chính xác.',
  path: '/',
  keywords: ['NanoAI', 'thử đồ online', 'thử đồ ảo', 'AI thử đồ', 'phối đồ', 'phục dựng ảnh', 'làm nét ảnh', 'ghép ảnh'],
})

export default function Home() {
  const { t } = getServerDictionary()
  return (
    <div className="min-h-screen">
      <section className="w-full pb-10 pt-5 md:pb-14 md:pt-8">
        <div className="mx-auto w-full max-w-7xl px-3 sm:px-6 lg:px-8">
          <div className="space-y-6 md:space-y-8">
            {NAV_GROUPS.map((group) => (
              <div key={group.titleKey} className="surface-card p-3 sm:p-4 md:p-5">
                <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300 sm:text-base">
                  <span className="h-1.5 w-9 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500" />
                  {t.navGroup[group.titleKey]}
                </h2>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3 lg:grid-cols-5">
                  {group.links.map((item) => {
                    const Icon = item.icon
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="group flex min-h-[132px] flex-col items-center justify-center gap-2 rounded-xl border border-border/70 bg-card/90 p-2 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-200/80 hover:shadow-lg hover:shadow-blue-500/10 dark:hover:border-blue-800/50 dark:hover:bg-slate-900/70 sm:min-h-[160px] sm:p-3"
                      >
                        <div className="flex aspect-square w-full max-w-[92px] items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500/10 to-indigo-500/10 transition-all group-hover:from-blue-500/20 group-hover:to-indigo-500/20 sm:max-w-[110px]">
                          <Icon className="h-[84%] w-[84%] text-blue-600 dark:text-blue-400" strokeWidth={2} />
                        </div>
                        <span className="mt-1 px-1 text-center text-[11px] font-medium leading-tight text-foreground transition-colors group-hover:text-blue-600 dark:group-hover:text-blue-400 sm:text-sm md:text-[15px]">
                          {t.tool[item.labelKey]}
                        </span>
                      </Link>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
