import type { Metadata } from 'next'
import Link from 'next/link'
import { buildMetadata, SITE_URL } from '@/lib/seo'
import { NAV_GROUPS } from '@/lib/nav-config'
import { getServerDictionary } from '@/lib/i18n/server'

export const metadata: Metadata = buildMetadata({
  title: 'Sơ đồ trang web',
  description:
    'Sơ đồ trang web NanoAI giúp Google và người dùng khám phá đầy đủ các trang tính năng AI quan trọng.',
  path: '/so-do-trang-web',
  keywords: ['sơ đồ trang web', 'sitemap', 'NanoAI'],
})

const extraLinks = [
  { href: '/', label: 'Home' },
  { href: '/sitemap.xml', label: 'Sitemap XML' },
  { href: '/robots.txt', label: 'Robots.txt' },
]

export default function SoDoTrangWebPage() {
  const { t } = getServerDictionary()
  return (
    <div className="container max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Sitemap</h1>
        <p className="text-muted-foreground">
          {t.app.siteName} important pages for users and search engines.
        </p>
      </header>

      <section>
        <h2 className="text-xl font-semibold mb-3">{t.menu.system}</h2>
        <ul className="grid sm:grid-cols-2 gap-2">
          {extraLinks.map((item) => (
            <li key={item.href}>
              <Link className="text-blue-600 hover:underline" href={item.href}>
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {NAV_GROUPS.map((group) => (
        <section key={group.titleKey}>
          <h2 className="text-xl font-semibold mb-3">{t.navGroup[group.titleKey]}</h2>
          <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {group.links.map((link) => (
              <li key={link.href} className="space-y-1">
                <Link className="text-blue-600 hover:underline" href={link.href}>
                  {t.tool[link.labelKey]}
                </Link>
                {link.subLinks?.length ? (
                  <ul className="ml-4 list-disc space-y-0.5 text-sm text-muted-foreground">
                    {link.subLinks.map((sub) => (
                      <li key={sub.href}>
                        <Link className="text-blue-600 hover:underline" href={sub.href}>
                          {t.tool[sub.labelKey]}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ))}

      <p className="text-xs text-muted-foreground">
        Domain chuẩn: {SITE_URL}
      </p>
    </div>
  )
}
