import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/server'
import { getUserOrBypass } from '@/lib/auth'
import { MobileNav } from './mobile-nav'
import { HeaderUserMenu } from './header-user-menu'
import { LayoutGrid } from 'lucide-react'

export async function Header() {
  const supabase = createClient()
  const user = await getUserOrBypass(() => supabase.auth.getUser())

  let credits = 0
  if (user) {
    const { data: creditData } = await supabase
      .from('credits')
      .select('balance')
      .eq('user_id', user.id)
      .single()
    credits = creditData?.balance || 0
  }

  let isAdmin = false
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    isAdmin = profile?.role === 'admin'
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <Image src="/icons/icon-192x192.png" alt="NanoAI" width={44} height={44} className="rounded-lg" />
            <span className="font-bold text-lg">NanoAI</span>
          </Link>

          <nav className="hidden md:flex items-center gap-2">
            <Link href="/dashboard">
              <Button variant="outline" size="sm" className="gap-2">
                <LayoutGrid className="h-4 w-4" />
                Công cụ AI
              </Button>
            </Link>
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <div className="md:hidden">
              <MobileNav isAdmin={isAdmin} />
            </div>
            {user ? (
              <HeaderUserMenu user={user} credits={credits} />
            ) : (
              <Link href="/auth/login">
                <Button variant="secondary" size="sm">
                  Đăng nhập
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
