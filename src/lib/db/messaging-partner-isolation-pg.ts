import { isPgConfigured } from '@/lib/db/pool'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'
import {
  isPartnerIsolationAckId,
  isolationUrlTiedToOtherProject,
  type PartnerIsolationAckId,
  type PartnerIsolationFacts,
} from '@/lib/partner-website/shop/partner-shop-isolation'

function asBool(value: unknown): boolean {
  return value === true || value === 't' || value === 'true'
}

function asText(value: unknown): string {
  return String(value ?? '').trim()
}

function readAck(value: unknown): Partial<Record<PartnerIsolationAckId, boolean>> {
  let raw = value
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw) as unknown
    } catch {
      raw = null
    }
  }
  if (!raw || typeof raw !== 'object') return {}
  const record = raw as Record<string, unknown>
  const ack: Partial<Record<PartnerIsolationAckId, boolean>> = {}
  for (const [key, flag] of Object.entries(record)) {
    if (isPartnerIsolationAckId(key) && flag === true) ack[key] = true
  }
  return ack
}

export async function loadPartnerIsolationFactsFromPg(partnerId: string): Promise<PartnerIsolationFacts | null> {
  const pid = String(partnerId || '').trim()
  if (!isPgConfigured() || !pid) return null
  try {
    const row = await pgQueryOne<Record<string, unknown>>(
      `select
          p.id::text as id,
          lower(btrim(coalesce(nullif(btrim(p.brand_name), ''), p.display_name, ''))) as brand_key,
          regexp_replace(coalesce(p.contact_phone, ''), '[^0-9]', '', 'g') as phone_key,
          upper(btrim(coalesce(p.google_ads_id, ''))) as ads_key,
          upper(btrim(coalesce(p.ga4_measurement_id, ''))) as ga4_key,
          upper(btrim(coalesce(p.gtm_container_id, ''))) as gtm_key,
          lower(btrim(coalesce(p.facebook_pixel_id, ''))) as meta_key,
          lower(btrim(coalesce(p.tiktok_pixel_id, ''))) as tiktok_key,
          coalesce(p.external_shop_origin, '') as external_origin,
          coalesce(p.logo_url, '') as logo_url,
          coalesce(p.isolation_ack_json, '{}'::jsonb) as ack,
          coalesce(w.logo_url, '') as website_logo,
          coalesce(w.theme_json->>'faviconUrl', '') as favicon_url,
          coalesce(w.theme_json->>'pwaIconUrl', '') as pwa_icon_url,
          coalesce(w.theme_json->>'chatIconLogoUrl', '') as chat_icon_url,
          coalesce((
            select lower(btrim(d.hostname))
              from public.messaging_partner_custom_domains d
             where d.partner_id = p.id
               and d.ssl_status = 'ssl_active'
             limit 1
          ), '') as domain_host,
          exists (
            select 1
              from public.messaging_partner_custom_domains d
              join public.messaging_partner_custom_domains o
                on lower(btrim(d.hostname)) = lower(btrim(o.hostname))
               and o.partner_id <> d.partner_id
             where d.partner_id = p.id
               and d.ssl_status = 'ssl_active'
          ) as domain_shared,
          exists (
            select 1
              from public.messaging_partners o
             where o.id <> p.id
               and length(lower(btrim(coalesce(nullif(btrim(p.brand_name), ''), p.display_name, '')))) >= 2
               and lower(btrim(coalesce(nullif(btrim(o.brand_name), ''), o.display_name, '')))
                   = lower(btrim(coalesce(nullif(btrim(p.brand_name), ''), p.display_name, '')))
          ) as brand_shared,
          exists (
            select 1
              from public.messaging_partners o
             where o.id <> p.id
               and length(regexp_replace(coalesce(p.contact_phone, ''), '[^0-9]', '', 'g')) >= 8
               and regexp_replace(coalesce(o.contact_phone, ''), '[^0-9]', '', 'g')
                   = regexp_replace(coalesce(p.contact_phone, ''), '[^0-9]', '', 'g')
          ) as phone_shared,
          coalesce((
            select regexp_replace(coalesce(pay.account_number, ''), '[^0-9]', '', 'g')
              from public.messaging_partner_payment_settings pay
             where pay.partner_id = p.id
             limit 1
          ), '') as bank_key,
          exists (
            select 1
              from public.messaging_partner_payment_settings mine
              join public.messaging_partner_payment_settings o
                on o.partner_id <> mine.partner_id
             where mine.partner_id = p.id
               and length(regexp_replace(coalesce(mine.account_number, ''), '[^0-9]', '', 'g')) >= 6
               and regexp_replace(coalesce(o.account_number, ''), '[^0-9]', '', 'g')
                   = regexp_replace(coalesce(mine.account_number, ''), '[^0-9]', '', 'g')
          ) as bank_shared,
          coalesce((
            select regexp_replace(coalesce(pay.sepay_account_number, ''), '[^0-9]', '', 'g')
              from public.messaging_partner_payment_settings pay
             where pay.partner_id = p.id
             limit 1
          ), '') as sepay_key,
          exists (
            select 1
              from public.messaging_partner_payment_settings mine
              join public.messaging_partner_payment_settings o
                on o.partner_id <> mine.partner_id
             where mine.partner_id = p.id
               and length(regexp_replace(coalesce(mine.sepay_account_number, ''), '[^0-9]', '', 'g')) >= 6
               and regexp_replace(coalesce(o.sepay_account_number, ''), '[^0-9]', '', 'g')
                   = regexp_replace(coalesce(mine.sepay_account_number, ''), '[^0-9]', '', 'g')
          ) as sepay_shared,
          coalesce((
            select lower(btrim(coalesce(ai.after_sales_return_address, '')))
              from public.messaging_partner_ai_settings ai
             where ai.partner_id = p.id
             limit 1
          ), '') as return_key,
          exists (
            select 1
              from public.messaging_partner_ai_settings mine
              join public.messaging_partner_ai_settings o
                on o.partner_id <> mine.partner_id
             where mine.partner_id = p.id
               and length(btrim(coalesce(mine.after_sales_return_address, ''))) >= 8
               and lower(btrim(coalesce(o.after_sales_return_address, '')))
                   = lower(btrim(coalesce(mine.after_sales_return_address, '')))
          ) as return_shared,
          exists (
            select 1 from public.messaging_partners o
             where o.id <> p.id
               and length(btrim(coalesce(p.google_ads_id, ''))) >= 4
               and upper(btrim(coalesce(o.google_ads_id, ''))) = upper(btrim(coalesce(p.google_ads_id, '')))
          ) as ads_shared,
          exists (
            select 1 from public.messaging_partners o
             where o.id <> p.id
               and length(btrim(coalesce(p.ga4_measurement_id, ''))) >= 4
               and upper(btrim(coalesce(o.ga4_measurement_id, ''))) = upper(btrim(coalesce(p.ga4_measurement_id, '')))
          ) as ga4_shared,
          exists (
            select 1 from public.messaging_partners o
             where o.id <> p.id
               and length(btrim(coalesce(p.gtm_container_id, ''))) >= 4
               and upper(btrim(coalesce(o.gtm_container_id, ''))) = upper(btrim(coalesce(p.gtm_container_id, '')))
          ) as gtm_shared,
          exists (
            select 1 from public.messaging_partners o
             where o.id <> p.id
               and length(btrim(coalesce(p.facebook_pixel_id, ''))) > 0
               and lower(btrim(coalesce(o.facebook_pixel_id, ''))) = lower(btrim(coalesce(p.facebook_pixel_id, '')))
          ) as meta_shared,
          exists (
            select 1 from public.messaging_partners o
             where o.id <> p.id
               and length(btrim(coalesce(p.tiktok_pixel_id, ''))) > 0
               and lower(btrim(coalesce(o.tiktok_pixel_id, ''))) = lower(btrim(coalesce(p.tiktok_pixel_id, '')))
          ) as tiktok_shared,
          coalesce((
            select count(*)::int
              from public.messaging_partner_inventory inv
             where inv.partner_id = p.id
          ), 0) as inventory_count,
          coalesce((
            select count(*)::int
              from public.messaging_partner_inventory inv
             where inv.partner_id = p.id
               and (
                 (coalesce(inv.image_url, '') || ' ' || coalesce(inv.gallery_urls::text, '') || ' ' || coalesce(inv.detail_image_urls::text, ''))
                   ~* '188comvn|cdn\\.188\\.com\\.vn|(^|//|\\.)(www\\.)?188\\.com\\.vn'
                 or (
                   (coalesce(inv.image_url, '') || coalesce(inv.gallery_urls::text, '') || coalesce(inv.detail_image_urls::text, ''))
                     ~* 'messaging-partner/[0-9a-f]{8}-'
                   and (coalesce(inv.image_url, '') || coalesce(inv.gallery_urls::text, '') || coalesce(inv.detail_image_urls::text, ''))
                     !~* ('messaging-partner/' || p.id::text)
                 )
               )
          ), 0) as foreign_image_count
        from public.messaging_partners p
        left join public.messaging_partner_websites w on w.partner_id = p.id
       where p.id = $1::uuid
       limit 1`,
      [pid]
    )
    if (!row) return null
    const assetUrls = [
      asText(row.external_origin),
      asText(row.logo_url),
      asText(row.website_logo),
      asText(row.favicon_url),
      asText(row.pwa_icon_url),
      asText(row.chat_icon_url),
    ]
    return {
      brandKey: asText(row.brand_key),
      brandShared: asBool(row.brand_shared),
      domainHost: asText(row.domain_host),
      domainShared: asBool(row.domain_shared),
      phoneKey: asText(row.phone_key),
      phoneShared: asBool(row.phone_shared),
      bankKey: asText(row.bank_key),
      bankShared: asBool(row.bank_shared),
      sepayKey: asText(row.sepay_key),
      sepayShared: asBool(row.sepay_shared),
      returnKey: asText(row.return_key),
      returnShared: asBool(row.return_shared),
      adsKey: asText(row.ads_key),
      adsShared: asBool(row.ads_shared),
      ga4Key: asText(row.ga4_key),
      ga4Shared: asBool(row.ga4_shared),
      gtmKey: asText(row.gtm_key),
      gtmShared: asBool(row.gtm_shared),
      metaKey: asText(row.meta_key),
      metaShared: asBool(row.meta_shared),
      tiktokKey: asText(row.tiktok_key),
      tiktokShared: asBool(row.tiktok_shared),
      inventoryCount: Number(row.inventory_count) || 0,
      foreignImageCount: Number(row.foreign_image_count) || 0,
      foreignBrandAsset: assetUrls.some((url) => isolationUrlTiedToOtherProject(url, pid)),
      ack: readAck(row.ack),
    }
  } catch (error) {
    console.warn('[loadPartnerIsolationFactsFromPg]', error)
    return null
  }
}

export async function savePartnerIsolationAckFromPg(
  partnerId: string,
  ackId: PartnerIsolationAckId,
  done: boolean
): Promise<boolean> {
  const pid = String(partnerId || '').trim()
  if (!isPgConfigured() || !pid) return false
  const rows = await pgQuery<{ id: string }>(
    `update public.messaging_partners
        set isolation_ack_json = jsonb_set(
              coalesce(isolation_ack_json, '{}'::jsonb),
              array[$2::text],
              to_jsonb($3::boolean),
              true
            ),
            updated_at = now()
      where id = $1::uuid
      returning id::text as id`,
    [pid, ackId, done]
  )
  return Boolean(rows[0]?.id)
}
