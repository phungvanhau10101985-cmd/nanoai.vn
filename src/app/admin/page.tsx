import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
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
  KeyRound,
  Table2,
} from 'lucide-react'
import { getCurrentWebLocale } from '@/lib/i18n/server'

type AdminLink = {
  href: string
  title: Record<string, string>
  description: Record<string, string>
  icon: React.ComponentType<{ className?: string }>
}

const ADMIN_LINKS: AdminLink[] = [
  {
    href: '/admin/payment-config',
    title: {
      vi: 'Cấu hình nạp tiền',
      en: 'Top-up payment settings',
      zh: '充值收款设置',
      ja: '入金・支払い設定',
      ko: '충전 결제 설정',
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
      en: 'Credit top-up statistics',
      zh: '充值积分统计',
      ja: 'クレジットチャージ統計',
      ko: '크레딧 충전 통계',
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
      en: 'Customer care inbox',
      zh: '客户关怀收件箱',
      ja: 'カスタマーケア受信箱',
      ko: '고객 케어 수신함',
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
      vi: 'Khóa API — vận hành hệ thống',
      en: 'API keys — platform operations',
      zh: 'API 密钥 — 平台运维',
      ja: 'API キー — プラットフォーム運用',
      ko: 'API 키 — 플랫폼 운영',
    },
    description: {
      vi: 'Cron, .env, webhook inbox NanoAI. Đối tác tích hợp web: Bảng điều khiển → Hướng dẫn tích hợp API.',
      en: 'Cron, .env, NanoAI inbox webhooks. Shop developers: Dashboard → API integration guide.',
      zh: 'Cron、.env、NanoAI 收件箱 Webhook。店铺开发：控制台 → API 集成说明。',
      ja: 'cron、.env、NanoAI 受信箱 Webhook。店舗向けはダッシュボード → API 連携ガイド。',
      ko: 'cron, .env, NanoAI 수신함 Webhook. 매장 개발: 대시보드 → API 연동 안내.',
    },
    icon: KeyRound,
  },
  {
    href: '/admin/integrations',
    title: {
      vi: 'Thẻ & mã nhúng',
      en: 'Tags & embed codes',
      zh: '标签与嵌入代码',
      ja: 'タグ・埋め込みコード',
      ko: '태그·임베드 코드',
    },
    description: {
      vi: 'Google tag, Meta Pixel và mã nhúng chat (NanoAI/Facebook/Zalo). Khóa API xem mục “Khóa API”.',
      en: 'Google tags, Meta Pixel, and chat embed snippets (NanoAI/Facebook/Zalo). API keys: see “API keys & integration”.',
      zh: 'Google 标签、Meta Pixel 与聊天嵌入代码。API 密钥见「API 密钥」页。',
      ja: 'Google タグ、Meta Pixel、チャット埋め込み。API キーは「API キー」ページへ。',
      ko: 'Google 태그, Meta Pixel, 채팅 임베드. API 키는 「API 키」 페이지.',
    },
    icon: Code2,
  },
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
      vi: 'Thành viên dùng API key riêng',
      en: 'BYOK API key members',
      zh: '自带 API 密钥成员',
      ja: 'BYOK API キー利用者',
      ko: 'BYOK API 키 사용자',
    },
    description: {
      vi: 'Theo dõi khách đã lưu Gemini API key riêng, trạng thái key và lỗi kiểm tra gần nhất.',
      en: 'Track customers who saved Gemini API keys, key status, and latest validation errors.',
      zh: '跟踪已保存 Gemini API 密钥的客户、密钥状态和最近验证错误。',
      ja: 'Gemini API キーを保存した顧客、状態、直近の検証エラーを確認。',
      ko: 'Gemini API 키를 저장한 고객, 키 상태, 최근 검증 오류를 확인.',
    },
    icon: KeyRound,
  },
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
  },
  {
    href: '/admin/english-coach',
    title: {
      vi: 'Chuẩn hóa từ vựng',
      en: 'Vocabulary normalization',
      zh: '词汇标准化',
      ja: '語彙の正規化',
      ko: '어휘 정규화',
    },
    description: {
      vi: 'Chạy fix word examples cho Học tiếng Anh AI.',
      en: 'Run word-example fixes for English Coach AI.',
      zh: '为英语教练运行例句修复。',
      ja: '英語コーチ向けに例文修正を実行。',
      ko: '영어 코치용 예문 보정 실행.',
    },
    icon: BookOpen,
  },
  {
    href: '/admin/slide-proposals',
    title: {
      vi: 'Đề xuất sửa slide',
      en: 'Slide edit proposals',
      zh: '幻灯片编辑建议',
      ja: 'スライド編集提案',
      ko: '슬라이드 편집 제안',
    },
    description: {
      vi: 'Danh sách đề xuất sửa/bổ sung slide từ giáo viên. 5 người đồng ý tự áp dụng.',
      en: 'List of slide edit proposals from teachers. Auto-apply when 5 agree.',
      zh: '教师提交的幻灯片编辑建议列表。5人同意自动应用。',
      ja: '教師からのスライド編集提案一覧。5人賛成で自動適用。',
      ko: '교사 제출 슬라이드 편집 제안 목록. 5명 찬성 시 자동 적용.',
    },
    icon: FileEdit,
  },
  {
    href: '/admin/curriculum-edit-reviews',
    title: {
      vi: 'Duyệt giáo trình gửi admin',
      en: 'Curriculum edit reviews',
      zh: '教材编辑审核',
      ja: '教材編集の審査',
      ko: '교육과정 편집 검토',
    },
    description: {
      vi: 'Giáo viên gửi khi 2 AI báo sai nhưng vẫn muốn lưu. Admin duyệt/từ chối.',
      en: 'Teachers submit when 2 AIs flag errors. Admin approves or rejects.',
      zh: '教师在2个AI报错时提交。管理员批准或拒绝。',
      ja: '2つのAIがエラーと判断した場合に教師が送信。管理者が承認または却下。',
      ko: '2개 AI가 오류로 표시할 때 교사가 제출. 관리자가 승인 또는 거부.',
    },
    icon: ClipboardCheck,
  },
  {
    href: '/admin/quiz-reports',
    title: {
      vi: 'Báo cáo câu hỏi sai',
      en: 'Quiz question reports',
      zh: '题目错误报告',
      ja: '問題の誤り報告',
      ko: '문제 오류 신고',
    },
    description: {
      vi: 'Giáo viên báo câu hỏi trắc nghiệm sai. Sau 3 lần báo chuyển admin duyệt.',
      en: 'Teachers report wrong quiz questions. After 3 reports, admin reviews.',
      zh: '教师报告题目错误。3次后转管理员审核。',
      ja: '教師が問題の誤りを報告。3回後、管理者が確認。',
      ko: '교사가 문제 오류 신고. 3회 후 관리자 검토.',
    },
    icon: Flag,
  },
  {
    href: '/admin/worksheet-verify-reports',
    title: {
      vi: 'Chất lượng verify phiếu bài tập',
      en: 'Worksheet verify quality',
      zh: '作业单核验质量',
      ja: 'ワークシート検証品質',
      ko: '워크시트 검증 품질',
    },
    description: {
      vi: 'Quét DB, chạy verify câu chưa đóng dấu; báo cáo từng lượt cho admin.',
      en: 'Scan DB and verify unverified questions; per-batch reports for admins.',
      zh: '扫描数据库并核验未标记题目；按批向管理员报告。',
      ja: 'DBを走査し未検証の設問を検証。管理者向けにバッチごとに報告。',
      ko: 'DB를 검사해 미검증 문항 검증. 관리자에게 배치별 보고.',
    },
    icon: ShieldCheck,
  },
  {
    href: '/admin/export-data',
    title: {
      vi: 'Xuất dữ liệu',
      en: 'Export data',
      zh: '导出数据',
      ja: 'データをエクスポート',
      ko: '데이터 내보내기',
    },
    description: {
      vi: 'Chọn bảng, format JSON/Excel. Xuất theo từng bảng.',
      en: 'Select tables, JSON/Excel format. Export by table.',
      zh: '选择表，JSON/Excel 格式。按表导出。',
      ja: 'テーブル選択、JSON/Excel形式。テーブルごとにエクスポート。',
      ko: '테이블 선택, JSON/Excel 형식. 테이블별 내보내기.',
    },
    icon: Download,
  },
  {
    href: '/admin/db-tables',
    title: {
      vi: 'Duyệt mọi bảng',
      en: 'Browse all tables',
      zh: '浏览所有表',
      ja: '全テーブル参照',
      ko: '모든 테이블 보기',
    },
    description: {
      vi: 'Xem danh sách và nội dung phân trang (public + auth). Chỉ đọc.',
      en: 'List and paginate rows (public + auth). Read-only.',
      zh: '列出并分页查看（public + auth）。只读。',
      ja: '一覧とページ表示（public + auth）。読み取り専用。',
      ko: '목록 및 페이지 조회(public + auth). 읽기 전용.',
    },
    icon: Table2,
  },
  {
    href: '/admin/english-coach',
    title: {
      vi: 'Bài học đã lưu',
      en: 'Saved lessons',
      zh: '已保存课程',
      ja: '保存済みレッスン',
      ko: '저장된 레슨',
    },
    description: {
      vi: 'Xem danh sách bài học đã hoàn thành để tái sử dụng.',
      en: 'Browse completed lessons for reuse.',
      zh: '查看可复用的已完成课程。',
      ja: '再利用できる完了レッスン一覧。',
      ko: '재사용 가능한 완료 레슨 목록.',
    },
    icon: BookOpen,
  },
]

export default function AdminPage() {
  const uiLocale = getCurrentWebLocale()
  const tr = (vi: string, en: string, zh: string, ja: string, ko: string) => {
    if (uiLocale === 'en') return en
    if (uiLocale === 'zh') return zh
    if (uiLocale === 'ja') return ja
    if (uiLocale === 'ko') return ko
    return vi
  }

  return (
    <div className="flex min-h-[calc(100vh-10rem)] items-center justify-center">
      <div className="w-full max-w-4xl space-y-6">
        <div className="rounded-2xl border bg-gradient-to-br from-white to-slate-50 p-6 text-center shadow-sm sm:p-8">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            {tr('Bảng điều khiển quản trị', 'Admin dashboard', '管理控制台', '管理ダッシュボード', '관리 대시보드')}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground sm:text-base">
            {tr(
              'Chọn công cụ cần mở để quản lý dữ liệu và vận hành hệ thống.',
              'Choose a tool to manage data and operate the system.',
              '选择工具来管理数据并运营系统。',
              'データ管理と運用のためのツールを選択してください。',
              '데이터 관리 및 운영을 위한 도구를 선택하세요.'
            )}
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {ADMIN_LINKS.map((item, index) => {
            const Icon = item.icon
            const localeTitle = item.title[uiLocale] || item.title.vi
            const localeDescription = item.description[uiLocale] || item.description.vi
            const card = (
              <Card className="h-full rounded-xl border-muted/70 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
                <CardHeader className="space-y-3 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <CardTitle className="text-lg">{localeTitle}</CardTitle>
                  </div>
                  <CardDescription>{localeDescription}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Link href={item.href}>
                    <Button variant="outline" size="sm" className="w-full">
                      {tr('Mở chức năng', 'Open tool', '打开功能', '機能を開く', '기능 열기')}
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            )
            return (
              <Link key={`${item.href}-${index}`} href={item.href}>
                {card}
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
