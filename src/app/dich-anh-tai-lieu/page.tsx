import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getUserOrBypass } from '@/lib/auth'
import DichAnhTaiLieuClientPage from './dich-anh-tai-lieu-client-page'
import { Metadata } from 'next'
import { buildMetadata, buildJsonLdService, SITE_URL } from '@/lib/seo'
import { JsonLd } from '@/components/seo-json-ld'

export const metadata: Metadata = buildMetadata({
  title: 'Dịch ảnh tài liệu kỹ thuật',
  description: 'Dịch ảnh tài liệu thành ảnh mới: bản vẽ, sơ đồ, bảng spec. Hỗ trợ nhiều ngôn ngữ. 1,5–3 credits/ảnh.',
  path: '/dich-anh-tai-lieu',
  keywords: ['dịch ảnh tài liệu', 'OCR tài liệu', 'dịch bản vẽ', 'dịch sơ đồ kỹ thuật', 'AI dịch ảnh'],
})

export default async function DichAnhTaiLieuPage() {
  const supabase = createClient()
  const user = await getUserOrBypass(() => supabase.auth.getUser())
  if (!user) redirect('/auth/login')

  const jsonLd = buildJsonLdService(
    'Dịch ảnh tài liệu kỹ thuật',
    'OCR và dịch bản vẽ, sơ đồ, spec, sổ tay kỹ thuật sang nhiều ngôn ngữ.',
    `${SITE_URL}/dich-anh-tai-lieu`
  )

  return (
    <>
      <JsonLd data={jsonLd} />
      <DichAnhTaiLieuClientPage />
    </>
  )
}
