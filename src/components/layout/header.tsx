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
    <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/85 backdrop-blur-xl supports-[backdrop-filter]:bg-background/65">
      <div className="container mx-auto max-w-7xl px-3 py-2 sm:px-6 lg:px-8 lg:py-2.5 xl:px-10">
        <div className="flex items-center justify-between gap-2.5 sm:gap-3.5 lg:gap-4">
          <Link href="/" className="group flex shrink-0 items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/70 bg-card/90 shadow-sm transition-transform duration-200 group-hover:scale-[1.02] lg:h-9 lg:w-9">
              <img src="/icons/icon-192x192.png" alt={t.app.siteName} width={24} height={24} className="rounded-md lg:h-6 lg:w-6" />
            </span>
            <span className="text-sm font-semibold tracking-tight sm:text-base lg:text-lg">{t.app.siteName}</span>
          </Link>

          <nav className="hidden items-center gap-1.5 md:flex lg:gap-2.5">
            <LocaleSwitcher currentLocale={locale} />
            <Link href="/dashboard">
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 rounded-lg border-border/70 bg-card/80 px-2.5 text-xs lg:h-9 lg:px-3 lg:text-sm lg:shadow-sm"
              >
                <LayoutGrid className="h-3.5 w-3.5 lg:h-4 lg:w-4" />
                {t.app.toolHub}
              </Button>
            </Link>
          </nav>

          <div className="flex shrink-0 items-center gap-1.5">
            <div className="md:hidden">
              <MobileNav isAdmin={isAdmin} t={clientDictionary} />
            </div>
            {user ? (
              <>
                <NotificationBell t={clientDictionary} locale={locale} />
                <HeaderUserMenu user={user} credits={credits} isAdmin={isAdmin} t={clientDictionary} />
              </>
            ) : (
              <LoginNavButton label={t.app.login} className="rounded-lg px-2.5 py-1.5 text-xs" />
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
