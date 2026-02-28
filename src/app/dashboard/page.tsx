import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getUserOrBypass } from '@/lib/auth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Sparkles, History, Wallet } from 'lucide-react'
import { ImagePreview } from '@/components/ui/image-preview'
import { AI_TOOLS } from '@/lib/nav-config'
import { getCurrentWebLocale, getServerDictionary } from '@/lib/i18n/server'

export default async function DashboardPage() {
  const { t } = getServerDictionary()
  const locale = getCurrentWebLocale()
  const ui = {
    title: locale === 'vi' ? 'Bảng điều khiển' : locale === 'zh' ? '控制台' : locale === 'ja' ? 'ダッシュボード' : locale === 'ko' ? '대시보드' : 'Dashboard',
    totalCredits: locale === 'vi' ? 'Tổng số tín dụng' : locale === 'zh' ? '总点数' : locale === 'ja' ? '合計クレジット' : locale === 'ko' ? '총 크레딧' : 'Total credits',
    availableTryOn: locale === 'vi' ? 'Có sẵn để thử đồ' : locale === 'zh' ? '可用于试衣' : locale === 'ja' ? '試着に利用可能' : locale === 'ko' ? '피팅에 사용 가능' : 'Available for try-on',
    topUp: locale === 'vi' ? 'Nạp tiền' : locale === 'zh' ? '充值' : locale === 'ja' ? 'チャージ' : locale === 'ko' ? '충전' : 'Top up',
    newTryOn: locale === 'vi' ? 'Thử đồ mới' : locale === 'zh' ? '新建试衣' : locale === 'ja' ? '新しい試着' : locale === 'ko' ? '새 피팅' : 'New try-on',
    ready: locale === 'vi' ? 'Sẵn sàng' : locale === 'zh' ? '已就绪' : locale === 'ja' ? '準備完了' : locale === 'ko' ? '준비 완료' : 'Ready',
    createNow: locale === 'vi' ? 'Tạo ảnh thử đồ mới ngay bây giờ' : locale === 'zh' ? '立即创建新的试衣图片' : locale === 'ja' ? '今すぐ新しい試着画像を作成' : locale === 'ko' ? '지금 새 피팅 이미지를 생성하세요' : 'Create a new try-on image now',
    tryOnNow: locale === 'vi' ? 'Thử đồ ngay' : locale === 'zh' ? '立即试衣' : locale === 'ja' ? '今すぐ試着' : locale === 'ko' ? '지금 피팅' : 'Try on now',
    aiTools: locale === 'vi' ? 'Công cụ AI' : locale === 'zh' ? 'AI 工具' : locale === 'ja' ? 'AI ツール' : locale === 'ko' ? 'AI 도구' : 'AI tools',
    recentHistory: locale === 'vi' ? 'Lịch sử gần đây' : locale === 'zh' ? '最近历史' : locale === 'ja' ? '最近の履歴' : locale === 'ko' ? '최근 기록' : 'Recent history',
    viewAll: locale === 'vi' ? 'Xem tất cả' : locale === 'zh' ? '查看全部' : locale === 'ja' ? 'すべて表示' : locale === 'ko' ? '전체 보기' : 'View all',
    noHistory: locale === 'vi' ? 'Chưa có lịch sử' : locale === 'zh' ? '暂无历史记录' : locale === 'ja' ? '履歴がありません' : locale === 'ko' ? '기록이 없습니다' : 'No history yet',
    noHistoryDesc: locale === 'vi'
      ? 'Bắt đầu trải nghiệm thử đồ ảo đầu tiên của bạn'
      : locale === 'zh'
        ? '开始你的第一次 AI 试衣体验'
        : locale === 'ja'
          ? '最初の AI 試着体験を始めましょう'
          : locale === 'ko'
            ? '첫 AI 가상 피팅을 시작해 보세요'
            : 'Start your first virtual try-on experience',
    resultAlt: locale === 'vi' ? 'Kết quả thử đồ ngày' : locale === 'zh' ? '试衣结果日期' : locale === 'ja' ? '試着結果日付' : locale === 'ko' ? '피팅 결과 날짜' : 'Try-on result date',
  }
  const supabase = createClient()
  const user = await getUserOrBypass(() => supabase.auth.getUser())
  if (!user) redirect('/auth/login')

  const { data: credits } = await supabase
    .from('credits')
    .select('balance')
    .eq('user_id', user.id)
    .single()

  const { data: history } = await supabase
    .from('try_on_history')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(5)

  return (
    <div className="app-shell space-y-6 md:space-y-8">
      <div className="section-surface flex items-center justify-between">
        <h2 className="text-xl sm:text-3xl font-bold tracking-tight">{ui.title}</h2>
      </div>
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="tool-tile">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{ui.totalCredits}</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{credits?.balance || 0}</div>
            <p className="text-xs text-muted-foreground">
              {ui.availableTryOn}
            </p>
            <Link href="/wallet" className="mt-4 block">
              <Button size="sm" className="w-full">{ui.topUp}</Button>
            </Link>
          </CardContent>
        </Card>
        <Card className="tool-tile">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {ui.newTryOn}
            </CardTitle>
            <Sparkles className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{ui.ready}</div>
            <p className="text-xs text-muted-foreground">
              {ui.createNow}
            </p>
            <Button className="w-full mt-4" asChild>
              <Link href="/thu-do-online">{ui.tryOnNow}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="section-surface space-y-4">
        <h3 className="text-lg sm:text-xl font-semibold">{ui.aiTools}</h3>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3 lg:grid-cols-5">
          {AI_TOOLS.map((tool) => {
            const Icon = tool.icon
            return (
              <Link key={tool.href} href={tool.href}>
                <Card className="tool-tile cursor-pointer">
                  <CardContent className="flex min-h-[132px] flex-col items-center justify-center gap-2 p-2 text-center sm:min-h-[152px] sm:p-3">
                    <div className="flex aspect-square w-full max-w-[92px] items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500/10 to-indigo-500/10 sm:max-w-[106px]">
                      <Icon className="h-[82%] w-[82%] text-blue-600 dark:text-blue-400" />
                    </div>
                    <span className="mt-1 px-1 text-[11px] font-medium leading-tight sm:text-sm md:text-[15px]">{t.tool[tool.labelKey]}</span>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      </div>
      
      <div className="section-surface space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg sm:text-xl font-semibold">{ui.recentHistory}</h3>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard/history">{ui.viewAll}</Link>
          </Button>
        </div>
        {history && history.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {history.map((item) => (
              <Card key={item.id} className="tool-tile overflow-hidden group">
                <div className="aspect-[3/4] relative">
                  {item.result_image_url && (
                    <ImagePreview 
                      src={item.result_image_url} 
                      alt={`${ui.resultAlt} ${new Date(item.created_at).toLocaleDateString()}`}
                      className="w-full h-full"
                    />
                  )}
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="tool-tile">
            <CardContent className="flex flex-col items-center justify-center py-8 text-center">
              <History className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium">{ui.noHistory}</p>
              <p className="text-sm text-muted-foreground mb-4">
                {ui.noHistoryDesc}
              </p>
              <Link href="/try-on">
                <Button variant="outline">{ui.tryOnNow}</Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
