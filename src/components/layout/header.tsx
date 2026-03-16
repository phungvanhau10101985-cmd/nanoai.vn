import Link from 'next/link'
import dynamic from 'next/dynamic'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/server'
import { getUserOrBypass } from '@/lib/auth'
import { MobileNav } from './mobile-nav'
import { HeaderUserMenu } from './header-user-menu'
import { LayoutGrid } from 'lucide-react'
import { NotificationBell } from './notification-bell'
import { getServerDictionary, getCurrentWebLocale } from '@/lib/i18n/server'
import { getDictionary, type Dictionary } from '@/lib/i18n/dictionaries'

const LocaleSwitcher = dynamic(
  () => import('@/components/layout/locale-switcher').then((m) => m.LocaleSwitcher),
  {
    ssr: false,
    loading: () => (
      <div className="hidden md:flex items-center gap-1 rounded-md border p-1 h-9 w-[180px] animate-pulse bg-muted/50" aria-hidden />
    ),
  }
)

export async function Header() {
  const { t } = getServerDictionary()
  const locale = getCurrentWebLocale()
  const clientDictionary: Dictionary = getDictionary(locale)
  const supabase = createClient()
  const user = await getUserOrBypass(() => supabase.auth.getUser())

  let credits = 0
  let isAdmin = false

  if (user) {
    const [creditRes, profileRes] = await Promise.all([
      supabase
      .from('credits')
      .select('balance')
      .eq('user_id', user.id)
      .single(),
      supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single(),
    ])

    credits = creditRes.data?.balance || 0
    isAdmin = profileRes.data?.role === 'admin'
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/70 bg-background/85 backdrop-blur-xl supports-[backdrop-filter]:bg-background/65">
      <div className="container mx-auto max-w-7xl px-3 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-3 sm:gap-4">
          <Link href="/" className="group flex items-center gap-2.5 shrink-0">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-border/70 bg-card/90 shadow-sm transition-transform duration-200 group-hover:scale-[1.02]">
              <img src="/icons/icon-192x192.png" alt={t.app.siteName} width={30} height={30} className="rounded-md" />
            </span>
            <span className="text-base font-semibold tracking-tight sm:text-lg">{t.app.siteName}</span>
          </Link>

          <nav className="hidden items-center gap-2 md:flex">
            <LocaleSwitcher currentLocale={locale} />
            <Link href="/dashboard">
              <Button variant="outline" size="sm" className="h-9 gap-2 rounded-xl border-border/70 bg-card/80 px-3">
                <LayoutGrid className="h-4 w-4" />
                {t.app.toolHub}
              </Button>
            </Link>
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            <div className="md:hidden">
              <MobileNav isAdmin={isAdmin} t={clientDictionary} />
            </div>
            {user ? (
              <>
                <NotificationBell t={clientDictionary} />
                <HeaderUserMenu user={user} credits={credits} isAdmin={isAdmin} t={clientDictionary} />
              </>
            ) : (
              <Link href="/auth/login">
                <Button variant="secondary" size="sm" className="rounded-xl px-3">
                  {t.app.login}
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
