'use client'

import { useEffect, useMemo, useState } from 'react'
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
  description,
  steps: customSteps,
  imagePreview,
  imagePreviews,
}: ImageProcessingLoaderProps) {
  const config = modeConfig[mode]
  const Icon = config.icon
  const steps = (customSteps && customSteps.length > 0 ? customSteps : config.steps)
  const stepDurationSec = 6
  const [elapsedSec, setElapsedSec] = useState(0)

  useEffect(() => {
    const timer = window.setInterval(() => {
      setElapsedSec((prev) => prev + 1)
    }, 1000)
    return () => window.clearInterval(timer)
  }, [])

  const totalStepTime = steps.length * stepDurationSec
  const activeStepIndex = Math.min(steps.length - 1, Math.floor(elapsedSec / stepDurationSec))
  const activeStepProgress = useMemo(() => {
    if (elapsedSec >= totalStepTime) return 100
    return Math.min(100, ((elapsedSec % stepDurationSec) / stepDurationSec) * 100)
  }, [elapsedSec, stepDurationSec, totalStepTime])

  const reminderMessages = [
    'Hệ thống vẫn đang xử lý. Vui lòng chờ thêm một chút để nhận kết quả tốt nhất.',
    'Ảnh đang được tối ưu chi tiết, nên có thể mất thêm thời gian. Cảm ơn bạn đã kiên nhẫn.',
    'Yêu cầu vẫn đang chạy ổn định trên máy chủ. Kết quả sẽ trả về ngay khi hoàn tất.',
  ]
  const reminderCount = Math.floor(elapsedSec / 15)
  const reminderMessage = reminderCount > 0 ? reminderMessages[(reminderCount - 1) % reminderMessages.length] : null
  const progressValue = Math.min(95, Math.max(6, Math.round((elapsedSec / Math.max(20, totalStepTime)) * 95)))

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
          <p className="text-sm text-muted-foreground text-center mb-6">{description}</p>
          <div className="w-full mb-4">
            <div className="flex items-center justify-between text-[11px] text-foreground/80 mb-1">
              <span>Tiến trình xử lý</span>
              <span>{progressValue}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-white/50 overflow-hidden border border-white/60">
              <div
                className="h-full rounded-full bg-white/90 transition-[width] duration-1000 ease-out"
                style={{ width: `${progressValue}%` }}
              />
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              Tiến trình chỉ đạt 100% khi hệ thống trả ảnh hoàn tất.
            </p>
          </div>
          <div className="mb-4 rounded-md border border-white/60 bg-white/70 px-3 py-2 text-center text-xs text-foreground/90">
            Đang thực hiện bước {activeStepIndex + 1}/{steps.length}: {steps[activeStepIndex]}
          </div>

          {/* Các bước xử lý */}
          <div className="w-full space-y-2">
            {steps.map((step, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-white/80 flex items-center justify-center text-xs font-medium text-foreground">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0 h-2 rounded-full bg-white/40 overflow-hidden">
                  <div
                    className="block h-full rounded-full bg-white/80 transition-[width] duration-700 ease-out"
                    style={{
                      width:
                        i < activeStepIndex
                          ? '100%'
                          : i === activeStepIndex
                            ? `${activeStepProgress}%`
                            : '0%',
                    }}
                  />
                </div>
                <span className="text-xs font-medium text-foreground/90 w-28 text-right">{step}</span>
              </div>
            ))}
          </div>

          <p className="text-xs text-muted-foreground mt-6">Thường mất 15–45 giây</p>
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
