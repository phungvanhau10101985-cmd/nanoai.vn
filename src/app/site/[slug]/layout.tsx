import { Fraunces, Outfit } from 'next/font/google'

const display = Fraunces({
  subsets: ['latin'],
  weight: ['500', '700', '800'],
  variable: '--pw-font-display',
  display: 'swap',
})

const ui = Outfit({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--pw-font-ui',
  display: 'swap',
})

export default function PartnerSiteSlugLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${display.variable} ${ui.variable}`}>{children}</div>
}
