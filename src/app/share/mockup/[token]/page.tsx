import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { buildMetadata } from '@/lib/seo'
import { fetchPackagingMockupShareByTokenPg } from '@/lib/db/packaging-mockup-share-pg'
import {
  bagFaceUrlsToFaceSlots,
  faceUrlsToFaceSlots,
} from '@/lib/packaging/mockup-share-utils'
import { PackagingBagMockupSharePublicClient } from './packaging-bag-mockup-share-public-client'
import { PackagingMockupSharePublicClient } from './packaging-mockup-share-public-client'

type Props = { params: { token: string } }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const row = await fetchPackagingMockupShareByTokenPg(params.token).catch(() => null)
  const title =
    row?.mockup_kind === 'bag'
      ? '3D Bag Mockup'
      : row
        ? '3D Box Mockup'
        : 'Mockup not found'
  const description =
    row?.mockup_kind === 'bag'
      ? 'Interactive 3D paper bag mockup — drag to rotate front, back, and gussets.'
      : 'Interactive 3D packaging box mockup — drag to rotate every face.'
  return buildMetadata({
    title,
    description,
    path: `/share/mockup/${params.token}`,
    noIndex: true,
  })
}

export default async function PackagingMockupSharePage({ params }: Props) {
  const row = await fetchPackagingMockupShareByTokenPg(params.token).catch(() => null)
  if (!row) notFound()

  if (row.mockup_kind === 'bag') {
    const { width, height, gusset } = row.dimensions_mm
    return (
      <PackagingBagMockupSharePublicClient
        dimensionsMm={row.dimensions_mm}
        faceSlots={bagFaceUrlsToFaceSlots(row.face_urls)}
        locale={row.locale}
        sizeLabel={`${Math.round(width)} × ${Math.round(height)} × ${Math.round(gusset)} mm`}
      />
    )
  }

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
