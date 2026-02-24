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
import { getCurrentWebLocale } from '@/lib/i18n/server'

export const metadata: Metadata = buildMetadata({
  title: 'Lỗi xác thực',
  description: 'Đã xảy ra lỗi khi xác thực đăng nhập.',
  path: '/auth/auth-code-error',
  noIndex: true,
})

export default function AuthCodeError() {
  const locale = getCurrentWebLocale()
  const tr = (vi: string, en: string, zh: string, ja: string, ko: string) =>
    locale === 'en' ? en : locale === 'zh' ? zh : locale === 'ja' ? ja : locale === 'ko' ? ko : vi
  return (
    <div className="flex items-center justify-center min-h-screen">
      <Card className="w-[420px]">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">{tr('Đã xảy ra lỗi', 'An error occurred', '发生错误', 'エラーが発生しました', '오류가 발생했습니다')}</CardTitle>
          <CardDescription>
            {tr('Liên kết xác thực không hợp lệ hoặc đã hết hạn. Vui lòng thử lại.', 'The verification link is invalid or expired. Please try again.', '验证链接无效或已过期，请重试。', '認証リンクが無効か期限切れです。再試行してください。', '인증 링크가 유효하지 않거나 만료되었습니다. 다시 시도해 주세요.')}
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <Button asChild className="w-full">
            <Link href="/auth/login">{tr('Quay lại trang đăng nhập', 'Back to login', '返回登录页', 'ログインページへ戻る', '로그인 페이지로 돌아가기')}</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
