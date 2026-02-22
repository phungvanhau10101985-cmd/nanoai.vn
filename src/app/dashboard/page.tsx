import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getUserOrBypass } from '@/lib/auth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Sparkles, History, Wallet } from 'lucide-react'
import { ImagePreview } from '@/components/ui/image-preview'
import { AI_TOOLS } from '@/lib/nav-config'

export default async function DashboardPage() {
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
    <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-xl sm:text-3xl font-bold tracking-tight">Bảng điều khiển</h2>
      </div>
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tổng số tín dụng</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{credits?.balance || 0}</div>
            <p className="text-xs text-muted-foreground">
              Có sẵn để thử đồ
            </p>
            <Link href="/wallet" className="mt-4 block">
              <Button size="sm" className="w-full">Nạp tiền</Button>
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Thử đồ mới
            </CardTitle>
            <Sparkles className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Sẵn sàng</div>
            <p className="text-xs text-muted-foreground">
              Tạo ảnh thử đồ mới ngay bây giờ
            </p>
            <Button className="w-full mt-4" asChild>
              <Link href="/thu-do-online">Thử đồ ngay</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg sm:text-xl font-semibold">Công cụ AI</h3>
        <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-0 sm:gap-3">
          {AI_TOOLS.map((tool) => {
            const Icon = tool.icon
            return (
              <Link key={tool.href} href={tool.href}>
                <Card className="h-full hover:bg-muted/50 transition-colors cursor-pointer rounded-none sm:rounded-lg border border-r-0 last:border-r border-t-0 first:border-t sm:border">
                  <CardContent className="p-0.5 sm:p-3 flex flex-col items-center justify-center gap-1 text-center">
                    <div className="w-[30vw] max-w-[150px] aspect-square">
                      <Icon className="h-full w-full text-muted-foreground" />
                    </div>
                    <span className="text-xs sm:text-sm md:text-base font-medium leading-tight mt-0.5 sm:mt-1 px-1">{tool.label}</span>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      </div>
      
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg sm:text-xl font-semibold">Lịch sử gần đây</h3>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard/history">Xem tất cả</Link>
          </Button>
        </div>
        {history && history.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {history.map((item) => (
              <Card key={item.id} className="overflow-hidden group">
                <div className="aspect-[3/4] relative">
                  {item.result_image_url && (
                    <ImagePreview 
                      src={item.result_image_url} 
                      alt={`Kết quả thử đồ ngày ${new Date(item.created_at).toLocaleDateString()}`}
                      className="w-full h-full"
                    />
                  )}
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-8 text-center">
              <History className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium">Chưa có lịch sử</p>
              <p className="text-sm text-muted-foreground mb-4">
                Bắt đầu trải nghiệm thử đồ ảo đầu tiên của bạn
              </p>
              <Link href="/try-on">
                <Button variant="outline">Thử đồ ngay</Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
