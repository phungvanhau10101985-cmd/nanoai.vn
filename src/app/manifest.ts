import type { MetadataRoute } from 'next'

const shortcutIcon = [
  {
    src: '/icons/icon-192x192.png',
    sizes: '192x192',
    type: 'image/png' as const,
    purpose: 'any' as const,
  },
]

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'NanoAI - Sáng tạo không giới hạn cùng AI',
    short_name: 'NanoAI',
    description: 'Trải nghiệm phòng thử đồ ảo với AI. Thử đồ 1-5 người, phục dựng ảnh, làm nét ảnh, ghép ảnh.',
    start_url: '/',
    id: '/',
    scope: '/',
    display: 'standalone',
    /** Cho phép xoay ngang các công cụ cần landscape; vẫn mở fullscreen kiểu app. */
    display_override: ['standalone', 'minimal-ui', 'browser'],
    orientation: 'any',
    background_color: '#ffffff',
    theme_color: '#0a0a0a',
    categories: ['lifestyle', 'shopping', 'utilities'],
    lang: 'vi',
    dir: 'ltr',
    prefer_related_applications: false,
    shortcuts: [
      {
        name: 'Thử đồ AI',
        short_name: 'Thử đồ',
        description: 'Phòng thử đồ ảo',
        url: '/thu-do-online',
        icons: shortcutIcon,
      },
      {
        name: 'Tạo ảnh từ chữ',
        short_name: 'Ảnh từ chữ',
        url: '/tao-anh-tu-chu',
        icons: shortcutIcon,
      },
      {
        name: 'Học ngoại ngữ AI',
        short_name: 'Ngoại ngữ',
        url: '/hoc-tieng-anh-ai',
        icons: shortcutIcon,
      },
      {
        name: 'Giáo trình & lớp',
        short_name: 'Giáo trình',
        url: '/giao-trinh',
        icons: shortcutIcon,
      },
    ],
    icons: [
      {
        src: '/icons/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/apple-touch-icon.png',
        sizes: '180x180',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  }
}
