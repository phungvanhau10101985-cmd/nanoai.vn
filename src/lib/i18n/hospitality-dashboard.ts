import type { WebLocale } from '@/lib/i18n/config'

export type HospitalityDashboardDict = {
  pageTitle: string
  pageDescription: string
  backToMessaging: string
  settingsLink: string
  createChannel: string
  emptyTitle: string
  emptyDescription: string
  emptyCta: string
  partnersHeading: string
  partnersSubheading: string
  statBookings: string
  statConfirmed: string
  statRevenue: string
  statPendingHolds: string
  statsLoading: string
  statsError: string
  cardOpenSettings: string
  cardOpenGuestChat: string
  cardSlugLabel: string
  createdAt: string
  statusActive: string
  statusPurging: string
  lastDaysLabel: string
}

const vi: HospitalityDashboardDict = {
  pageTitle: 'Tổng quan khách sạn',
  pageDescription: 'Quản lý phòng, đặt phòng và thanh toán — tách biệt hoàn toàn với luồng thời trang.',
  backToMessaging: 'Dashboard thời trang',
  settingsLink: 'Cài đặt khách sạn',
  createChannel: '+ Tạo khách sạn mới',
  emptyTitle: 'Chưa có workspace khách sạn',
  emptyDescription:
    'Tạo một workspace kiểu «Nhà nghỉ / khách sạn» để bắt đầu quản lý loại phòng, phòng thực tế, đặt phòng và trợ lý AI cho khách.',
  emptyCta: 'Tạo khách sạn đầu tiên',
  partnersHeading: 'Workspace khách sạn của bạn',
  partnersSubheading: 'Mỗi workspace là một cơ sở lưu trú độc lập.',
  statBookings: 'Đặt phòng',
  statConfirmed: 'Đã xác nhận',
  statRevenue: 'Doanh thu',
  statPendingHolds: 'Hold đang giữ',
  statsLoading: 'Đang tải số liệu...',
  statsError: 'Không tải được số liệu.',
  cardOpenSettings: 'Mở cài đặt',
  cardOpenGuestChat: 'Xem trang chat khách',
  cardSlugLabel: 'Slug',
  createdAt: 'Tạo lúc',
  statusActive: 'Đang hoạt động',
  statusPurging: 'Chờ xóa',
  lastDaysLabel: '30 ngày qua',
}

const en: HospitalityDashboardDict = {
  pageTitle: 'Hospitality overview',
  pageDescription: 'Manage rooms, bookings and payments — fully isolated from the fashion workflow.',
  backToMessaging: 'Fashion dashboard',
  settingsLink: 'Hotel settings',
  createChannel: '+ New hotel',
  emptyTitle: 'No hotel workspace yet',
  emptyDescription:
    'Create a «Hotel / guesthouse» workspace to start managing room types, rooms, bookings and the guest AI assistant.',
  emptyCta: 'Create your first hotel',
  partnersHeading: 'Your hotel workspaces',
  partnersSubheading: 'Each workspace is an independent property.',
  statBookings: 'Bookings',
  statConfirmed: 'Confirmed',
  statRevenue: 'Revenue',
  statPendingHolds: 'Active holds',
  statsLoading: 'Loading stats...',
  statsError: 'Could not load stats.',
  cardOpenSettings: 'Open settings',
  cardOpenGuestChat: 'Open guest chat',
  cardSlugLabel: 'Slug',
  createdAt: 'Created',
  statusActive: 'Active',
  statusPurging: 'Purging',
  lastDaysLabel: 'Last 30 days',
}

const zh: HospitalityDashboardDict = {
  pageTitle: '酒店总览',
  pageDescription: '管理房间、预订和付款 — 与时尚工作流完全隔离。',
  backToMessaging: '时尚控制台',
  settingsLink: '酒店设置',
  createChannel: '+ 新建酒店',
  emptyTitle: '尚未创建酒店工作区',
  emptyDescription: '创建一个「酒店 / 民宿」工作区以管理房型、房间、预订和客人 AI 助手。',
  emptyCta: '创建第一家酒店',
  partnersHeading: '您的酒店工作区',
  partnersSubheading: '每个工作区是一家独立的物业。',
  statBookings: '预订',
  statConfirmed: '已确认',
  statRevenue: '收入',
  statPendingHolds: '保留中',
  statsLoading: '正在加载...',
  statsError: '无法加载统计数据。',
  cardOpenSettings: '打开设置',
  cardOpenGuestChat: '查看客人聊天',
  cardSlugLabel: '标识符',
  createdAt: '创建时间',
  statusActive: '活跃',
  statusPurging: '待清除',
  lastDaysLabel: '最近 30 天',
}

const ja: HospitalityDashboardDict = {
  pageTitle: 'ホスピタリティ概要',
  pageDescription: '客室・予約・決済を管理 — ファッション動線から完全に分離。',
  backToMessaging: 'ファッションダッシュボード',
  settingsLink: 'ホテル設定',
  createChannel: '+ 新規ホテル',
  emptyTitle: 'ホテルワークスペース未作成',
  emptyDescription:
    '「ホテル / ゲストハウス」ワークスペースを作成し、部屋タイプ・部屋・予約・ゲスト AI アシスタントを管理しましょう。',
  emptyCta: '最初のホテルを作成',
  partnersHeading: 'あなたのホテルワークスペース',
  partnersSubheading: '各ワークスペースは独立した宿泊施設です。',
  statBookings: '予約数',
  statConfirmed: '確定',
  statRevenue: '売上',
  statPendingHolds: '保留中',
  statsLoading: '統計を読み込み中...',
  statsError: '統計を読み込めませんでした。',
  cardOpenSettings: '設定を開く',
  cardOpenGuestChat: 'ゲストチャット',
  cardSlugLabel: 'スラグ',
  createdAt: '作成日',
  statusActive: '稼働中',
  statusPurging: '削除予定',
  lastDaysLabel: '過去 30 日間',
}

const ko: HospitalityDashboardDict = {
  pageTitle: '호스피탈리티 개요',
  pageDescription: '객실, 예약, 결제 관리 — 패션 워크플로와 완전히 분리됨.',
  backToMessaging: '패션 대시보드',
  settingsLink: '호텔 설정',
  createChannel: '+ 호텔 새로 만들기',
  emptyTitle: '호텔 워크스페이스가 없습니다',
  emptyDescription:
    '「호텔 / 게스트하우스」 워크스페이스를 만들어 객실 유형, 객실, 예약 및 게스트 AI 도우미를 관리하세요.',
  emptyCta: '첫 호텔 만들기',
  partnersHeading: '나의 호텔 워크스페이스',
  partnersSubheading: '각 워크스페이스는 독립된 숙소입니다.',
  statBookings: '예약',
  statConfirmed: '확정',
  statRevenue: '매출',
  statPendingHolds: '진행 중 홀드',
  statsLoading: '통계 로딩 중...',
  statsError: '통계를 불러올 수 없습니다.',
  cardOpenSettings: '설정 열기',
  cardOpenGuestChat: '게스트 채팅 보기',
  cardSlugLabel: '슬러그',
  createdAt: '생성일',
  statusActive: '활성',
  statusPurging: '삭제 예정',
  lastDaysLabel: '최근 30 일',
}

const MAP: Record<WebLocale, HospitalityDashboardDict> = { vi, en, zh, ja, ko }

export function getHospitalityDashboardDictionary(locale: WebLocale): HospitalityDashboardDict {
  return MAP[locale] ?? vi
}
