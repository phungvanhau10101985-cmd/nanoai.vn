import { GoogleGenerativeAI, HarmBlockThreshold, HarmCategory } from '@google/generative-ai'
import { requireGoogleApiKeyForUser } from '@/lib/ai/google-api-key-resolver'
import { getCreditBalanceByUserId } from '@/lib/db/credits-balance'
import { fetchMessagingPartnerOwnerUserIdFromPg } from '@/lib/db/messaging-partners-pg'
import {
  completePartnerSaleIconFromPg,
  failPartnerSaleIconFromPg,
  findPartnerSaleIconFromPg,
  insertGeneratingPartnerSaleIconFromPg,
} from '@/lib/db/messaging-partner-sale-icon-pg'
import { fetchPartnerMarketingBannerBrandFromPg } from '@/lib/db/messaging-partner-marketing-banner-pg'
import { GEMINI_3_PRO_IMAGE } from '@/lib/gemini-config'
import { deductUserCredits } from '@/lib/music/deduct-user-credits'
import { normalizeTemplateTheme } from '@/lib/partner-website/template/default-landing-v1'
import { resolveShopThemeColors } from '@/lib/partner-website/template/partner-website-theme-tokens'
import {
  buildPartnerSaleIconPrompt,
  isPartnerSaleIconSameDayMonth,
  PARTNER_SALE_ICON_ASPECT,
  PARTNER_SALE_ICON_CREDIT_COST,
  partnerShopSaleIconSourceUrls,
} from '@/lib/partner-website/promotions/partner-sale-icon'
import { uploadTryOnImagePublic } from '@/lib/storage/try-on-public-upload'
import { trackFromUsageMetadata } from '@/lib/track-ai-usage'

const SAFETY = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
]

function toTenths(value: number): number {
  return Math.round(value * 10)
}

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim())
}

async function fetchImagePart(url: string): Promise<{ inlineData: { mimeType: string; data: string } } | null> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 8000)
  try {
    const res = await fetch(url, { signal: ctrl.signal, cache: 'no-store' })
    if (!res.ok) return null
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length < 32 || buf.length > 4 * 1024 * 1024) return null
    const mime = (res.headers.get('content-type') || 'image/png').split(';')[0].trim()
    return {
      inlineData: {
        mimeType: mime.startsWith('image/') ? mime : 'image/png',
        data: buf.toString('base64'),
      },
    }
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

async function generateSaleIconBytes(input: {
  prompt: string
  apiKey: string
  userId?: string | null
  referenceUrls: string[]
}): Promise<Buffer> {
  const genAI = new GoogleGenerativeAI(input.apiKey)
  const model = genAI.getGenerativeModel({
    model: GEMINI_3_PRO_IMAGE.model,
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
      imageConfig: { imageSize: '1K', aspectRatio: PARTNER_SALE_ICON_ASPECT },
    },
  })
  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
    { text: input.prompt },
  ]
  for (const url of input.referenceUrls.slice(0, 3)) {
    const part = await fetchImagePart(url)
    if (part) parts.push(part)
  }
  const result = await model.generateContent(parts, { safetySettings: SAFETY } as never)
  trackFromUsageMetadata(
    result.response.usageMetadata,
    GEMINI_3_PRO_IMAGE.model,
    'partner-sale-icon',
    input.userId,
    '2K'
  )
  const imagePart = result.response.candidates?.[0]?.content?.parts?.find((part) => 'inlineData' in part)
  if (!imagePart || !('inlineData' in imagePart) || !imagePart.inlineData?.data) {
    throw new Error('AI không trả về icon vuông hợp lệ.')
  }
  return Buffer.from(imagePart.inlineData.data, 'base64')
}

export async function loadPartnerSaleIconSources(partnerId: string): Promise<{
  shopName: string
  primaryColor: string
  faviconUrl: string | null
  pwaIconUrl: string | null
  logoUrl: string | null
}> {
  const raw = await fetchPartnerMarketingBannerBrandFromPg(partnerId)
  const theme = normalizeTemplateTheme(raw?.themeJson, raw?.logoUrl)
  const colors = resolveShopThemeColors(theme)
  return {
    shopName: raw?.shopName || 'Shop',
    primaryColor: colors.primaryColor,
    faviconUrl: theme.faviconUrl?.trim() || null,
    pwaIconUrl: theme.pwaIconUrl?.trim() || null,
    logoUrl: raw?.logoUrl || theme.logoUrl || null,
  }
}

export async function generatePartnerSaleIcon(input: {
  partnerId: string
  day: number
  month: number
  discountPercent: number
  force?: boolean
  actorUserId?: string | null
  chargeCredits?: boolean
}): Promise<
  | { ok: true; asset: NonNullable<Awaited<ReturnType<typeof completePartnerSaleIconFromPg>>> }
  | { ok: false; error: string; status?: number }
> {
  if (!isPartnerSaleIconSameDayMonth(input.day, input.month)) {
    return { ok: false, error: 'Chỉ tạo icon cho ngày trùng tháng (1/1 … 12/12).', status: 400 }
  }
  const existing = await findPartnerSaleIconFromPg({
    partnerId: input.partnerId,
    day: input.day,
    month: input.month,
  })
  const sources = await loadPartnerSaleIconSources(input.partnerId)
  const sourceFav = sources.faviconUrl
  const sourcePwa = sources.pwaIconUrl || sources.faviconUrl
  if (
    !input.force &&
    existing?.status === 'ready' &&
    existing.imageUrl &&
    existing.sourceFaviconUrl === sourceFav &&
    existing.sourcePwaIconUrl === sourcePwa
  ) {
    return { ok: true, asset: existing }
  }
  if (existing?.status === 'generating' && existing.createdAt) {
    const started = Date.parse(existing.createdAt)
    const stale = !Number.isFinite(started) || Date.now() - started >= 20 * 60 * 1000
    if (!stale) return { ok: false, error: 'Icon sale đang được tạo.', status: 409 }
  }

  const actorUserId = input.actorUserId ?? (await fetchMessagingPartnerOwnerUserIdFromPg(input.partnerId))
  if (input.chargeCredits && actorUserId) {
    try {
      const balance = await getCreditBalanceByUserId(actorUserId)
      if (toTenths(balance) < toTenths(PARTNER_SALE_ICON_CREDIT_COST)) {
        return { ok: false, error: 'Không đủ credits để tạo icon sale.', status: 402 }
      }
    } catch {
      return { ok: false, error: 'Không đọc được số dư credits.', status: 402 }
    }
  }

  const refs = partnerShopSaleIconSourceUrls({
    faviconUrl: sourceFav,
    pwaIconUrl: sourcePwa,
    logoUrl: sources.logoUrl,
  })
  if (!refs.length) {
    return { ok: false, error: 'Cần favicon hoặc ảnh đại diện web app trước.', status: 400 }
  }
  const prompt = buildPartnerSaleIconPrompt({
    shopName: sources.shopName,
    day: input.day,
    month: input.month,
    discountPercent: input.discountPercent,
    primaryColor: sources.primaryColor,
    hasReference: refs.length > 0,
  })
  const row = await insertGeneratingPartnerSaleIconFromPg({
    partnerId: input.partnerId,
    day: input.day,
    month: input.month,
    discountPercent: input.discountPercent,
    prompt,
    model: GEMINI_3_PRO_IMAGE.model,
    sourceFaviconUrl: sourceFav,
    sourcePwaIconUrl: sourcePwa,
  })
  if (!row) return { ok: false, error: 'Không tạo được bản ghi icon sale.', status: 500 }

  try {
    const { apiKey } = await requireGoogleApiKeyForUser(actorUserId)
    const bytes = await generateSaleIconBytes({
      prompt,
      apiKey,
      userId: actorUserId,
      referenceUrls: refs,
    })
    const digest = bytes.subarray(0, 12).toString('hex')
    const path = `partners/${input.partnerId}/sale-icons/${input.month}-${input.day}-${Date.now()}-${digest}.png`
    const { publicUrl } = await uploadTryOnImagePublic(path, bytes, {
      contentType: 'image/png',
      upsert: true,
    })
    if (!isHttpUrl(publicUrl)) throw new Error('Không tải được icon sale lên kho.')
    if (input.chargeCredits && actorUserId) {
      const deducted = await deductUserCredits(
        actorUserId,
        PARTNER_SALE_ICON_CREDIT_COST,
        'partner-sale-icon'
      )
      if (!deducted.ok) {
        await failPartnerSaleIconFromPg({ id: row.id, errorMessage: deducted.error })
        return {
          ok: false,
          error: deducted.error,
          status: deducted.code === 'INSUFFICIENT_CREDITS' ? 402 : 500,
        }
      }
    }
    const ready = await completePartnerSaleIconFromPg({
      id: row.id,
      imageUrl: publicUrl,
      sourceFaviconUrl: sourceFav,
      sourcePwaIconUrl: sourcePwa,
    })
    if (!ready) return { ok: false, error: 'Không lưu được icon sale.', status: 500 }
    return { ok: true, asset: ready }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    await failPartnerSaleIconFromPg({ id: row.id, errorMessage: message })
    return { ok: false, error: message, status: 500 }
  }
}
