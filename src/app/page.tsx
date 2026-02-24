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
    <div className="flex flex-col min-h-screen">
      {/* Công cụ AI - Grid theo nhóm */}
      <section className="w-full pt-6 pb-8 md:pt-8 md:pb-10">
        <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 md:px-8 lg:px-12">
          <div className="space-y-8">
            {NAV_GROUPS.map((group) => (
              <div key={group.titleKey}>
                <h2 className="text-base font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                  <span className="h-1 w-8 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500" />
                  {t.navGroup[group.titleKey]}
                </h2>
                <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-0 sm:gap-3">
                  {group.links.map((item) => {
                    const Icon = item.icon
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="group flex flex-col items-center justify-center gap-1 p-0.5 sm:p-4 rounded-none sm:rounded-xl border border-r-0 last:border-r border-t-0 first:border-t sm:border bg-card hover:bg-slate-50/80 dark:hover:bg-slate-800/50 hover:border-blue-200/60 dark:hover:border-blue-800/40 hover:shadow-lg hover:shadow-blue-500/5 transition-all duration-200"
                      >
                        <div className="flex w-[30vw] max-w-[150px] aspect-square items-center justify-center bg-gradient-to-br from-blue-500/10 to-indigo-500/10 group-hover:from-blue-500/20 group-hover:to-indigo-500/20 transition-all">
                          <Icon className="h-full w-full text-blue-600 dark:text-blue-400" strokeWidth={2} />
                        </div>
                        <span className="text-xs sm:text-sm md:text-base font-medium text-center leading-tight text-foreground group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors mt-1 px-1">
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
