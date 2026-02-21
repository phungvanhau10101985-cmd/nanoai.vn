import type { Metadata } from 'next'
import Link from 'next/link'
import { buildMetadata, SITE_URL } from '@/lib/seo'
import { NAV_GROUPS } from '@/lib/nav-config'

export const metadata: Metadata = buildMetadata({
  title: 'Sơ đồ trang web',
  description:
    'Sơ đồ trang web NanoAI giúp Google và người dùng khám phá đầy đủ các trang tính năng AI quan trọng.',
  path: '/so-do-trang-web',
  keywords: ['sơ đồ trang web', 'sitemap', 'NanoAI'],
})

const extraLinks = [
  { href: '/', label: 'Trang chủ' },
  { href: '/sitemap.xml', label: 'Sitemap XML' },
  { href: '/robots.txt', label: 'Robots.txt' },
]

export default function SoDoTrangWebPage() {
  return (
    <div className="container max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Sơ đồ trang web</h1>
        <p className="text-muted-foreground">
          Danh sách các trang quan trọng của NanoAI để người dùng và công cụ tìm kiếm dễ thu thập dữ liệu.
        </p>
      </header>

      <section>
        <h2 className="text-xl font-semibold mb-3">Liên kết hệ thống</h2>
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
        <section key={group.title}>
          <h2 className="text-xl font-semibold mb-3">{group.title}</h2>
          <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {group.links.map((link) => (
              <li key={link.href}>
                <Link className="text-blue-600 hover:underline" href={link.href}>
                  {link.label}
                </Link>
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
