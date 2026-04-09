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
          <CardDescription className="space-y-3 text-left">
            <p>
              {tr(
                'Liên kết xác thực không hợp lệ hoặc đã hết hạn. Vui lòng thử lại.',
                'The verification link is invalid or expired. Please try again.',
                '验证链接无效或已过期，请重试。',
                '認証リンクが無効か期限切れです。再試行してください。',
                '인증 링크가 유효하지 않거나 만료되었습니다. 다시 시도해 주세요.'
              )}
            </p>
            <p className="text-muted-foreground text-sm">
              {tr(
                'Nếu bạn vừa bấm đúng liên kết email hoặc đăng nhập mạng xã hội, đôi khi trình duyệt hoặc ứng dụng mail gọi link hai lần — lần đầu đã đăng nhập thành công, lần sau báo lỗi. Khi đó hãy mở trang chủ hoặc bảng điều khiển; nếu vẫn đã đăng nhập thì không cần làm lại.',
                'If you just used an email link or social login, your browser or mail app may open the link twice—the first visit succeeds and the second shows an error. Try opening the home page or dashboard; you may already be signed in.',
                '若您刚用过邮件或社交登录链接，浏览器或邮箱可能请求两次——第一次已成功，第二次会报错。请打开首页或控制台，您可能已登录。',
                'メールやソーシャルログイン直後は、ブラウザやメールがリンクを2回開き、1回目で成功・2回目でエラーになることがあります。トップやダッシュボードを開いてください。既にログイン済みの場合があります。',
                '이메일·소셜 링크 직후 브라우저나 메일 앱이 링크를 두 번 열어 첫 요청만 성공하고 두 번째는 오류가 날 수 있습니다. 홈 또는 대시보드를 열어 보세요. 이미 로그인되어 있을 수 있습니다.'
              )}
            </p>
            <p className="text-muted-foreground text-sm">
              {tr(
                'Nếu vẫn không đăng nhập được: trên bảng điều khiển nơi bạn cấu hình đăng nhập OAuth (mục Authentication → URL configuration), hãy thêm đúng Redirect URL dạng https://tên-miền-của-bạn/auth/callback, trùng với địa chỉ bạn đang mở web (kể cả www hoặc không www).',
                'If you still cannot sign in: in your sign-in provider’s dashboard (Authentication → URL configuration), add the exact redirect URL https://your-domain/auth/callback matching the site you use (including www or non-www).',
                '若仍无法登录：请在身份验证后台（Authentication → URL configuration）添加与当前网站完全一致的回调地址 https://你的域名/auth/callback（注意是否带 www）。',
                'ログインできない場合: サインイン設定の管理画面（Authentication → URL configuration）に、実際に開いているサイトと一致する https://ドメイン/auth/callback を追加してください（www の有無も一致）。',
                '계속 로그인되지 않으면: 로그인 제공자 설정(Authentication → URL configuration)에 실제 접속 주소와 동일한 https://도메인/auth/callback 을 추가하세요(www 포함 여부 일치).'
              )}
            </p>
          </CardDescription>
        </CardHeader>
        <CardFooter className="flex flex-col gap-2">
          <Button asChild className="w-full">
            <Link href="/dashboard">{tr('Vào bảng điều khiển', 'Go to dashboard', '进入控制台', 'ダッシュボードへ', '대시보드로')}</Link>
          </Button>
          <Button asChild variant="outline" className="w-full">
            <Link href="/auth/login">{tr('Quay lại trang đăng nhập', 'Back to login', '返回登录页', 'ログインページへ戻る', '로그인 페이지로 돌아가기')}</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
