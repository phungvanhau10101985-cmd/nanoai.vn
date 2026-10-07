import {
  completePartnerSaleIconFromPg,
  failPartnerSaleIconFromPg,
  findPartnerSaleIconFromPg,
  insertGeneratingPartnerSaleIconFromPg,
} from '@/lib/db/messaging-partner-sale-icon-pg'
import {
  fetchPartnerMarketingBannerBrandFromPg,
  partnerShopHasLiveCustomDomainFromPg,
} from '@/lib/db/messaging-partner-marketing-banner-pg'
import { notifyNanoAiAdminsMarketingImageBlocked } from '@/lib/partner-website/promotions/partner-marketing-image-admin-notify'
import {
  PARTNER_MARKETING_IMAGE_ATTEMPT_CAP_ERROR,
  PARTNER_MARKETING_IMAGE_SHOP_NOT_LIVE_ERROR,
  partnerMarketingImageAttemptsExhausted,
} from '@/lib/partner-website/promotions/partner-marketing-image-guard'
import { composePartnerSaleIconPng } from '@/lib/partner-website/promotions/partner-sale-icon-compose'
import { normalizeTemplateTheme } from '@/lib/partner-website/template/default-landing-v1'
import { resolveShopThemeColors } from '@/lib/partner-website/template/partner-website-theme-tokens'
import {
  isPartnerSaleIconSameDayMonth,
  PARTNER_SALE_ICON_LAYOUT_ID,
  partnerSaleIconLayoutIsCurrent,
  partnerShopSaleIconSourceUrls,
} from '@/lib/partner-website/promotions/partner-sale-icon'
import { uploadPartnerBunnyObject } from '@/lib/storage/partner-bunny-cdn'

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim())
}

async function fetchMarkBuffer(urls: string[]): Promise<Buffer | null> {
  for (const url of urls) {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 8000)
    try {
      const res = await fetch(url, { signal: ctrl.signal, cache: 'no-store' })
      if (!res.ok) continue
      const buf = Buffer.from(await res.arrayBuffer())
      if (buf.length < 32 || buf.length > 4 * 1024 * 1024) continue
      return buf
    } catch {
      continue
    } finally {
      clearTimeout(timer)
    }
  }
  return null
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
  | { ok: false; error: string; status?: number; code?: 'shop_not_live' | 'attempt_cap' }
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
    partnerSaleIconLayoutIsCurrent(existing.prompt) &&
    existing.sourceFaviconUrl === sourceFav &&
    existing.sourcePwaIconUrl === sourcePwa
  ) {
    return { ok: true, asset: existing }
  }
  if (!(await partnerShopHasLiveCustomDomainFromPg(input.partnerId))) {
    return { ok: false, error: PARTNER_MARKETING_IMAGE_SHOP_NOT_LIVE_ERROR, status: 403, code: 'shop_not_live' }
  }
  if (
    existing &&
    existing.status !== 'ready' &&
    partnerMarketingImageAttemptsExhausted(existing.attemptCount, input.force)
  ) {
    await notifyNanoAiAdminsMarketingImageBlocked({
      partnerId: input.partnerId,
      kind: 'sale-icon',
      campaignKey: `sale-icon-${input.month}-${input.day}`,
      lastError: existing.errorMessage,
    })
    return { ok: false, error: PARTNER_MARKETING_IMAGE_ATTEMPT_CAP_ERROR, status: 429, code: 'attempt_cap' }
  }
  if (existing?.status === 'generating' && existing.createdAt) {
    const started = Date.parse(existing.createdAt)
    const stale = !Number.isFinite(started) || Date.now() - started >= 20 * 60 * 1000
    if (!stale) return { ok: false, error: 'Icon sale đang được tạo.', status: 409 }
  }

  const refs = partnerShopSaleIconSourceUrls({
    faviconUrl: sourceFav,
    pwaIconUrl: sourcePwa,
    logoUrl: sources.logoUrl,
  })
  if (!refs.length) {
    return { ok: false, error: 'Cần favicon hoặc ảnh đại diện web app trước.', status: 400 }
  }
  const row = await insertGeneratingPartnerSaleIconFromPg({
    partnerId: input.partnerId,
    day: input.day,
    month: input.month,
    discountPercent: input.discountPercent,
    prompt: PARTNER_SALE_ICON_LAYOUT_ID,
    model: 'sale-icon-composite',
    sourceFaviconUrl: sourceFav,
    sourcePwaIconUrl: sourcePwa,
  })
  if (!row) return { ok: false, error: 'Không tạo được bản ghi icon sale.', status: 500 }

  try {
    const mark = await fetchMarkBuffer(refs)
    if (!mark) throw new Error('Không đọc được favicon hoặc ảnh đại diện web app.')
    const bytes = await composePartnerSaleIconPng({ mark, day: input.day, month: input.month })
    const digest = bytes.subarray(0, 12).toString('hex')
    const path = `partners/${input.partnerId}/sale-icons/${input.month}-${input.day}-${Date.now()}-${digest}.png`
    const { publicUrl } = await uploadPartnerBunnyObject(input.partnerId, path, bytes, 'image/png')
    if (!isHttpUrl(publicUrl)) throw new Error('Không tải được icon sale lên kho.')
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
