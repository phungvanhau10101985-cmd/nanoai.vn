import { NextRequest, NextResponse } from 'next/server'
import { getUserForAction } from '@/lib/auth'
import { resolveFashionMessagingPartnerBySlug } from '@/lib/messaging/resolve-active-messaging-partner'
import { buildSinglePersonPrompt } from '@/lib/try-on/try-on-prompts'
import { runVirtualTryOnPipeline } from '@/lib/try-on/run-virtual-try-on-pipeline'

export const dynamic = 'force-dynamic'
export const maxDuration = 120
const CHAT_TRY_ON_COST_2K = 1
const MAX_GARMENTS = 4

function isHttpImageUrl(value: string): boolean {
  return /^https?:\/\//i.test(value)
}

async function resolvePartner(slug: string) {
  const active = await resolveFashionMessagingPartnerBySlug(slug)
  if (!active) return { error: 'not_found' as const }
  return { partnerId: active.id }
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  const auth = await getUserForAction('Unauthorized')
  if ('error' in auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const user = auth.user

  const partner = await resolvePartner(slug)
  if ('error' in partner) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Expected multipart/form-data.' }, { status: 400 })
  }

  const userImage = formData.get('userImage')
  const garmentImages: File[] = []
  const garmentUrls: string[] = []
  const countRaw = formData.get('garmentCount')
  const count = countRaw != null ? parseInt(String(countRaw), 10) : NaN
  if (Number.isFinite(count) && count > 0) {
    for (let i = 0; i < Math.min(count, MAX_GARMENTS); i++) {
      const f = formData.get(`garmentImage${i}`)
      if (f instanceof File && f.size > 0) garmentImages.push(f)
      const u = formData.get(`garmentUrl${i}`)
      if (typeof u === 'string' && u.trim()) garmentUrls.push(u.trim())
    }
  } else {
    for (let i = 0; i < MAX_GARMENTS; i++) {
      const f = formData.get(`garmentImage${i}`)
      if (f instanceof File && f.size > 0) garmentImages.push(f)
      const u = formData.get(`garmentUrl${i}`)
      if (typeof u === 'string' && u.trim()) garmentUrls.push(u.trim())
    }
  }
  if (!(userImage instanceof File) || userImage.size <= 0) {
    return NextResponse.json({ error: 'Missing user image.' }, { status: 400 })
  }
  if (garmentImages.length === 0 && garmentUrls.length === 0) {
    return NextResponse.json({ error: 'Missing garment image.' }, { status: 400 })
  }
  if (!userImage.type.startsWith('image/') || garmentImages.some((g) => !g.type.startsWith('image/'))) {
    return NextResponse.json({ error: 'Unsupported image type.' }, { status: 400 })
  }
  if (garmentUrls.some((u) => !isHttpImageUrl(u))) {
    return NextResponse.json({ error: 'Unsupported garment URL.' }, { status: 400 })
  }

  const garmentImagesFromUrl: File[] = []
  try {
    for (const [idx, url] of garmentUrls.entries()) {
      const res = await fetch(url)
      if (!res.ok) {
        return NextResponse.json({ error: 'Could not load garment image from URL.' }, { status: 400 })
      }
      const blob = await res.blob()
      if (!blob.type.startsWith('image/')) {
        return NextResponse.json({ error: 'Unsupported garment image URL type.' }, { status: 400 })
      }
      const ext = blob.type.includes('png')
        ? 'png'
        : blob.type.includes('webp')
          ? 'webp'
          : blob.type.includes('jpeg') || blob.type.includes('jpg')
            ? 'jpg'
            : 'bin'
      garmentImagesFromUrl.push(new File([blob], `garment-url-${idx}.${ext}`, { type: blob.type }))
    }
  } catch {
    return NextResponse.json({ error: 'Could not load garment image from URL.' }, { status: 400 })
  }

  const allGarments = [...garmentImages, ...garmentImagesFromUrl].slice(0, MAX_GARMENTS)

  const imageQualityRaw = String(formData.get('imageQuality') ?? '2K')
  const imageQuality = imageQualityRaw === '4K' ? '4K' : '2K'
  const prompt = buildSinglePersonPrompt('female', '', garmentImages.length)
  const baseCost = CHAT_TRY_ON_COST_2K
  const cost = imageQuality === '4K' ? baseCost * 2.2 : baseCost

  const pipe = await runVirtualTryOnPipeline({
    // Charge credits to the currently signed-in browser user.
    billingUserId: user.id,
    prompt,
    cost,
    imageQuality,
    userImage,
    garmentFilesOrdered: allGarments,
  })

  if ('error' in pipe) {
    const lowCredit = /Không đủ credits/i.test(pipe.error)
    return NextResponse.json({ error: pipe.error }, { status: lowCredit ? 402 : 422 })
  }

  return NextResponse.json({
    ok: true,
    resultUrl: pipe.resultUrl,
    historyId: pipe.historyId,
    deductedCredits: cost,
    creditsRemaining: pipe.creditsRemaining,
  })
}

