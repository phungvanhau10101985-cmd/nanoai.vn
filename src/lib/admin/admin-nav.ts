import type { LucideIcon } from 'lucide-react'
import {
  Users,
  BarChart3,
  BookOpen,
  FileEdit,
  Flag,
  Download,
  ClipboardCheck,
  ShieldCheck,
  Landmark,
  Wallet,
  MessageCircle,
  Code2,
  Globe,
  KeyRound,
  Table2,
  LayoutDashboard,
} from 'lucide-react'
import type { WebLocale } from '@/lib/i18n/config'

export type AdminNavLabel = Record<'vi' | 'en' | 'zh' | 'ja' | 'ko', string>

export type AdminNavItem = {
  href: string
  title: AdminNavLabel
  description: AdminNavLabel
  icon: LucideIcon
  /** Prefix match for nested routes (e.g. /admin/api-stats/*). */
  matchPrefix?: boolean
}

export type AdminNavGroup = {
  id: string
  title: AdminNavLabel
  items: AdminNavItem[]
}

export const ADMIN_OVERVIEW_HREF = '/admin'

export const ADMIN_OVERVIEW_TITLE: AdminNavLabel = {
  vi: 'Tổng quan',
  en: 'Overview',
  zh: '概览',
  ja: '概要',
  ko: '개요',
}

export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    id: 'platform',
    title: {
      vi: 'Hệ thống',
      en: 'Platform',
      zh: '系统',
      ja: 'システム',
      ko: '시스템',
    },
    items: [
      {
        href: '/admin/payment-config',
        title: {
          vi: 'Cấu hình nạp tiền',
          en: 'Top-up payment',
          zh: '充值设置',
          ja: '入金設定',
          ko: '충전 설정',
        },
        description: {
          vi: 'Số tài khoản ngân hàng, mã NH, QR SePay — dùng khi người dùng nạp Credits.',
          en: 'Bank account, bank code, SePay QR — used when users top up credits.',
          zh: '银行账户、银行代码、SePay 二维码 — 用户充值积分时使用。',
          ja: '銀行口座・銀行コード・SePay QR — クレジットチャージ時に使用。',
          ko: '은행 계좌, 은행 코드, SePay QR — 크레딧 충전 시 사용.',
        },
        icon: Landmark,
      },
      {
        href: '/admin/credit-deposit-stats',
        title: {
          vi: 'Thống kê nạp credit',
          en: 'Credit top-ups',
          zh: '充值统计',
          ja: 'チャージ統計',
          ko: '충전 통계',
        },
        description: {
          vi: 'Lịch sử và tổng hợp khách nạp tiền — giao dịch đã hoàn thành (SePay / QR).',
          en: 'History and aggregates for completed credit top-ups (SePay / QR).',
          zh: '已完成充值的明细与汇总（SePay / 二维码）。',
          ja: '完了済みチャージの履歴・集計（SePay / QR）。',
          ko: '완료된 크레딧 충전 내역·집계(SePay / QR).',
        },
        icon: Wallet,
      },
      {
        href: '/admin/customer-care',
        title: {
          vi: 'Chăm sóc khách hàng',
          en: 'Customer care',
          zh: '客户关怀',
          ja: 'カスタマーケア',
          ko: '고객 케어',
        },
        description: {
          vi: 'Facebook Messenger, Zalo OA và chat nội bộ NanoAI trong một hộp thư.',
          en: 'Facebook Messenger, Zalo OA, and in-app chat in one inbox.',
          zh: 'Facebook Messenger、Zalo OA 与应用内聊天统一收件箱。',
          ja: 'Facebook Messenger、Zalo OA、アプリ内チャットを一元管理。',
          ko: 'Facebook Messenger, Zalo OA, 앱 내 채팅을 하나의 수신함에서.',
        },
        icon: MessageCircle,
      },
      {
        href: '/admin/api-keys',
        title: {
          vi: 'Khóa API hệ thống',
          en: 'Platform API keys',
          zh: '平台 API 密钥',
          ja: 'API キー',
          ko: '플랫폼 API 키',
        },
        description: {
          vi: 'Cron, .env, webhook inbox NanoAI.',
          en: 'Cron, .env, NanoAI inbox webhooks.',
          zh: 'Cron、.env、NanoAI 收件箱 Webhook。',
          ja: 'cron、.env、NanoAI 受信箱 Webhook。',
          ko: 'cron, .env, NanoAI 수신함 Webhook.',
        },
        icon: KeyRound,
      },
      {
        href: '/admin/integrations',
        title: {
          vi: 'Thẻ & mã nhúng',
          en: 'Tags & embeds',
          zh: '标签与嵌入',
          ja: 'タグ・埋め込み',
          ko: '태그·임베드',
        },
        description: {
          vi: 'Google tag, Meta Pixel và mã nhúng chat.',
          en: 'Google tags, Meta Pixel, and chat embed snippets.',
          zh: 'Google 标签、Meta Pixel 与聊天嵌入代码。',
          ja: 'Google タグ、Meta Pixel、チャット埋め込み。',
          ko: 'Google 태그, Meta Pixel, 채팅 임베드.',
        },
        icon: Code2,
      },
      {
        href: '/admin/partner-website-templates',
        title: {
          vi: 'Landing template',
          en: 'Landing templates',
          zh: '落地页模板',
          ja: 'LPテンプレート',
          ko: '랜딩 템플릿',
        },
        description: {
          vi: 'Bật/tắt block giao diện khách dùng — backend chat do platform.',
          en: 'Enable UI blocks for tenants — chat backend is platform-owned.',
          zh: '启用租户 UI 区块 — 聊天后端归平台。',
          ja: 'テナント向けUIブロック — チャットはプラットフォーム。',
          ko: '테넌트 UI 블록 — 채팅 백엔드는 플랫폼.',
        },
        icon: Globe,
      },
    ],
  },
  {
    id: 'members',
    title: {
      vi: 'Thành viên',
      en: 'Members',
      zh: '成员',
      ja: 'メンバー',
      ko: '회원',
    },
    items: [
      {
        href: '/admin/users',
        title: {
          vi: 'Quản lý thành viên',
          en: 'User management',
          zh: '成员管理',
          ja: 'ユーザー管理',
          ko: '회원 관리',
        },
        description: {
          vi: 'Xem danh sách thành viên, chỉnh sửa tín dụng.',
          en: 'View members and update credit balances.',
          zh: '查看成员列表并调整积分余额。',
          ja: 'ユーザー一覧の確認とクレジット調整。',
          ko: '회원 목록 확인 및 크레딧 조정.',
        },
        icon: Users,
      },
      {
        href: '/admin/customer-api-keys',
        title: {
          vi: 'API key riêng (BYOK)',
          en: 'BYOK members',
          zh: '自带密钥成员',
          ja: 'BYOK 利用者',
          ko: 'BYOK 사용자',
        },
        description: {
          vi: 'Theo dõi khách đã lưu Gemini API key riêng.',
          en: 'Track customers who saved Gemini API keys.',
          zh: '跟踪已保存 Gemini API 密钥的客户。',
          ja: 'Gemini API キーを保存した顧客を確認。',
          ko: 'Gemini API 키를 저장한 고객 확인.',
        },
        icon: KeyRound,
      },
    ],
  },
  {
    id: 'education',
    title: {
      vi: 'Giáo dục',
      en: 'Education',
      zh: '教育',
      ja: '教育',
      ko: '교육',
    },
    items: [
      {
        href: '/admin/english-coach',
        title: {
          vi: 'Học ngoại ngữ AI',
          en: 'Language coach',
          zh: '语言教练',
          ja: '言語コーチ',
          ko: '언어 코치',
        },
        description: {
          vi: 'Chuẩn hóa từ vựng và bài học đã lưu.',
          en: 'Vocabulary normalization and saved lessons.',
          zh: '词汇标准化与已保存课程。',
          ja: '語彙の正規化と保存済みレッスン。',
          ko: '어휘 정규화 및 저장된 레슨.',
        },
        icon: BookOpen,
      },
      {
        href: '/admin/slide-proposals',
        title: {
          vi: 'Đề xuất sửa slide',
          en: 'Slide proposals',
          zh: '幻灯片建议',
          ja: 'スライド提案',
          ko: '슬라이드 제안',
        },
        description: {
          vi: 'Danh sách đề xuất sửa/bổ sung slide từ giáo viên.',
          en: 'Slide edit proposals from teachers.',
          zh: '教师提交的幻灯片编辑建议。',
          ja: '教師からのスライド編集提案。',
          ko: '교사 제출 슬라이드 편집 제안.',
        },
        icon: FileEdit,
      },
      {
        href: '/admin/curriculum-edit-reviews',
        title: {
          vi: 'Duyệt giáo trình',
          en: 'Curriculum reviews',
          zh: '教材审核',
          ja: '教材審査',
          ko: '교육과정 검토',
        },
        description: {
          vi: 'Giáo viên gửi khi 2 AI báo sai nhưng vẫn muốn lưu.',
          en: 'Teachers submit when 2 AIs flag errors.',
          zh: '教师在2个AI报错时提交。',
          ja: '2つのAIがエラーと判断した場合に教師が送信。',
          ko: '2개 AI가 오류로 표시할 때 교사가 제출.',
        },
        icon: ClipboardCheck,
      },
      {
        href: '/admin/quiz-reports',
        title: {
          vi: 'Báo cáo câu hỏi sai',
          en: 'Quiz reports',
          zh: '题目报告',
          ja: '問題報告',
          ko: '문제 신고',
        },
        description: {
          vi: 'Giáo viên báo câu hỏi trắc nghiệm sai.',
          en: 'Teachers report wrong quiz questions.',
          zh: '教师报告题目错误。',
          ja: '教師が問題の誤りを報告。',
          ko: '교사가 문제 오류 신고.',
        },
        icon: Flag,
      },
      {
        href: '/admin/worksheet-verify-reports',
        title: {
          vi: 'Verify phiếu bài tập',
          en: 'Worksheet verify',
          zh: '作业单核验',
          ja: 'WS検証',
          ko: '워크시트 검증',
        },
        description: {
          vi: 'Quét DB, chạy verify câu chưa đóng dấu.',
          en: 'Scan DB and verify unverified questions.',
          zh: '扫描数据库并核验未标记题目。',
          ja: 'DBを走査し未検証の設問を検証。',
          ko: 'DB를 검사해 미검증 문항 검증.',
        },
        icon: ShieldCheck,
      },
    ],
  },
  {
    id: 'data',
    title: {
      vi: 'Dữ liệu',
      en: 'Data',
      zh: '数据',
      ja: 'データ',
      ko: '데이터',
    },
    items: [
      {
        href: '/admin/api-stats',
        title: {
          vi: 'Thống kê API',
          en: 'API analytics',
          zh: 'API 统计',
          ja: 'API 分析',
          ko: 'API 통계',
        },
        description: {
          vi: 'Xem chi phí và log sử dụng API.',
          en: 'Track API cost and usage logs.',
          zh: '查看 API 成本与调用日志。',
          ja: 'API コストと利用ログを確認。',
          ko: 'API 비용 및 사용 로그를 확인.',
        },
        icon: BarChart3,
        matchPrefix: true,
      },
      {
        href: '/admin/export-data',
        title: {
          vi: 'Xuất dữ liệu',
          en: 'Export data',
          zh: '导出数据',
          ja: 'データ出力',
          ko: '데이터 내보내기',
        },
        description: {
          vi: 'Chọn bảng, format JSON/Excel.',
          en: 'Select tables, JSON/Excel format.',
          zh: '选择表，JSON/Excel 格式。',
          ja: 'テーブル選択、JSON/Excel形式。',
          ko: '테이블 선택, JSON/Excel 형식.',
        },
        icon: Download,
      },
      {
        href: '/admin/db-tables',
        title: {
          vi: 'Duyệt mọi bảng',
          en: 'Browse tables',
          zh: '浏览表',
          ja: 'テーブル参照',
          ko: '테이블 보기',
        },
        description: {
          vi: 'Xem danh sách và nội dung phân trang (chỉ đọc).',
          en: 'List and paginate rows (read-only).',
          zh: '列出并分页查看（只读）。',
          ja: '一覧とページ表示（読み取り専用）。',
          ko: '목록 및 페이지 조회(읽기 전용).',
        },
        icon: Table2,
      },
    ],
  },
]

export const ADMIN_OVERVIEW_ICON = LayoutDashboard

export function adminNavLabel(labels: AdminNavLabel, locale: WebLocale | string): string {
  const key = locale as keyof AdminNavLabel
  return labels[key] || labels.vi
}

export function flattenAdminNavItems(): AdminNavItem[] {
  return ADMIN_NAV_GROUPS.flatMap((g) => g.items)
}

export function isAdminNavItemActive(pathname: string, item: AdminNavItem): boolean {
  const path = pathname.split('?')[0] || ''
  if (item.matchPrefix) {
    return path === item.href || path.startsWith(`${item.href}/`)
  }
  return path === item.href
}

export function findActiveAdminNavItem(pathname: string): AdminNavItem | null {
  const items = flattenAdminNavItems()
  const exact = items.find((item) => (pathname.split('?')[0] || '') === item.href)
  if (exact) return exact
  return items.find((item) => isAdminNavItemActive(pathname, item)) ?? null
}
