import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Users, BarChart3, BookOpen } from 'lucide-react'

const ADMIN_LINKS = [
  {
    href: '/admin/users',
    title: 'Quản lý thành viên',
    description: 'Xem danh sách thành viên, chỉnh sửa tín dụng.',
    icon: Users,
  },
  {
    href: '/admin/api-stats',
    title: 'Thống kê API',
    description: 'Xem chi phí và log sử dụng API.',
    icon: BarChart3,
  },
  {
    href: '/admin/english-coach',
    title: 'Chuẩn hóa từ vựng',
    description: 'Chạy fix word examples cho Học tiếng Anh AI.',
    icon: BookOpen,
  },
  {
    href: '/admin/english-coach',
    title: 'Bài học đã lưu',
    description: 'Xem danh sách bài học đã hoàn thành để tái sử dụng.',
    icon: BookOpen,
  },
]

export default function AdminPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Quản trị</h1>
        <p className="text-muted-foreground mt-1">Chọn chức năng cần mở</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ADMIN_LINKS.map((item) => {
          const Icon = item.icon
          return (
            <Link key={item.href} href={item.href}>
              <Card className="h-full transition-colors hover:bg-muted/50">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <CardTitle className="text-lg">{item.title}</CardTitle>
                  </div>
                  <CardDescription>{item.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" size="sm" className="w-full">
                    Mở
                  </Button>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
