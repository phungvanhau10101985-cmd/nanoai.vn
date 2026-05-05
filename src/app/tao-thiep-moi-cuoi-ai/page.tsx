import { Metadata } from 'next'
import { JsonLd } from '@/components/seo-json-ld'
import { CreationToolPageShell } from '@/components/layout/creation-tool-page-shell'
import { getUserOrBypass } from '@/lib/auth'
import { redirectToLogin } from '@/lib/auth/login-redirect'
import { buildJsonLdService, buildMetadata, SITE_URL } from '@/lib/seo'
import WeddingCardAiClientPage from './wedding-card-ai-client-page'

export const metadata: Metadata = buildMetadata({
  title: 'Tạo thiệp mời cưới bằng AI',
  description:
    'Tạo thiệp mời cưới online bằng AI: chọn phong cách, preview nội dung miễn phí, tạo background/artwork AI và xuất bản link RSVP.',
  path: '/tao-thiep-moi-cuoi-ai',
  keywords: ['tạo thiệp mời cưới ai', 'thiệp cưới online', 'wedding invitation ai', 'rsvp cưới online'],
})

export default async function TaoThiepMoiCuoiAiPage() {
  const user = await getUserOrBypass()
  if (!user) redirectToLogin()
  const jsonLd = buildJsonLdService(
    'Tạo thiệp mời cưới bằng AI',
    'Tạo visual thiệp cưới bằng AI, render chữ tiếng Việt bằng hệ thống và xuất bản link RSVP online.',
    `${SITE_URL}/tao-thiep-moi-cuoi-ai`
  )

  return (
    <div className="app-shell">
      <JsonLd data={jsonLd} />
      <CreationToolPageShell currentHref="/tao-thiep-moi-cuoi-ai">
        <WeddingCardAiClientPage />
      </CreationToolPageShell>
    </div>
  )
}
