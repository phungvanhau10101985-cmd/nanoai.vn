import { Metadata } from 'next'
import { Suspense } from 'react'
import { buildMetadata } from '@/lib/seo'
import { NAV_GROUPS } from '@/lib/nav-config'
import { NavHubLinkTile } from '@/components/layout/nav-hub-link-tile'
import { HomeHubChatBar } from '@/components/home/home-hub-chat-bar'
import { getServerDictionary } from '@/lib/i18n/server'

export const metadata: Metadata = buildMetadata({
  title: 'NanoAI - Sáng tạo không giới hạn cùng AI',
  description: 'Trải nghiệm phòng thử đồ ảo với AI. Thử đồ 1-5 người, phục dựng ảnh, làm nét ảnh, ghép ảnh. Nhanh chóng, chính xác.',
  path: '/',
  keywords: ['NanoAI', 'thử đồ online', 'thử đồ ảo', 'AI thử đồ', 'phối đồ', 'phục dựng ảnh', 'làm nét ảnh', 'ghép ảnh'],
})

function HomeHubChatBarSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="surface-card min-h-[170px] animate-pulse border border-indigo-100/80 p-3 sm:min-h-[185px] sm:p-5 dark:border-indigo-900/40"
    >
      <div className="h-6 w-48 rounded bg-muted/60" />
      <div className="mt-4 h-16 w-full rounded-lg bg-muted/40" />
      <div className="mt-4 flex flex-wrap gap-2">
        <div className="h-7 w-28 rounded-full bg-muted/40" />
        <div className="h-7 w-32 rounded-full bg-muted/40" />
        <div className="h-7 w-24 rounded-full bg-muted/40" />
      </div>
      <div className="mt-6 h-20 w-full rounded-lg bg-muted/30" />
    </div>
  )
}

export default function Home() {
  const { t } = getServerDictionary()
  return (
    <div className="min-h-screen">
      <section className="w-full pb-10 pt-5 md:pb-14 md:pt-8">
        <div className="mx-auto w-full max-w-7xl px-3 sm:px-6 lg:px-8">
          <h1 className="sr-only">
            {t.app.siteName} - {t.app.defaultDescription || 'Nền tảng Trí tuệ Nhân tạo Đa tính năng'}
          </h1>
          <div className="space-y-6 md:space-y-8">
            <Suspense fallback={<HomeHubChatBarSkeleton />}>
              <HomeHubChatBar />
            </Suspense>
            {NAV_GROUPS.map((group) => {
              const homeLinks = group.links.filter((item) => item.showOnHomepage !== false)
              if (homeLinks.length === 0) return null
              return (
                <div key={group.titleKey} className="surface-card p-3 sm:p-4 md:p-5">
                  <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300 sm:text-base">
                    <span className="h-1.5 w-9 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500" />
                    {t.navGroup[group.titleKey]}
                  </h2>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3 lg:grid-cols-5">
                    {homeLinks.map((item) => (
                      <NavHubLinkTile key={item.href} item={item} t={t} variant="surface" />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>
    </div>
  )
}
