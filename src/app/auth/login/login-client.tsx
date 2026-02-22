"use client"

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
  const handleLoginNgrok = useFormSubmitWithNgrok()
  const handleSignupNgrok = useFormSubmitWithNgrok()
  const handleGoogleNgrok = useFormSubmitWithNgrok()

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-white to-indigo-50 px-4 py-10">
      <Card className="w-full max-w-md border-muted/60 shadow-lg">
        <CardHeader className="text-center space-y-2">
          <CardTitle className="text-2xl font-bold">Chào mừng trở lại</CardTitle>
          <CardDescription>
            Đăng nhập để bắt đầu trải nghiệm thử đồ ảo theo phong cách riêng của bạn.
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
              <TabsTrigger value="login">Đăng nhập</TabsTrigger>
              <TabsTrigger value="register">Đăng ký</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form action={login} onSubmit={handleLoginNgrok} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" name="email" type="email" placeholder="m@example.com" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Mật khẩu</Label>
                  <Input id="password" name="password" type="password" required />
                </div>
                <Button type="submit" className="w-full h-11">
                  Đăng nhập
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="register">
              <form action={signup} onSubmit={handleSignupNgrok} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Họ và Tên</Label>
                  <Input id="fullName" name="fullName" placeholder="John Doe" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" name="email" type="email" placeholder="m@example.com" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Mật khẩu</Label>
                  <Input id="password" name="password" type="password" required />
                </div>
                <Button type="submit" className="w-full h-11">
                  Tạo tài khoản
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
                Hoặc tiếp tục với
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
          Thông tin cá nhân của bạn được bảo mật an toàn.
        </CardFooter>
      </Card>
    </div>
  )
}
