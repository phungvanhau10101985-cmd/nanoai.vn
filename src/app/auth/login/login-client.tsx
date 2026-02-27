"use client"

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { signInWithGoogle } from '../actions'
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
  const [isSubmitting, setIsSubmitting] = useState(false)
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
          <CardTitle className="text-2xl font-bold">{tr('Đăng nhập', 'Sign in', '登录', 'ログイン', '로그인')}</CardTitle>
          <CardDescription>
            {tr('Đăng nhập bằng tài khoản Google để bắt đầu trải nghiệm.', 'Sign in with your Google account to get started.', '使用 Google 账号登录以开始体验。', 'Googleアカウントでログインして始めましょう。', 'Google 계정으로 로그인하여 시작하세요.')}
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

          <form
            action={signInWithGoogle}
            onSubmit={(e) => {
              if (isSubmitting) {
                e.preventDefault()
                return
              }
              setIsSubmitting(true)
              handleGoogleNgrok(e)
            }}
          >
            <Button type="submit" disabled={isSubmitting} className="w-full h-11">
              <Chrome className="mr-2 h-4 w-4" />
              {isSubmitting
                ? tr('Đang chuyển hướng...', 'Redirecting...', '正在跳转...', 'リダイレクト中...', '리디렉션 중...')
                : tr('Đăng nhập bằng Google', 'Sign in with Google', '使用 Google 登录', 'Googleでログイン', 'Google로 로그인')}
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
