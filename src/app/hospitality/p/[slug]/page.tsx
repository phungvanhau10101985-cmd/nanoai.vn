import { notFound } from 'next/navigation'
import { resolveHospitalityPartnerBySlug } from '@/lib/hospitality/hospitality-partner-resolver'
import { GuestHospitalityClient } from './guest-hospitality-client'

export const dynamic = 'force-dynamic'

export default async function HospitalityPartnerGuestPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const partner = await resolveHospitalityPartnerBySlug(slug)
  if (!partner) return notFound()

  return (
    <main className="min-h-screen bg-background px-2 py-4 md:px-4 md:py-6">
      <GuestHospitalityClient slug={slug} shopDisplayName={partner.display_name} />
    </main>
  )
}
