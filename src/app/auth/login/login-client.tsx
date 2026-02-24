"use client"

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { login, signup, signInWithGoogle } from '../actions'
import { Chrome } from 'lucide-react'

type LoginClientProps = {
  message?: string
  error?: string
}

const isNgrok = () => typeof window !== 'undefined' && window.location.hostname.includes('ngrok')

function useFormSubmitWithNgrok() {
  return async (e: React.FormEvent<HTMLFormElement>) => {
    if (!isNgrok()) return
    e.preventDefault()
    const form = e.currentTarget
    const formData = new FormData(form)
    try {
      const res = await fetch(window.location.href, {
        method: 'POST',
        body: formData,
        headers: { 'ngrok-skip-browser-warning': 'true' },
        redirect: 'manual',
      })
      if (res.status === 303 || res.status === 302) {
        const loc = res.headers.get('Location')
        if (loc) {
          window.location.href = loc
          return
        }
      }
      if (!res.ok) {
        window.location.href = window.location.pathname + '?error=' + encodeURIComponent('Đăng nhập thất bại')
        return
      }
      window.location.reload()
    } catch (err) {
      console.error('Login request failed:', err)
    }
  }
}

export default function LoginClient({ message, error }: LoginClientProps) {
  const [uiLocale, setUiLocale] = useState<'vi' | 'en' | 'zh' | 'ja' | 'ko'>('vi')
  const handleLoginNgrok = useFormSubmitWithNgrok()
  const handleSignupNgrok = useFormSubmitWithNgrok()
  const handleGoogleNgrok = useFormSubmitWithNgrok()
  const tr = (vi: string, en: string, zh: string, ja: string, ko: string) => {
    if (uiLocale === 'en') return en
    if (uiLocale === 'zh') return zh
    if (uiLocale === 'ja') return ja
    if (uiLocale === 'ko') return ko
    return vi
  }

  useEffect(() => {
    const syncLocale = () => {
      const cookieValue = document.cookie
        .split(';')
        .map((x) => x.trim())
        .find((x) => x.startsWith('nanoai_locale='))
        ?.split('=')[1]
        ?.trim()
        .toLowerCase()
      if (cookieValue === 'en' || cookieValue === 'zh' || cookieValue === 'ja' || cookieValue === 'ko') setUiLocale(cookieValue)
      else setUiLocale('vi')
    }
    syncLocale()
    const timer = window.setInterval(syncLocale, 1000)
    window.addEventListener('focus', syncLocale)
    document.addEventListener('visibilitychange', syncLocale)
    return () => {
      window.removeEventListener('focus', syncLocale)
      document.removeEventListener('visibilitychange', syncLocale)
      window.clearInterval(timer)
    }
  }, [])

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-white to-indigo-50 px-4 py-10">
      <Card className="w-full max-w-md border-muted/60 shadow-lg">
        <CardHeader className="text-center space-y-2">
          <CardTitle className="text-2xl font-bold">{tr('Chào mừng trở lại', 'Welcome back', '欢迎回来', 'おかえりなさい', '다시 오신 것을 환영합니다')}</CardTitle>
          <CardDescription>
            {tr('Đăng nhập để bắt đầu trải nghiệm thử đồ ảo theo phong cách riêng của bạn.', 'Sign in to start your personalized virtual try-on experience.', '登录以开始你的个性化虚拟试衣体验。', 'ログインして、あなた好みのバーチャル試着を始めましょう。', '로그인하고 나만의 가상 피팅을 시작하세요.')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {message && (
            <div className="mb-4 rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">
              {message}
            </div>
          )}
          {error && (
            <div className="mb-4 rounded-md bg-destructive/15 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="login">{tr('Đăng nhập', 'Sign in', '登录', 'ログイン', '로그인')}</TabsTrigger>
              <TabsTrigger value="register">{tr('Đăng ký', 'Sign up', '注册', '新規登録', '회원가입')}</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form action={login} onSubmit={handleLoginNgrok} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" name="email" type="email" placeholder="m@example.com" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">{tr('Mật khẩu', 'Password', '密码', 'パスワード', '비밀번호')}</Label>
                  <Input id="password" name="password" type="password" required />
                </div>
                <Button type="submit" className="w-full h-11">
                  {tr('Đăng nhập', 'Sign in', '登录', 'ログイン', '로그인')}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="register">
              <form action={signup} onSubmit={handleSignupNgrok} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">{tr('Họ và Tên', 'Full name', '姓名', '氏名', '이름')}</Label>
                  <Input id="fullName" name="fullName" placeholder="John Doe" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" name="email" type="email" placeholder="m@example.com" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">{tr('Mật khẩu', 'Password', '密码', 'パスワード', '비밀번호')}</Label>
                  <Input id="password" name="password" type="password" required />
                </div>
                <Button type="submit" className="w-full h-11">
                  {tr('Tạo tài khoản', 'Create account', '创建账号', 'アカウント作成', '계정 만들기')}
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                {tr('Hoặc tiếp tục với', 'Or continue with', '或使用以下方式继续', 'または次で続行', '또는 다음으로 계속')}
              </span>
            </div>
          </div>

          <form action={signInWithGoogle} onSubmit={handleGoogleNgrok}>
            <Button variant="outline" type="submit" className="w-full h-11">
              <Chrome className="mr-2 h-4 w-4" />
              Google
            </Button>
          </form>
        </CardContent>
        <CardFooter className="text-xs text-muted-foreground">
          {tr('Thông tin cá nhân của bạn được bảo mật an toàn.', 'Your personal information is securely protected.', '你的个人信息将被安全保护。', '個人情報は安全に保護されます。', '개인정보는 안전하게 보호됩니다.')}
        </CardFooter>
      </Card>
    </div>
  )
}
