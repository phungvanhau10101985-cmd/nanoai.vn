import { Loader2 } from 'lucide-react'
import { getCurrentWebLocale } from '@/lib/i18n/server'

export default function TienTrinhLoading() {
  const locale = getCurrentWebLocale()
  const loadingText =
    locale === 'en'
      ? 'Loading...'
      : locale === 'zh'
        ? '加载中...'
        : locale === 'ja'
          ? '読み込み中...'
          : locale === 'ko'
            ? '불러오는 중...'
            : 'Đang tải...'
  return (
    <div className="max-w-2xl mx-auto p-6 flex flex-col items-center justify-center min-h-[200px]">
      <Loader2 className="h-10 w-10 animate-spin text-slate-500" />
      <p className="mt-4 text-muted-foreground">{loadingText}</p>
    </div>
  )
}
