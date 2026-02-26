import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/server'
import { getUserOrBypass } from '@/lib/auth'
import { MobileNav } from './mobile-nav'
import { HeaderUserMenu } from './header-user-menu'
import { LayoutGrid } from 'lucide-react'
import { getServerDictionary, getCurrentWebLocale } from '@/lib/i18n/server'
import { LocaleSwitcher } from '@/components/layout/locale-switcher'
import { getDictionary, type Dictionary } from '@/lib/i18n/dictionaries'

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
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <img src="/icons/icon-192x192.png" alt={t.app.siteName} width={44} height={44} className="rounded-lg" />
            <span className="font-bold text-lg">{t.app.siteName}</span>
          </Link>

          <nav className="hidden md:flex items-center gap-2">
            <LocaleSwitcher currentLocale={locale} />
            <Link href="/dashboard">
              <Button variant="outline" size="sm" className="gap-2">
                <LayoutGrid className="h-4 w-4" />
                {t.app.toolHub}
              </Button>
            </Link>
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <div className="md:hidden">
              <MobileNav isAdmin={isAdmin} t={clientDictionary} />
            </div>
            {user ? (
              <HeaderUserMenu user={user} credits={credits} isAdmin={isAdmin} t={clientDictionary} />
            ) : (
              <Link href="/auth/login">
                <Button variant="secondary" size="sm">
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
