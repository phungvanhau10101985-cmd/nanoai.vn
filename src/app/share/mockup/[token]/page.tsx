import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { buildMetadata } from '@/lib/seo'
import { fetchPackagingMockupShareByTokenPg } from '@/lib/db/packaging-mockup-share-pg'
import { faceUrlsToFaceSlots } from '@/lib/packaging/mockup-share-utils'
import { PackagingMockupSharePublicClient } from './packaging-mockup-share-public-client'

type Props = { params: { token: string } }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const row = await fetchPackagingMockupShareByTokenPg(params.token).catch(() => null)
  const title = row ? '3D Box Mockup' : 'Mockup not found'
  return buildMetadata({
    title,
    description: 'Interactive 3D packaging box mockup — drag to rotate every face.',
    path: `/share/mockup/${params.token}`,
    noIndex: true,
  })
}

export default async function PackagingMockupSharePage({ params }: Props) {
  const row = await fetchPackagingMockupShareByTokenPg(params.token).catch(() => null)
  if (!row) notFound()

  const { length, width, height } = row.dimensions_mm
  return (
    <PackagingMockupSharePublicClient
      dimensionsMm={row.dimensions_mm}
      faceSlots={faceUrlsToFaceSlots(row.face_urls)}
      locale={row.locale}
      sizeLabel={`${Math.round(length)} × ${Math.round(width)} × ${Math.round(height)} mm`}
    />
  )
}
