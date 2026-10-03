import { GoogleGenerativeAI, HarmBlockThreshold, HarmCategory } from '@google/generative-ai'
import { requireGoogleApiKeyForUser } from '@/lib/ai/google-api-key-resolver'
import { getCreditBalanceByUserId } from '@/lib/db/credits-balance'
import {
  completePartnerMarketingBannerAssetFromPg,
  countFailedPartnerMarketingBannerAiAttemptsFromPg,
  failPartnerMarketingBannerAssetFromPg,
  fetchPartnerMarketingBannerBrandFromPg,
  findActivePartnerMarketingBannerFromPg,
  findGeneratingPartnerMarketingBannerFromPg,
  findLatestPartnerMarketingBannerFromPg,
  insertPartnerMarketingBannerAssetFromPg,
  partnerShopHasLiveCustomDomainFromPg,
} from '@/lib/db/messaging-partner-marketing-banner-pg'
import { GEMINI_25_FLASH_NO_THINKING, GEMINI_3_PRO_IMAGE } from '@/lib/gemini-config'
import { deductUserCredits } from '@/lib/music/deduct-user-credits'
import { normalizeTemplateTheme } from '@/lib/partner-website/template/default-landing-v1'
import { resolveShopThemeColors } from '@/lib/partner-website/template/partner-website-theme-tokens'
import {
  buildPartnerMarketingBannerPrompt,
  fallbackPartnerMarketingBannerCopy,
  newPartnerMarketingBannerRegularCampaignKey,
  PARTNER_MARKETING_BANNER_ASPECT,
  PARTNER_MARKETING_BANNER_CREDIT_COST,
  partnerMarketingBannerCampaignKey,
  partnerMarketingBannerDateKeyForKind,
  partnerMarketingBannerStoragePath,
  type PartnerMarketingBannerBrand,
  type PartnerMarketingBannerCopy,
  type PartnerMarketingBannerKind,
} from '@/lib/partner-website/promotions/partner-marketing-banner'
import { probePartnerBunnyStorageWrite, uploadPartnerBunnyObject } from '@/lib/storage/partner-bunny-cdn'
import { notifyNanoAiAdminsMarketingImageBlocked } from '@/lib/partner-website/promotions/partner-marketing-image-admin-notify'
import {
  PARTNER_MARKETING_IMAGE_ATTEMPT_CAP_ERROR,
  PARTNER_MARKETING_IMAGE_SHOP_NOT_LIVE_ERROR,
  partnerMarketingImageAttemptsExhausted,
} from '@/lib/partner-website/promotions/partner-marketing-image-guard'
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

export async function loadPartnerMarketingBannerBrand(
  partnerId: string
): Promise<PartnerMarketingBannerBrand> {
  const raw = await fetchPartnerMarketingBannerBrandFromPg(partnerId)
  const theme = resolveShopThemeColors(normalizeTemplateTheme(raw?.themeJson, raw?.logoUrl))
  return {
    shopName: raw?.shopName || 'Shop',
    industryKey: raw?.industryKey ?? null,
    primaryColor: theme.primaryColor,
    accentColor: theme.accentColor,
    buyButtonColor: theme.buyButtonColor,
    logoUrl: raw?.logoUrl ?? null,
  }
}

export async function generatePartnerMarketingBannerCopy(input: {
  kind: PartnerMarketingBannerKind
  day: number
  month: number
  discountPercent: number
  version: number
  apiKey: string
}): Promise<PartnerMarketingBannerCopy> {
  const fallback = fallbackPartnerMarketingBannerCopy(input)
  try {
    const genAI = new GoogleGenerativeAI(input.apiKey)
    const model = genAI.getGenerativeModel({
      model: GEMINI_25_FLASH_NO_THINKING.model,
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 1.1,
      },
    })
    const label = `${String(input.day).padStart(2, '0')}/${String(input.month).padStart(2, '0')}`
    const campaign =
      input.kind === 'sale'
        ? `sale ngày trùng tháng ${input.day}.${input.month}, giảm thật ${input.discountPercent}%`
        : input.kind === 'warehouse'
          ? `sale kho thanh lý, giảm thật ${input.discountPercent}%, hàng hoàn trong kho`
          : input.kind === 'regular'
            ? `banner cửa hàng thường, không ghi ngày sale hay phần trăm giảm`
            : `sinh nhật khách ngày ${label}, quà giảm giá ${input.discountPercent}%`
    const prompt =
      'Bạn là copywriter thương mại điện tử. ' +
      `Sáng tác nội dung mới cho banner ${campaign}. Đây là lần tạo phiên bản ${input.version}. ` +
      'Trả về đúng JSON gồm verse, cta, art_direction. ' +
      'verse là một câu có nhịp/vần tự nhiên, 7-12 từ, không sáo rỗng, không lặp lại ngày hoặc %. ' +
      'cta 2-5 từ, thúc đẩy hành động nhưng không gây hiểu nhầm. ' +
      'art_direction mô tả phong cách hình ảnh độc đáo trong tối đa 12 từ. ' +
      'Không thêm mức giảm, thời hạn hay điều kiện không được cung cấp.'
    const result = await model.generateContent(prompt)
    const text = result.response.text()
    const parsed = JSON.parse(text) as Partial<PartnerMarketingBannerCopy>
    const verse = String(parsed.verse || '').replace(/\s+/g, ' ').trim()
    const cta = String(parsed.cta || '').replace(/\s+/g, ' ').trim()
    const art = String(parsed.art_direction || '').replace(/\s+/g, ' ').trim()
    if (!(verse.length >= 8 && verse.length <= 100 && cta.length >= 3 && cta.length <= 40)) {
      return fallback
    }
    return { verse, cta: cta.toUpperCase(), art_direction: art.slice(0, 120) || fallback.art_direction }
  } catch (e) {
    console.warn('[generatePartnerMarketingBannerCopy]', e)
    return fallback
  }
}

async function generateBannerImageBytes(input: {
  prompt: string
  apiKey: string
  userId?: string | null
}): Promise<Buffer> {
  const genAI = new GoogleGenerativeAI(input.apiKey)
  const model = genAI.getGenerativeModel({
    model: GEMINI_3_PRO_IMAGE.model,
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
      imageConfig: { imageSize: '2K', aspectRatio: PARTNER_MARKETING_BANNER_ASPECT },
    },
  })
  const result = await model.generateContent([{ text: input.prompt }], { safetySettings: SAFETY } as never)
  trackFromUsageMetadata(
    result.response.usageMetadata,
    GEMINI_3_PRO_IMAGE.model,
    'partner-marketing-banner',
    input.userId,
    '2K'
  )
  const imagePart = result.response.candidates?.[0]?.content?.parts?.find((part) => 'inlineData' in part)
  if (!imagePart || !('inlineData' in imagePart) || !imagePart.inlineData?.data) {
    throw new Error('AI không trả về ảnh banner hợp lệ.')
  }
  return Buffer.from(imagePart.inlineData.data, 'base64')
}

/** JPEG cạnh dài 1600 — điện thoại decode được, cùng trần hiển thị banner shop. */
const BANNER_JPEG_MAX_EDGE = 1600
const BANNER_JPEG_MAX_BYTES = 1_500_000

export async function preparePartnerMarketingBannerJpeg(bytes: Buffer): Promise<Buffer> {
  const sharp = (await import('sharp')).default
  const input = { failOn: 'none' as const, limitInputPixels: 40_000_000 }
  const encode = (edge: number, quality: number) =>
    sharp(bytes, input)
      .rotate()
      .resize({ width: edge, height: edge, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality, mozjpeg: true })
      .toBuffer()
  let out = await encode(BANNER_JPEG_MAX_EDGE, 82)
  if (out.length > BANNER_JPEG_MAX_BYTES) out = await encode(1200, 70)
  if (out.length < 32) throw new Error('Không nén được ảnh banner.')
  return out
}

export async function generatePartnerMarketingBanner(input: {
  partnerId: string
  kind: PartnerMarketingBannerKind
  day?: number
  month?: number
  discountPercent: number
  campaignKey?: string | null
  force?: boolean
  actorUserId?: string | null
  chargeCredits?: boolean
}): Promise<
  | { ok: true; asset: NonNullable<Awaited<ReturnType<typeof completePartnerMarketingBannerAssetFromPg>>> }
  | { ok: false; error: string; status?: number; code?: 'shop_not_live' | 'attempt_cap' }
> {
  const day = Number.isFinite(input.day) ? Number(input.day) : 0
  const month = Number.isFinite(input.month) ? Number(input.month) : 0
  const key =
    input.kind === 'regular'
      ? String(input.campaignKey ?? '').trim() || newPartnerMarketingBannerRegularCampaignKey()
      : partnerMarketingBannerCampaignKey(input.kind, day, month, input.discountPercent)
  if (!input.force && input.kind !== 'regular') {
    const existing = await findActivePartnerMarketingBannerFromPg({
      partnerId: input.partnerId,
      kind: input.kind,
      day,
      month,
      discountPercent: input.discountPercent,
    })
    if (existing) return { ok: true, asset: existing }
  }
  if (!input.force && input.kind === 'regular' && String(input.campaignKey ?? '').trim()) {
    const latestSame = await findLatestPartnerMarketingBannerFromPg({
      partnerId: input.partnerId,
      kind: 'regular',
      campaignKey: key,
    })
    if (latestSame?.status === 'ready' && latestSame.image_url && latestSame.is_active) {
      return { ok: true, asset: latestSame }
    }
  }
  if (!(await partnerShopHasLiveCustomDomainFromPg(input.partnerId))) {
    return { ok: false, error: PARTNER_MARKETING_IMAGE_SHOP_NOT_LIVE_ERROR, status: 403, code: 'shop_not_live' }
  }
  const generating = await findGeneratingPartnerMarketingBannerFromPg({
    partnerId: input.partnerId,
    kind: input.kind,
    campaignKey: key,
  })
  if (generating) {
    const started = Date.parse(generating.created_at)
    const stale = !Number.isFinite(started) || Date.now() - started >= 20 * 60 * 1000
    if (!stale) return { ok: false, error: 'Banner này đang được tạo.', status: 409 }
    await failPartnerMarketingBannerAssetFromPg({
      id: generating.id,
      errorMessage: 'Tạo banner bị treo (generating quá hạn).',
    })
  }

  if (input.kind !== 'regular' || String(input.campaignKey ?? '').trim()) {
    const attempts = await countFailedPartnerMarketingBannerAiAttemptsFromPg({
      partnerId: input.partnerId,
      kind: input.kind,
      campaignKey: key,
    })
    if (partnerMarketingImageAttemptsExhausted(attempts.count, input.force)) {
      await notifyNanoAiAdminsMarketingImageBlocked({
        partnerId: input.partnerId,
        kind: input.kind,
        campaignKey: key,
        lastError: attempts.lastError,
      })
      return { ok: false, error: PARTNER_MARKETING_IMAGE_ATTEMPT_CAP_ERROR, status: 429, code: 'attempt_cap' }
    }
  }

  const storage = await probePartnerBunnyStorageWrite(input.partnerId)
  if (!storage.ok) {
    const latestProbe = await findLatestPartnerMarketingBannerFromPg({
      partnerId: input.partnerId,
      kind: input.kind,
      campaignKey: key,
    })
    const probeRow = await insertPartnerMarketingBannerAssetFromPg({
      partnerId: input.partnerId,
      kind: input.kind,
      campaignKey: key,
      dateKey: partnerMarketingBannerDateKeyForKind(input.kind, day, month),
      discountPercent: input.discountPercent,
      prompt: 'storage-probe',
      model: 'storage-probe',
      version: (latestProbe?.version ?? 0) + 1,
      source: 'ai',
    })
    if (probeRow) {
      await failPartnerMarketingBannerAssetFromPg({ id: probeRow.id, errorMessage: storage.error })
    }
    return { ok: false, error: storage.error, status: 500 }
  }

  if (input.chargeCredits) {
    if (!input.actorUserId) {
      return { ok: false, error: 'Không trừ được credit vì shop chưa có chủ tài khoản.', status: 402 }
    }
    try {
      const balance = await getCreditBalanceByUserId(input.actorUserId)
      if (toTenths(balance) < toTenths(PARTNER_MARKETING_BANNER_CREDIT_COST)) {
        return { ok: false, error: 'Không đủ credits để tạo banner AI.', status: 402 }
      }
    } catch {
      return { ok: false, error: 'Không đọc được số dư credits.', status: 402 }
    }
  }

  const { apiKey } = await requireGoogleApiKeyForUser(input.actorUserId)
  const latest = await findLatestPartnerMarketingBannerFromPg({
    partnerId: input.partnerId,
    kind: input.kind,
    campaignKey: key,
  })
  const version = (latest?.version ?? 0) + 1
  const brand = await loadPartnerMarketingBannerBrand(input.partnerId)
  const copy = await generatePartnerMarketingBannerCopy({
    kind: input.kind,
    day,
    month,
    discountPercent: input.discountPercent,
    version,
    apiKey,
  })
  const prompt = buildPartnerMarketingBannerPrompt({
    kind: input.kind,
    day,
    month,
    discountPercent: input.discountPercent,
    brand,
    copy,
  })
  const row = await insertPartnerMarketingBannerAssetFromPg({
    partnerId: input.partnerId,
    kind: input.kind,
    campaignKey: key,
    dateKey: partnerMarketingBannerDateKeyForKind(input.kind, day, month),
    discountPercent: input.discountPercent,
    prompt,
    model: GEMINI_3_PRO_IMAGE.model,
    version,
    source: 'ai',
  })
  if (!row) return { ok: false, error: 'Không tạo được bản ghi banner.', status: 500 }

  try {
    const raw = await generateBannerImageBytes({
      prompt,
      apiKey,
      userId: input.actorUserId,
    })
    const bytes = await preparePartnerMarketingBannerJpeg(raw)
    const digest = bytes.subarray(0, 12).toString('hex')
    const path = partnerMarketingBannerStoragePath({
      partnerId: input.partnerId,
      kind: input.kind,
      campaignKey: key,
      fileName: `v${version}-${Date.now()}-${digest}.jpg`,
    })
    const { publicUrl } = await uploadPartnerBunnyObject(input.partnerId, path, bytes, 'image/jpeg')
    const ready = await completePartnerMarketingBannerAssetFromPg({
      id: row.id,
      partnerId: input.partnerId,
      kind: input.kind,
      campaignKey: key,
      imageUrl: publicUrl,
    })
    if (!ready) return { ok: false, error: 'Không lưu được ảnh banner.', status: 500 }
    if (input.chargeCredits && input.actorUserId) {
      const deducted = await deductUserCredits(input.actorUserId, PARTNER_MARKETING_BANNER_CREDIT_COST, 'partner-marketing-banner')
      if (!deducted.ok) {
        return { ok: false, error: deducted.error, status: deducted.code === 'INSUFFICIENT_CREDITS' ? 402 : 500 }
      }
    }
    return { ok: true, asset: ready }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    await failPartnerMarketingBannerAssetFromPg({ id: row.id, errorMessage: message })
    return { ok: false, error: message, status: 500 }
  }
}

export async function uploadPartnerMarketingBannerImage(input: {
  partnerId: string
  kind: PartnerMarketingBannerKind
  day?: number
  month?: number
  discountPercent: number
  campaignKey?: string | null
  file: Buffer
  contentType: string
}): Promise<{ ok: true; asset: NonNullable<Awaited<ReturnType<typeof completePartnerMarketingBannerAssetFromPg>>> } | { ok: false; error: string; status?: number }> {
  const day = Number.isFinite(input.day) ? Number(input.day) : 0
  const month = Number.isFinite(input.month) ? Number(input.month) : 0
  const key =
    input.kind === 'regular'
      ? String(input.campaignKey ?? '').trim() || newPartnerMarketingBannerRegularCampaignKey()
      : partnerMarketingBannerCampaignKey(input.kind, day, month, input.discountPercent)
  const latest = await findLatestPartnerMarketingBannerFromPg({
    partnerId: input.partnerId,
    kind: input.kind,
    campaignKey: key,
  })
  const version = (latest?.version ?? 0) + 1
  const row = await insertPartnerMarketingBannerAssetFromPg({
    partnerId: input.partnerId,
    kind: input.kind,
    campaignKey: key,
    dateKey: partnerMarketingBannerDateKeyForKind(input.kind, day, month),
    discountPercent: input.discountPercent,
    prompt: 'uploaded',
    model: 'upload',
    version,
    source: 'upload',
  })
  if (!row) return { ok: false, error: 'Không tạo được bản ghi banner.', status: 500 }
  try {
    const bytes = await preparePartnerMarketingBannerJpeg(input.file)
    const path = partnerMarketingBannerStoragePath({
      partnerId: input.partnerId,
      kind: input.kind,
      campaignKey: key,
      fileName: `v${version}-${Date.now()}-upload.jpg`,
    })
    const { publicUrl } = await uploadPartnerBunnyObject(input.partnerId, path, bytes, 'image/jpeg')
    const ready = await completePartnerMarketingBannerAssetFromPg({
      id: row.id,
      partnerId: input.partnerId,
      kind: input.kind,
      campaignKey: key,
      imageUrl: publicUrl,
    })
    if (!ready) return { ok: false, error: 'Không lưu được ảnh tải lên.', status: 500 }
    return { ok: true, asset: ready }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    await failPartnerMarketingBannerAssetFromPg({ id: row.id, errorMessage: message })
    return { ok: false, error: message, status: 500 }
  }
}
