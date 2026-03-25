import Link from 'next/link'
import type { User } from '@supabase/supabase-js'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/server'
import { getUserOrBypass } from '@/lib/auth'
import { MobileNav } from './mobile-nav'
import { HeaderUserMenu } from './header-user-menu'
import { LocaleSwitcher } from './locale-switcher'
import { LayoutGrid } from 'lucide-react'
import { NotificationBell } from './notification-bell'
import { LoginNavButton } from './login-nav-button'
import { getServerDictionary, getCurrentWebLocale } from '@/lib/i18n/server'
import { getDictionary, type Dictionary } from '@/lib/i18n/dictionaries'

export async function Header() {
  const { t } = getServerDictionary()
  const locale = getCurrentWebLocale()
  const clientDictionary: Dictionary = getDictionary(locale)

  let user: User | null = null
  let credits = 0
  let isAdmin = false

  try {
    const supabase = createClient()
    user = await getUserOrBypass(() => supabase.auth.getUser())

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
  } catch (err) {
    console.error('[Header] SSR fetch failed, showing logged-out shell', err)
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/70 bg-background/85 backdrop-blur-xl supports-[backdrop-filter]:bg-background/65">
      <div className="container mx-auto max-w-7xl px-3 py-3 sm:px-6 lg:px-8 lg:py-3.5 xl:px-10">
        <div className="flex items-center justify-between gap-3 sm:gap-4 lg:gap-5">
          <Link href="/" className="group flex items-center gap-2.5 shrink-0">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-border/70 bg-card/90 shadow-sm transition-transform duration-200 group-hover:scale-[1.02] lg:h-11 lg:w-11">
              <img src="/icons/icon-192x192.png" alt={t.app.siteName} width={30} height={30} className="rounded-md lg:h-8 lg:w-8" />
            </span>
            <span className="text-base font-semibold tracking-tight sm:text-lg lg:text-xl">{t.app.siteName}</span>
          </Link>

          <nav className="hidden items-center gap-2 md:flex lg:gap-3">
            <LocaleSwitcher currentLocale={locale} />
            <Link href="/dashboard">
              <Button
                variant="outline"
                size="sm"
                className="h-9 gap-2 rounded-xl border-border/70 bg-card/80 px-3 lg:h-10 lg:px-4 lg:shadow-sm"
              >
                <LayoutGrid className="h-4 w-4 lg:h-[1.125rem] lg:w-[1.125rem]" />
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
              <LoginNavButton label={t.app.login} className="rounded-xl px-3" />
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
