import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { WeddingSampleDemoBar } from '@/components/wedding/wedding-sample-demo-bar'
import { getUserForCreditAction, getUserOrBypass } from '@/lib/auth'
import { ensureWeddingCardOwnerProfile, listWeddingMusicLibrary } from '@/lib/db/wedding-cards-pg'
import { loadWeddingOrnamentLayout } from '@/lib/db/wedding-ornament-layouts-pg'
import { getProfileRoleWithFallback } from '@/lib/db/read-user-dashboard-pg'
import { loadWeddingSharedFrame, loadWeddingShellLayout } from '@/lib/db/wedding-shell-layouts-pg'
import { weddingBackgroundPlateUrls } from '@/lib/wedding/wedding-background-plates'
import { canEditWeddingOrnaments, weddingOrnamentDeviceKey, weddingOrnamentSurfaceKey } from '@/lib/wedding/wedding-background-ornament-store'
import { weddingNaturalViewportContent } from '@/lib/wedding/wedding-design-viewport'
import { buildWeddingDemoPersonalInvite } from '@/lib/wedding/build-personal-wedding-invite'
import { buildWeddingSampleDemoCard, findWeddingSampleCard, weddingSampleSharedLayoutKey } from '@/lib/wedding/wedding-sample-cards'
import { normalizeInvitationOccasion } from '@/lib/wedding/invitation-occasion'
import { weddingSharedFrameKey } from '@/lib/wedding/wedding-shared-frame'
import { buildMetadata } from '@/lib/seo'
import WeddingPublicClient from '@/app/thiep-moi-cuoi/[slug]/wedding-public-client'

type Props = {
  params: { id: string }
  searchParams?: { embed?: string; still?: string; occasion?: string; quiet?: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const sample = findWeddingSampleCard(params.id)
  return buildMetadata({
    title: 'Thiệp mẫu',
    description: 'Xem thiệp mẫu trước khi dùng cho thiệp đang tạo.',
    path: `/thiep-mau/${sample?.id || params.id}`,
    noIndex: true,
  })
}

export default async function WeddingSampleDemoPage({ params, searchParams }: Props) {
  const still = searchParams?.still === '1'
  const quiet = searchParams?.quiet === '1'
  const bare = still || quiet
  const found = findWeddingSampleCard(params.id)
  const sample = found && searchParams?.occasion && !/^(day-thang|thoi-noi|sinh-nhat|mung-tho|khai-truong|tan-gia|lien-hoan|tot-nghiep|su-kien)-/.test(found.id)
    ? { ...found, occasionKey: normalizeInvitationOccasion(searchParams.occasion) }
    : found
  const card = sample ? buildWeddingSampleDemoCard(sample) : null
  if (!sample || !card) notFound()
  const demoInvite = buildWeddingDemoPersonalInvite({
    side: 'groom',
    groomName: card.groomName,
    brideName: card.brideName,
    groomParents: card.groomParents,
    brideParents: card.brideParents,
    weddingDate: card.weddingDate,
    receptionTime: card.weddingTime,
    partyStartTime: card.partyStartTime,
    address: card.venue,
    guestName: card.guestName,
    occasionKey: card.occasionKey,
  })
  const ornamentKey = weddingSampleSharedLayoutKey(sample)
  const [sharedOrnaments, sharedDesktop, sharedMobile, sharedCoverMobile, sharedLetterMobile, sharedShellDesktop, sharedShellMobile, sharedFrame, admin, demoMusicUrls, viewer] = await Promise.all([
    ornamentKey ? loadWeddingOrnamentLayout(ornamentKey) : null,
    ornamentKey ? loadWeddingOrnamentLayout(weddingOrnamentDeviceKey(ornamentKey, 'desktop')) : null,
    ornamentKey ? loadWeddingOrnamentLayout(weddingOrnamentDeviceKey(ornamentKey, 'mobile')) : null,
    ornamentKey ? loadWeddingOrnamentLayout(weddingOrnamentSurfaceKey(ornamentKey, 'mobile', 'cover')) : null,
    ornamentKey ? loadWeddingOrnamentLayout(weddingOrnamentSurfaceKey(ornamentKey, 'mobile', 'letter')) : null,
    ornamentKey ? loadWeddingShellLayout(weddingOrnamentDeviceKey(ornamentKey, 'desktop')) : null,
    ornamentKey ? loadWeddingShellLayout(weddingOrnamentDeviceKey(ornamentKey, 'mobile')) : null,
    ornamentKey ? loadWeddingSharedFrame(weddingSharedFrameKey(ornamentKey)).catch(() => null) : null,
    weddingSampleDemoAdmin(),
    listWeddingMusicLibrary(200)
      .then((rows) => rows.map((row) => row.audioUrl).filter(Boolean))
      .catch(() => [] as string[]),
    getUserOrBypass(),
  ])
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: `(function(){try{var meta=document.querySelector('meta[name="viewport"]');if(!meta){meta=document.createElement('meta');meta.setAttribute('name','viewport');document.head.appendChild(meta)}meta.setAttribute('content','${weddingNaturalViewportContent()}')}catch(e){}})();` }} />
      <WeddingPublicClient
        card={card}
        sideWishes={{ groom: [], bride: [], other: [] }}
        askLetterView={false}
        initialLetterView="both"
        initialGuestDisplayName={demoInvite.guestDisplayName}
        initialPersonalInvite={demoInvite.personalInvite}
        backgroundPlateUrls={weddingBackgroundPlateUrls(null, [], sample.aiStyleId ? '' : sample.backgroundPresetId)}
        ornamentOverride={sharedOrnaments}
        ornamentSharedDesktop={sharedDesktop ?? sharedOrnaments}
        ornamentSharedMobile={sharedCoverMobile ?? sharedMobile ?? sharedOrnaments}
        ornamentLetterSharedMobile={sharedLetterMobile}
        ornamentLayoutKey={ornamentKey}
        ornamentEditor={bare ? false : admin}
        hostEditor={bare ? false : admin}
        templateEditor={bare ? false : admin}
        sharedShell={{ desktop: sharedShellDesktop, mobile: sharedShellMobile }}
        initialSharedFrame={sharedFrame}
        samplePresetId={bare ? '' : admin ? sample.id : ''}
        sampleDemo
        demoMusicUrls={quiet ? [] : demoMusicUrls}
        captureStill={still}
        quietFrame={quiet}
      />
      {bare ? null : (
        <WeddingSampleDemoBar sampleId={sample.id} embed={searchParams?.embed === '1'} signedIn={Boolean(viewer)} />
      )}
    </>
  )
}

async function weddingSampleDemoAdmin() {
  const auth = await getUserForCreditAction().catch(() => ({ error: 'auth' as const }))
  if (!auth || 'error' in auth) return false
  const userId = await ensureWeddingCardOwnerProfile(auth.user.id, auth.user.email).catch(() => '')
  if (!userId) return false
  const role = await getProfileRoleWithFallback(userId).catch(() => null)
  return canEditWeddingOrnaments({ role, email: auth.user.email })
}
