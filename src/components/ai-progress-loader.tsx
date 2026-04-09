'use client'

import { readWebLocaleFromDocumentCookie } from '@/lib/i18n/read-web-locale-cookie'

import { useEffect, useState } from 'react'
import { Sparkles } from 'lucide-react'

interface AIProgressLoaderProps {
  title: string
  description?: string
  /** Trạng thái tùy chỉnh (vd: "Đang tạo câu 3/5...") – ưu tiên hơn status mặc định */
  customStatus?: string
}

function tr(uiLocale: string, vi: string, en: string, zh: string, ja: string, ko: string) {
  if (uiLocale === 'en') return en
  if (uiLocale === 'zh') return zh
  if (uiLocale === 'ja') return ja
  if (uiLocale === 'ko') return ko
  return vi
}

/** Thanh tiến trình + nhắc khéo giáo viên chờ khi AI đang xử lý (tạo giáo trình, phiếu bài tập, slide...). */
export function AIProgressLoader({ title, description, customStatus }: AIProgressLoaderProps) {
  const [uiLocale, setUiLocale] = useState<'vi' | 'en' | 'zh' | 'ja' | 'ko'>('vi')
  const [elapsedSec, setElapsedSec] = useState(0)

  useEffect(() => {
    const timer = window.setInterval(() => setElapsedSec((prev) => prev + 1), 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const syncLocale = () => {
      const cookieValue = readWebLocaleFromDocumentCookie()
      if (cookieValue === 'en' || cookieValue === 'zh' || cookieValue === 'ja' || cookieValue === 'ko') setUiLocale(cookieValue)
      else setUiLocale('vi')
    }
    syncLocale()
    const timer = window.setInterval(syncLocale, 1000)
    window.addEventListener('focus', syncLocale)
    document.addEventListener('visibilitychange', syncLocale)
    return () => {
      window.removeEventListener('focus', syncLocale)
      document.removeEventListener('visibilitychange', syncLocale)
      window.clearInterval(timer)
    }
  }, [])

  const reminderMessages = [
    tr(uiLocale, 'Hệ thống vẫn đang xử lý an toàn. Kết quả sẽ hiển thị ngay khi hoàn tất.', 'The system is processing safely. Results will appear once complete.', '系统正在安全处理中。完成后将立即显示结果。', 'システムは安全に処理中です。完了後すぐに結果を表示します。', '시스템이 안전하게 처리 중입니다. 완료되면 즉시 결과가 표시됩니다.'),
    tr(uiLocale, 'AI đang tối ưu chất lượng đầu ra. Vui lòng chờ thêm một chút.', 'AI is optimizing output quality. Please wait a bit more.', 'AI正在优化输出质量，请再稍等。', 'AIが出力品質を最適化中です。もう少しお待ちください。', 'AI가 출력 품질을 최적화 중입니다. 잠시만 더 기다려 주세요.'),
    tr(uiLocale, 'Yêu cầu đang được xử lý ổn định. Xin vui lòng không tắt trang.', 'Your request is being processed steadily. Please do not close this page.', '请求正在稳定处理中，请勿关闭页面。', 'リクエストは安定して処理中です。ページを閉じないでください。', '요청이 안정적으로 처리 중입니다. 페이지를 닫지 마세요.'),
  ]
  const reminderCount = Math.floor(elapsedSec / 15)
  const reminderMessage = reminderCount > 0 ? reminderMessages[(reminderCount - 1) % reminderMessages.length] : null

  const statusMessages = [
    tr(uiLocale, 'Đang xử lý yêu cầu của bạn', 'Processing your request', '正在处理你的请求', 'リクエストを処理中', '요청을 처리 중입니다'),
    tr(uiLocale, 'Đang tối ưu chất lượng đầu ra', 'Optimizing output quality', '正在优化输出质量', '出力品質を最適化中', '출력 품질을 최적화 중입니다'),
    tr(uiLocale, 'Đang hoàn thiện kết quả', 'Finalizing result', '正在完成结果', '結果を仕上げ中', '결과를 마무리 중입니다'),
  ]
  const activeStatus = customStatus ? customStatus : statusMessages[Math.floor(elapsedSec / 6) % statusMessages.length]
  const progressValue = Math.min(96, Math.max(8, Math.round((1 - Math.exp(-elapsedSec / 18)) * 100)))
  const subtitle = description?.trim() || tr(uiLocale, 'Hệ thống đang xử lý tự động. Kết quả sẽ xuất hiện ngay khi sẵn sàng.', 'The system is processing automatically. Result will appear when ready.', '系统正在自动处理。结果准备好后将立即显示。', 'システムが自動処理中です。準備ができ次第結果を表示します。', '시스템이 자동 처리 중입니다. 준비되면 결과가 표시됩니다.')

  return (
    <div className="w-full max-w-lg mx-auto">
      <div className="relative overflow-hidden rounded-xl border-2 border-violet-200/80 dark:border-violet-800/60 shadow-lg bg-gradient-to-br from-violet-100/80 via-purple-50/60 to-violet-100/80 dark:from-violet-950/50 dark:via-purple-950/40 dark:to-violet-950/50">
        <div className="relative flex flex-col items-center justify-center py-12 px-6">
          <div className="flex items-center justify-center w-20 h-20 rounded-2xl bg-violet-500/20 dark:bg-violet-500/30 shadow-md mb-6">
            <Sparkles className="w-10 h-10 text-violet-600 dark:text-violet-400 animate-pulse" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-1">{title}</h3>
          <p className="text-sm text-muted-foreground text-center mb-4">{subtitle}</p>
          <div className="w-full mb-4 rounded-lg border border-violet-200/60 dark:border-violet-700/50 bg-white/60 dark:bg-slate-900/40 px-4 py-3">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground/90">
              <span className="inline-flex h-2.5 w-2.5 rounded-full bg-violet-500 animate-pulse" />
              <span>{activeStatus}</span>
            </div>
            <div className="mt-3 h-2.5 w-full rounded-full bg-slate-200/90 dark:bg-slate-700/80 overflow-hidden border border-violet-200/50 dark:border-violet-700/50">
              <div
                className="relative h-full rounded-full bg-gradient-to-r from-violet-500 to-purple-500 transition-[width] duration-1000 ease-out"
                style={{ width: `${progressValue}%` }}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {tr(uiLocale, 'Thời gian xử lý thường từ vài giây đến khoảng 1–2 phút.', 'Processing usually takes from a few seconds to about 1–2 minutes.', '处理时间通常为几秒到约1–2分钟。', '処理時間は通常、数秒〜約1–2分です。', '처리 시간은 보통 몇 초에서 약 1–2분입니다.')}
          </p>
          {reminderMessage && (
            <p className="text-xs text-foreground/80 mt-3 text-center rounded-md border border-violet-400/40 dark:border-violet-600/40 bg-violet-50/80 dark:bg-violet-950/40 px-3 py-2">
              {reminderMessage}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
