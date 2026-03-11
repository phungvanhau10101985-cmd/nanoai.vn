import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Users, BarChart3, BookOpen, FileEdit, Flag } from 'lucide-react'
import { getCurrentWebLocale } from '@/lib/i18n/server'

const ADMIN_LINKS = [
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
            return (
              <Link key={`${item.href}-${index}`} href={item.href}>
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
                    <Button variant="outline" size="sm" className="w-full">
                      {tr('Mở chức năng', 'Open tool', '打开功能', '機能を開く', '기능 열기')}
                    </Button>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
