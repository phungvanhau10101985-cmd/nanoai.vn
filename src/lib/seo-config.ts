import type { PageSEOConfig } from './seo'

/** Cấu hình SEO chuẩn 10 điểm cho tất cả trang */
export const SEO_PAGES: Record<string, PageSEOConfig> = {
  '/': {
    title: 'NanoAI - Sáng tạo không giới hạn cùng AI',
    description: 'Trải nghiệm phòng thử đồ ảo với AI. Thử đồ 1-5 người, phục dựng ảnh, làm nét ảnh, ghép ảnh. Nhanh chóng, chính xác.',
    path: '/',
    keywords: ['NanoAI', 'thử đồ online', 'thử đồ ảo', 'AI thử đồ', 'phối đồ', 'phục dựng ảnh', 'làm nét ảnh', 'ghép ảnh'],
  },
  '/auth/login': {
    title: 'Đăng nhập',
    description: 'Đăng nhập để sử dụng các tính năng AI: thử đồ, phục dựng ảnh, làm nét ảnh, ghép ảnh.',
    path: '/auth/login',
    keywords: ['đăng nhập', 'NanoAI'],
    noIndex: true,
  },
  '/auth/auth-code-error': {
    title: 'Lỗi xác thực',
    description: 'Đã xảy ra lỗi khi xác thực đăng nhập.',
    path: '/auth/auth-code-error',
    noIndex: true,
  },
  '/dashboard': {
    title: 'Bảng điều khiển',
    description: 'Quản lý tài khoản, xem lịch sử và credits.',
    path: '/dashboard',
    noIndex: true,
  },
  '/dashboard/history': {
    title: 'Lịch sử',
    description: 'Xem lịch sử thử đồ và xử lý ảnh.',
    path: '/dashboard/history',
    noIndex: true,
  },
  '/dashboard/history/translate': {
    title: 'Lịch sử dịch ảnh',
    description: 'Xem lịch sử dịch ảnh tài liệu.',
    path: '/dashboard/history/translate',
    noIndex: true,
  },
  '/dashboard/deposit': {
    title: 'Nạp credits',
    description: 'Nạp credits để sử dụng các tính năng AI.',
    path: '/dashboard/deposit',
    noIndex: true,
  },
  '/dashboard/transactions': {
    title: 'Giao dịch',
    description: 'Lịch sử giao dịch nạp credits.',
    path: '/dashboard/transactions',
    noIndex: true,
  },
  '/dashboard/wallet': {
    title: 'Ví',
    description: 'Quản lý ví và số dư credits.',
    path: '/dashboard/wallet',
    noIndex: true,
  },
  '/wallet': {
    title: 'Ví',
    description: 'Quản lý ví và số dư credits.',
    path: '/wallet',
    noIndex: true,
  },
  '/admin/users': {
    title: 'Quản trị người dùng',
    description: 'Quản lý người dùng hệ thống.',
    path: '/admin/users',
    noIndex: true,
  },
  '/admin/api-stats': {
    title: 'Thống kê API',
    description: 'Thống kê sử dụng API AI.',
    path: '/admin/api-stats',
    noIndex: true,
  },
  '/admin/credit-deposit-stats': {
    title: 'Thống kê nạp credit',
    description: 'Lịch sử và tổng hợp giao dịch nạp credit.',
    path: '/admin/credit-deposit-stats',
    noIndex: true,
  },
  '/test': {
    title: 'Trang test',
    description: 'Trang kiểm thử.',
    path: '/test',
    noIndex: true,
  },
  '/dich-anh-tai-lieu/tien-trinh': {
    title: 'Tiến trình dịch ảnh',
    description: 'Theo dõi tiến trình dịch ảnh tài liệu hàng loạt.',
    path: '/dich-anh-tai-lieu/tien-trinh',
    keywords: ['tiến trình dịch', 'dịch ảnh hàng loạt'],
    noIndex: true,
  },
}
