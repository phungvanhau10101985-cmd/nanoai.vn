import { Metadata } from 'next'
import { Suspense } from 'react'
import { buildMetadata } from '@/lib/seo'
import { HomeFeatureGroups } from '@/components/home/home-feature-groups'
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
  const { locale, t } = getServerDictionary()
  return (
    <div className="max-md:flex max-md:min-h-0 max-md:flex-1 max-md:flex-col max-md:overflow-hidden md:min-h-screen">
      <section className="w-full max-md:flex max-md:min-h-0 max-md:flex-1 max-md:flex-col max-md:overflow-hidden max-md:p-0 md:pb-14 md:pt-8 pb-10 pt-5">
        <div className="mx-auto w-full max-w-7xl max-md:flex max-md:min-h-0 max-md:flex-1 max-md:flex-col max-md:overflow-hidden max-md:px-0 px-3 sm:px-6 lg:px-8">
          <h1 className="sr-only">
            {t.app.siteName} - {t.app.defaultDescription || 'Nền tảng Trí tuệ Nhân tạo Đa tính năng'}
          </h1>
          <div className="max-md:flex max-md:min-h-0 max-md:flex-1 max-md:flex-col max-md:space-y-0 max-md:overflow-hidden space-y-6 md:space-y-8">
            <Suspense fallback={<HomeHubChatBarSkeleton />}>
              <HomeHubChatBar />
            </Suspense>
            <div className="hidden space-y-6 md:block md:space-y-8">
              <HomeFeatureGroups locale={locale} />
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
