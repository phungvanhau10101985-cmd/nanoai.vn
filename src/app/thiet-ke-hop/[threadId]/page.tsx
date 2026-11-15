import type { Metadata } from 'next'
import { BoxFoldStudioPage } from '@/components/packaging/box-fold-studio-page'
import type { WebLocale } from '@/lib/i18n/config'
import { getCurrentWebLocale } from '@/lib/i18n/server'

export const dynamic = 'force-dynamic'

const TITLE: Record<WebLocale, string> = {
  vi: 'Dàn trang hộp',
  en: 'Box layout',
  zh: '盒型展开',
  ja: '箱の展開',
  ko: '박스 전개',
}

export function generateMetadata(): Metadata {
  return {
    title: TITLE[getCurrentWebLocale()],
    robots: { index: false, follow: false },
  }
}

export default function ThietKeHopPage({ params }: { params: { threadId: string } }) {
  return <BoxFoldStudioPage threadId={params.threadId} locale={getCurrentWebLocale()} />
}
