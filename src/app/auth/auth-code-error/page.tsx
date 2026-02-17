import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Metadata } from 'next'
import { buildMetadata } from '@/lib/seo'

export const metadata: Metadata = buildMetadata({
  title: 'Lỗi xác thực',
  description: 'Đã xảy ra lỗi khi xác thực đăng nhập.',
  path: '/auth/auth-code-error',
  noIndex: true,
})

export default function AuthCodeError() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <Card className="w-[420px]">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Đã xảy ra lỗi</CardTitle>
          <CardDescription>
            Liên kết xác thực không hợp lệ hoặc đã hết hạn. Vui lòng thử lại.
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <Button asChild className="w-full">
            <Link href="/auth/login">Quay lại trang đăng nhập</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
