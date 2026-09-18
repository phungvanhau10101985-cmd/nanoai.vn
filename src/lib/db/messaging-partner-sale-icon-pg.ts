import { isPgConfigured } from '@/lib/db/pool'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'
import type { PartnerSaleIconAsset } from '@/lib/partner-website/promotions/partner-sale-icon'

type SaleIconDbRow = {
  id: string
  day: number
  month: number
  discount_percent: string | number
  image_url: string | null
  source_favicon_url: string | null
  source_pwa_icon_url: string | null
  status: 'generating' | 'ready' | 'failed'
  created_at?: string
  updated_at?: string
}

function mapRow(row: SaleIconDbRow | null): PartnerSaleIconAsset | null {
  if (!row) return null
  return {
    id: row.id,
    day: Number(row.day),
    month: Number(row.month),
    discountPercent: Number(row.discount_percent) || 0,
    imageUrl: row.image_url,
    status: row.status,
    sourceFaviconUrl: row.source_favicon_url,
    sourcePwaIconUrl: row.source_pwa_icon_url,
  }
}

export async function findPartnerSaleIconFromPg(input: {
  partnerId: string
  day: number
  month: number
}): Promise<(PartnerSaleIconAsset & { createdAt?: string }) | null> {
  if (!isPgConfigured()) return null
  const row = await pgQueryOne<SaleIconDbRow>(
    `select id::text, day, month, discount_percent, image_url, source_favicon_url,
            source_pwa_icon_url, status, created_at::text, updated_at::text
     from public.messaging_partner_sale_icons
     where partner_id = $1::uuid and day = $2 and month = $3
     limit 1`,
    [input.partnerId, input.day, input.month]
  ).catch(() => null)
  const mapped = mapRow(row)
  if (!mapped) return null
  return { ...mapped, createdAt: row?.created_at }
}

export async function findReadyPartnerSaleIconFromPg(input: {
  partnerId: string
  day: number
  month: number
}): Promise<PartnerSaleIconAsset | null> {
  const row = await findPartnerSaleIconFromPg(input)
  if (!row || row.status !== 'ready' || !row.imageUrl) return null
  return row
}

export async function insertGeneratingPartnerSaleIconFromPg(input: {
  partnerId: string
  day: number
  month: number
  discountPercent: number
  prompt: string
  model: string
  sourceFaviconUrl?: string | null
  sourcePwaIconUrl?: string | null
}): Promise<PartnerSaleIconAsset | null> {
  if (!isPgConfigured()) return null
  const row = await pgQueryOne<SaleIconDbRow>(
    `insert into public.messaging_partner_sale_icons (
       partner_id, day, month, discount_percent, prompt, model, status,
       source_favicon_url, source_pwa_icon_url, updated_at
     ) values ($1::uuid,$2,$3,$4,$5,$6,'generating',$7,$8,now())
     on conflict (partner_id, day, month) do update set
       discount_percent = excluded.discount_percent,
       prompt = excluded.prompt,
       model = excluded.model,
       status = 'generating',
       error_message = null,
       source_favicon_url = excluded.source_favicon_url,
       source_pwa_icon_url = excluded.source_pwa_icon_url,
       updated_at = now()
     returning id::text, day, month, discount_percent, image_url, source_favicon_url,
               source_pwa_icon_url, status`,
    [
      input.partnerId,
      input.day,
      input.month,
      input.discountPercent,
      input.prompt,
      input.model,
      input.sourceFaviconUrl ?? null,
      input.sourcePwaIconUrl ?? null,
    ]
  ).catch(() => null)
  return mapRow(row)
}

export async function completePartnerSaleIconFromPg(input: {
  id: string
  imageUrl: string
  sourceFaviconUrl?: string | null
  sourcePwaIconUrl?: string | null
}): Promise<PartnerSaleIconAsset | null> {
  if (!isPgConfigured()) return null
  const row = await pgQueryOne<SaleIconDbRow>(
    `update public.messaging_partner_sale_icons
     set image_url = $2, status = 'ready', error_message = null,
         source_favicon_url = coalesce($3, source_favicon_url),
         source_pwa_icon_url = coalesce($4, source_pwa_icon_url),
         updated_at = now()
     where id = $1::uuid
     returning id::text, day, month, discount_percent, image_url, source_favicon_url,
               source_pwa_icon_url, status`,
    [input.id, input.imageUrl, input.sourceFaviconUrl ?? null, input.sourcePwaIconUrl ?? null]
  ).catch(() => null)
  return mapRow(row)
}

export async function failPartnerSaleIconFromPg(input: {
  id: string
  errorMessage: string
}): Promise<void> {
  if (!isPgConfigured()) return
  await pgQuery(
    `update public.messaging_partner_sale_icons
     set status = 'failed', error_message = $2, updated_at = now()
     where id = $1::uuid`,
    [input.id, input.errorMessage.slice(0, 500)]
  ).catch(() => undefined)
}
