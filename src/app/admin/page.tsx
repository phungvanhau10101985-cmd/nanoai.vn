import Link from 'next/link'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getCurrentWebLocale } from '@/lib/i18n/server'
import { ADMIN_NAV_GROUPS, adminNavLabel } from '@/lib/admin/admin-nav'

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
    <div className="space-y-6">
      <div className="rounded-xl border border-border/70 bg-card/90 p-5 shadow-sm sm:p-6">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {tr('Bảng điều khiển quản trị', 'Admin dashboard', '管理控制台', '管理ダッシュボード', '관리 대시보드')}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground sm:text-base">
          {tr(
            'Chọn mục bên trái để quản lý dữ liệu và vận hành hệ thống.',
            'Choose an item on the left to manage data and operate the system.',
            '选择左侧菜单以管理数据并运营系统。',
            '左のメニューからデータ管理と運用ツールを選んでください。',
            '왼쪽 메뉴에서 데이터 관리 및 운영 도구를 선택하세요.'
          )}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {ADMIN_NAV_GROUPS.flatMap((group) =>
          group.items.map((item) => {
            const Icon = item.icon
            return (
              <Link key={item.href} href={item.href} className="group block">
                <Card className="h-full rounded-xl border-border/70 transition-colors group-hover:border-violet-500/40 group-hover:bg-violet-500/[0.03]">
                  <CardHeader className="space-y-2 p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-500/10 text-violet-700 dark:text-violet-300">
                        <Icon className="h-4 w-4" />
                      </div>
                      <CardTitle className="text-base font-medium">
                        {adminNavLabel(item.title, uiLocale)}
                      </CardTitle>
                    </div>
                    <CardDescription className="line-clamp-2 text-xs sm:text-sm">
                      {adminNavLabel(item.description, uiLocale)}
                    </CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            )
          })
        )}
      </div>
    </div>
  )
}
