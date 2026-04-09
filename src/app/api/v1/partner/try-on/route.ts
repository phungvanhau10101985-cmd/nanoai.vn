import { NextRequest, NextResponse } from 'next/server'
import { normalizeToEnglish } from '@/lib/ai-normalize'
import { tryOnCostMap, buildSinglePersonPrompt } from '@/lib/try-on/try-on-prompts'
import { runVirtualTryOnPipeline } from '@/lib/try-on/run-virtual-try-on-pipeline'
import { resolvePartnerTryOnBillingUserId } from '@/lib/try-on/partner-try-on-auth'

export const maxDuration = 120
export const dynamic = 'force-dynamic'

const MAX_GARMENTS = 12

/**
 * Partner virtual try-on (single person).
 * multipart/form-data:
 * - userImage: required
 * - garmentImage0, garmentImage1, ... (or garmentCount + garmentImage{i})
 * - imageQuality: optional "2K" | "4K" (default 2K)
 * - gender: optional "male" | "female" (default male)
 * - customPrompt: optional string
 *
 * Authorization: Bearer <api_secret>
 * Credits are charged to billing_user_id linked to the hashed secret in partner_try_on_clients.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await resolvePartnerTryOnBillingUserId(request.headers.get('authorization'))
    if ('error' in auth) {
      return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
    }
    const { billingUserId } = auth

    let formData: FormData
    try {
      formData = await request.formData()
    } catch {
      return NextResponse.json({ ok: false, error: 'Expected multipart/form-data body.' }, { status: 400 })
    }

    const userImage = formData.get('userImage') as File | null
    if (!userImage || !(userImage instanceof File) || userImage.size === 0) {
      return NextResponse.json({ ok: false, error: 'Field userImage is required (non-empty file).' }, { status: 400 })
    }

    const garmentImages: File[] = []
    const countRaw = formData.get('garmentCount')
    const count = countRaw != null ? parseInt(String(countRaw), 10) : NaN
    if (Number.isFinite(count) && count > 0) {
      for (let i = 0; i < Math.min(count, MAX_GARMENTS); i++) {
        const f = formData.get(`garmentImage${i}`)
        if (f instanceof File && f.size > 0) garmentImages.push(f)
      }
    } else {
      for (let i = 0; i < MAX_GARMENTS; i++) {
        const f = formData.get(`garmentImage${i}`)
        if (f instanceof File && f.size > 0) garmentImages.push(f)
      }
    }

    if (garmentImages.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'At least one garment image is required (garmentImage0, …).' },
        { status: 400 }
      )
    }

    const imageQualityRaw = String(formData.get('imageQuality') ?? '2K')
    const imageQuality = imageQualityRaw === '4K' ? '4K' : '2K'

    const genderRaw = String(formData.get('gender') ?? 'male').toLowerCase()
    const genderLabel = genderRaw === 'female' ? 'female' : 'male'

    const customPrompt = String(formData.get('customPrompt') ?? '').trim()
    const customPromptEn = customPrompt ? await normalizeToEnglish(customPrompt) : ''

    const baseCost = tryOnCostMap.single
    const cost = imageQuality === '4K' ? baseCost * 2.2 : baseCost
    const prompt = buildSinglePersonPrompt(genderLabel, customPromptEn, garmentImages.length)

    const pipe = await runVirtualTryOnPipeline({
      billingUserId,
      prompt,
      cost,
      imageQuality,
      userImage,
      garmentFilesOrdered: garmentImages,
    })

    if ('error' in pipe) {
      const msg = pipe.error
      const lowCredit = /Không đủ credits/i.test(msg)
      return NextResponse.json({ ok: false, error: msg }, { status: lowCredit ? 402 : 422 })
    }

    return NextResponse.json({
      ok: true,
      result_url: pipe.resultUrl,
      history_id: pipe.historyId,
      credits_remaining: pipe.creditsRemaining,
    })
  } catch (e) {
    console.error('[api/v1/partner/try-on]', e)
    return NextResponse.json({ ok: false, error: 'Internal server error.' }, { status: 500 })
  }
}
