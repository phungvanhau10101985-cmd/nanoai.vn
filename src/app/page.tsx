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

export default function Home() {
  const { t } = getServerDictionary()
  return (
    <div className="min-h-screen">
      <section className="w-full pb-10 pt-5 md:pb-14 md:pt-8">
        <div className="mx-auto w-full max-w-7xl px-3 sm:px-6 lg:px-8">
          <div className="space-y-6 md:space-y-8">
            <Suspense fallback={null}>
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
