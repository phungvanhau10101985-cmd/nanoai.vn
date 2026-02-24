'use client'

import { useEffect, useState } from 'react'
import { Sparkles, ImageIcon, Focus, Layers, Layout, User, Palette, Smile, Eraser, Package, Briefcase, Expand, Repeat, Box, BoxSelect, Home, BookOpen, Tag } from 'lucide-react'
import { ImagePreview } from '@/components/ui/image-preview'

export type ProcessingMode = 'restore' | 'sharpen' | 'beautify' | 'merge' | 'tryon' | 'banner' | 'idcard' | 'logo' | 'cheanh' | 'eraser' | 'product' | 'headshot' | 'outpaint' | 'faceswap' | 'mockup3d' | 'model3d' | 'interior' | 'story' | 'sticker'

interface ImageProcessingLoaderProps {
  mode: ProcessingMode
  title: string
  description: string
  steps?: string[]
  imagePreview?: string | null
  imagePreviews?: string[]
}

const modeConfig = {
  restore: {
    icon: ImageIcon,
    gradient: 'from-amber-100/80 via-orange-50/60 to-amber-100/80',
    accent: 'text-amber-700',
    steps: ['Phân tích ảnh gốc', 'Sửa mờ, xước, hư hỏng', 'Tăng chất lượng', 'Hoàn thiện'],
  },
  sharpen: {
    icon: Focus,
    gradient: 'from-sky-100/80 via-blue-50/60 to-sky-100/80',
    accent: 'text-sky-700',
    steps: ['Phân tích độ nét', 'Tăng chi tiết', 'Giảm nhiễu', 'Hoàn thiện'],
  },
  beautify: {
    icon: Sparkles,
    gradient: 'from-rose-100/80 via-pink-50/60 to-rose-100/80',
    accent: 'text-rose-700',
    steps: ['Phân tích khuôn mặt', 'Retouch da, ánh sáng', 'Chỉnh studio', 'Hoàn thiện'],
  },
  merge: {
    icon: Layers,
    gradient: 'from-violet-100/80 via-purple-50/60 to-violet-100/80',
    accent: 'text-violet-700',
    steps: ['Phân tích các ảnh', 'Kết hợp nội dung', 'Tối ưu hòa quyện', 'Hoàn thiện'],
  },
  tryon: {
    icon: Sparkles,
    gradient: 'from-blue-100/50 via-purple-100/50 to-pink-100/50',
    accent: 'text-purple-600',
    steps: ['Phân tích ảnh khách', 'Áp trang phục', 'Điều chỉnh tự nhiên', 'Hoàn thiện'],
  },
  banner: {
    icon: Layout,
    gradient: 'from-emerald-100/80 via-teal-50/60 to-emerald-100/80',
    accent: 'text-emerald-700',
    steps: ['Phân tích yêu cầu', 'Thiết kế layout', 'Tạo banner', 'Hoàn thiện'],
  },
  idcard: {
    icon: User,
    gradient: 'from-indigo-100/80 via-blue-50/60 to-indigo-100/80',
    accent: 'text-indigo-700',
    steps: ['Phân tích ảnh', 'Tách nền', 'Chuẩn hóa ảnh thẻ', 'Hoàn thiện'],
  },
  logo: {
    icon: Palette,
    gradient: 'from-amber-100/80 via-yellow-50/60 to-amber-100/80',
    accent: 'text-amber-700',
    steps: ['Phân tích yêu cầu', 'Phác thảo ý tưởng', 'Tạo logo', 'Hoàn thiện'],
  },
  cheanh: {
    icon: Smile,
    gradient: 'from-pink-100/80 via-rose-50/60 to-pink-100/80',
    accent: 'text-pink-700',
    steps: ['Phân tích ảnh', 'Chỉnh sửa theo ý tưởng', 'Biến tấu', 'Hoàn thiện'],
  },
  eraser: {
    icon: Eraser,
    gradient: 'from-teal-100/80 via-cyan-50/60 to-teal-100/80',
    accent: 'text-teal-700',
    steps: ['Phân tích vật thể', 'Xóa vật thể thừa', 'Bù đắp nền', 'Hoàn thiện'],
  },
  product: {
    icon: Package,
    gradient: 'from-amber-100/80 via-orange-50/60 to-amber-100/80',
    accent: 'text-amber-700',
    steps: ['Tách nền sản phẩm', 'Chọn bối cảnh', 'Đặt sản phẩm', 'Hoàn thiện'],
  },
  headshot: {
    icon: Briefcase,
    gradient: 'from-slate-100/80 via-gray-50/60 to-slate-100/80',
    accent: 'text-slate-700',
    steps: ['Phân tích ảnh selfie', 'Chỉnh trang phục', 'Điều chỉnh ánh sáng', 'Hoàn thiện'],
  },
  outpaint: {
    icon: Expand,
    gradient: 'from-indigo-100/80 via-blue-50/60 to-indigo-100/80',
    accent: 'text-indigo-700',
    steps: ['Phân tích ảnh gốc', 'Vẽ thêm khung hình', 'Hòa quyện nền', 'Hoàn thiện'],
  },
  faceswap: {
    icon: Repeat,
    gradient: 'from-fuchsia-100/80 via-purple-50/60 to-fuchsia-100/80',
    accent: 'text-fuchsia-700',
    steps: ['Phân tích khuôn mặt', 'Hoán đổi', 'Điều chỉnh tự nhiên', 'Hoàn thiện'],
  },
  mockup3d: {
    icon: Box,
    gradient: 'from-cyan-100/80 via-teal-50/60 to-cyan-100/80',
    accent: 'text-cyan-700',
    steps: ['Phân tích thiết kế', 'Đặt lên mockup 3D', 'Ánh sáng, phối cảnh', 'Hoàn thiện'],
  },
  model3d: {
    icon: BoxSelect,
    gradient: 'from-amber-100/80 via-orange-50/60 to-amber-100/80',
    accent: 'text-amber-700',
    steps: ['Phân tích ảnh 2D', 'Tạo geometry 3D', 'Render preview', 'Hoàn thiện'],
  },
  interior: {
    icon: Home,
    gradient: 'from-emerald-100/80 via-teal-50/60 to-emerald-100/80',
    accent: 'text-emerald-700',
    steps: ['Quét ảnh không gian', 'Phân tích đồ đạc', 'Xử lý theo yêu cầu', 'Hoàn thiện'],
  },
  story: {
    icon: BookOpen,
    gradient: 'from-rose-100/80 via-pink-50/60 to-rose-100/80',
    accent: 'text-rose-700',
    steps: ['Mở rộng ý tưởng thành câu chuyện', 'Phác thảo minh họa', 'Tạo ảnh kể chuyện', 'Hoàn thiện'],
  },
  sticker: {
    icon: Tag,
    gradient: 'from-teal-100/80 via-cyan-50/60 to-teal-100/80',
    accent: 'text-teal-700',
    steps: ['Mở rộng ý tưởng nhãn gián', 'Phác thảo thiết kế', 'Tạo ảnh nền trong suốt', 'Hoàn thiện'],
  },
}

export function ImageProcessingLoader({
  mode,
  title,
  description: _description,
  steps: customSteps,
  imagePreview,
  imagePreviews,
}: ImageProcessingLoaderProps) {
  const [uiLocale, setUiLocale] = useState<'vi' | 'en' | 'zh' | 'ja' | 'ko'>('vi')
  const config = modeConfig[mode]
  const Icon = config.icon
  const [elapsedSec, setElapsedSec] = useState(0)
  const tr = (vi: string, en: string, zh: string, ja: string, ko: string) => {
    if (uiLocale === 'en') return en
    if (uiLocale === 'zh') return zh
    if (uiLocale === 'ja') return ja
    if (uiLocale === 'ko') return ko
    return vi
  }

  useEffect(() => {
    const timer = window.setInterval(() => {
      setElapsedSec((prev) => prev + 1)
    }, 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const syncLocale = () => {
      const cookieValue = document.cookie
        .split(';')
        .map((x) => x.trim())
        .find((x) => x.startsWith('nanoai_locale='))
        ?.split('=')[1]
        ?.trim()
        .toLowerCase()
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
    tr('Hệ thống vẫn đang xử lý an toàn. Kết quả sẽ hiển thị ngay khi hoàn tất.', 'The system is processing safely. Results will appear once complete.', '系统正在安全处理中。完成后将立即显示结果。', 'システムは安全に処理中です。完了後すぐに結果を表示します。', '시스템이 안전하게 처리 중입니다. 완료되면 즉시 결과가 표시됩니다.'),
    tr('Chúng tôi đang tối ưu đầu ra để đảm bảo chất lượng tốt nhất cho ảnh của bạn.', 'We are optimizing output to ensure the best quality for your image.', '我们正在优化输出，以确保你的图片获得最佳质量。', '画像の品質を最大化するため、出力を最適化しています。', '최상의 이미지 품질을 위해 출력을 최적화하고 있습니다.'),
    tr('Yêu cầu vẫn đang được xử lý ổn định trên máy chủ. Vui lòng chờ thêm một chút.', 'Your request is being processed steadily on the server. Please wait a bit more.', '请求正在服务器上稳定处理中，请再稍等。', 'リクエストはサーバーで安定して処理中です。もう少しお待ちください。', '요청이 서버에서 안정적으로 처리 중입니다. 잠시만 더 기다려 주세요.'),
  ]
  const reminderCount = Math.floor(elapsedSec / 15)
  const reminderMessage = reminderCount > 0 ? reminderMessages[(reminderCount - 1) % reminderMessages.length] : null
  const statusMessages = [
    tr('Đang xử lý yêu cầu của bạn', 'Processing your request', '正在处理你的请求', 'リクエストを処理中', '요청을 처리 중입니다'),
    tr('Đang tối ưu chất lượng đầu ra', 'Optimizing output quality', '正在优化输出质量', '出力品質を最適化中', '출력 품질을 최적화 중입니다'),
    tr('Đang hoàn thiện kết quả', 'Finalizing result', '正在完成结果', '結果を仕上げ中', '결과를 마무리 중입니다'),
  ]
  const activeStatus = statusMessages[Math.floor(elapsedSec / 6) % statusMessages.length]
  const progressValue = Math.min(96, Math.max(8, Math.round((1 - Math.exp(-elapsedSec / 18)) * 100)))
  const subtitle = tr('Hệ thống đang xử lý tự động. Kết quả sẽ xuất hiện ngay khi sẵn sàng.', 'The system is processing automatically. Result will appear when ready.', '系统正在自动处理。结果准备好后将立即显示。', 'システムが自動処理中です。準備ができ次第結果を表示します。', '시스템이 자동 처리 중입니다. 준비되면 결과가 표시됩니다.')
  void _description
  void customSteps

  return (
    <div className="w-full max-w-lg mx-auto">
      <div className={`relative overflow-hidden rounded-xl border-2 border-white/80 shadow-lg bg-gradient-to-br ${config.gradient}`}>
        {/* Nền ảnh mờ (nếu có) */}
        {imagePreview && (
          <div className="absolute inset-0 opacity-20">
            <ImagePreview src={imagePreview} alt="" className="w-full h-full object-cover scale-110 blur-md" />
          </div>
        )}

        {/* Nhiều ảnh (ghép) */}
        {imagePreviews && imagePreviews.length > 0 && (
          <div className="absolute inset-0 flex items-center justify-center gap-2 p-4 opacity-30">
            {imagePreviews.slice(0, 4).map((src, i) => (
              <div key={i} className="w-16 h-16 rounded-lg overflow-hidden border-2 border-white/50 shadow">
                <ImagePreview src={src} alt="" className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        )}

        {/* Hiệu ứng shimmer nhẹ */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer-loader" />

        {/* Nội dung chính */}
        <div className="relative flex flex-col items-center justify-center py-12 px-6">
          <div className={`flex items-center justify-center w-20 h-20 rounded-2xl bg-white/90 shadow-md mb-6 ${config.accent}`}>
            <Icon className="w-10 h-10 animate-pulse-subtle" />
          </div>

          <h3 className="text-lg font-semibold text-foreground mb-1">{title}</h3>
          <p className="text-sm text-muted-foreground text-center mb-4">{subtitle}</p>

          <div className="w-full mb-4 rounded-lg border border-white/60 bg-white/75 px-4 py-3">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground/90">
              <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>{activeStatus}</span>
            </div>
            <div className="mt-3 h-2.5 w-full rounded-full bg-slate-200/90 overflow-hidden border border-white/80">
              <div
                className="relative h-full rounded-full bg-gradient-to-r from-teal-500 to-cyan-500 transition-[width] duration-1000 ease-out"
                style={{ width: `${progressValue}%` }}
              >
                <span className="absolute inset-y-0 -left-1/3 w-1/3 bg-white/50 blur-[1px] animate-shimmer-loader" />
              </div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-4">{tr('Thời gian xử lý thường từ vài giây đến khoảng 1 phút.', 'Processing usually takes from a few seconds to about 1 minute.', '处理时间通常为几秒到约1分钟。', '処理時間は通常、数秒〜約1分です。', '처리 시간은 보통 몇 초에서 약 1분입니다.')}</p>
          {reminderMessage && (
            <p className="text-xs text-foreground/80 mt-2 text-center rounded-md border border-white/60 bg-white/60 px-3 py-2">
              {reminderMessage}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
