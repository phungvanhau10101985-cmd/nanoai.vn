import { isPgConfigured } from '@/lib/db/pool'
import { pgQueryOne } from '@/lib/db/pg-query'
import { countPartnerInventoryFromPg } from '@/lib/db/messaging-partner-inventory-pg'
import { fetchPartnerPaymentSettingsFromPg } from '@/lib/db/messaging-partner-orders-pg'
import { fetchMessagingPartnerAiSettingsFullFromPg } from '@/lib/db/messaging-partner-ai-settings-pg'
import {
  partnerPaymentReady,
  type PartnerGoLiveFacts,
} from '@/lib/partner-website/shop/partner-shop-go-live'

export async function loadPartnerGoLiveFactsFromPg(partnerId: string): Promise<PartnerGoLiveFacts | null> {
  const pid = String(partnerId || '').trim()
  if (!isPgConfigured() || !pid) return null
  try {
    const [partner, website, inventoryCount, payment, ai, domain] = await Promise.all([
    pgQueryOne<{
      display_name: string | null
      brand_name: string | null
      logo_url: string | null
      contact_phone: string | null
      contact_zalo_url: string | null
      facebook_pixel_id: string | null
      ga4_measurement_id: string | null
      tiktok_pixel_id: string | null
      gtm_container_id: string | null
    }>(
      `select display_name, brand_name, logo_url, contact_phone, contact_zalo_url,
              facebook_pixel_id, ga4_measurement_id, tiktok_pixel_id, gtm_container_id
         from public.messaging_partners
        where id = $1::uuid
        limit 1`,
      [pid]
    ),
    pgQueryOne<{
      is_published: boolean | null
      logo_url: string | null
      slogan: string | null
    }>(
      `select coalesce(is_published, false) as is_published,
              logo_url,
              nullif(trim(coalesce(theme_json->>'slogan', '')), '') as slogan
         from public.messaging_partner_websites
        where partner_id = $1::uuid
        limit 1`,
      [pid]
    ),
    countPartnerInventoryFromPg(pid),
    fetchPartnerPaymentSettingsFromPg(pid),
    fetchMessagingPartnerAiSettingsFullFromPg(pid),
    pgQueryOne<{ ok: boolean }>(
      `select exists(
          select 1
            from public.messaging_partner_custom_domains
           where partner_id = $1::uuid
             and ssl_status = 'ssl_active'
        ) as ok`,
      [pid]
    ),
  ])
  if (!partner) return null
  return {
    displayName: String(partner.display_name ?? '').trim(),
    brandName: String(partner.brand_name ?? '').trim(),
    logoUrl: String(partner.logo_url ?? '').trim(),
    contactPhone: String(partner.contact_phone ?? '').trim(),
    contactZaloUrl: String(partner.contact_zalo_url ?? '').trim(),
    facebookPixelId: String(partner.facebook_pixel_id ?? '').trim(),
    ga4MeasurementId: String(partner.ga4_measurement_id ?? '').trim(),
    tiktokPixelId: String(partner.tiktok_pixel_id ?? '').trim(),
    gtmContainerId: String(partner.gtm_container_id ?? '').trim(),
    websitePublished: website?.is_published === true,
    websiteExists: Boolean(website),
    slogan: String(website?.slogan ?? '').trim(),
    websiteLogoUrl: String(website?.logo_url ?? '').trim(),
    inventoryCount,
    hasPaymentSettings: Boolean(payment),
    paymentReady: partnerPaymentReady({
      depositMode: payment?.default_deposit_mode,
      accountNumber: payment?.account_number,
      accountHolder: payment?.account_holder,
      sepayEnabled: payment?.sepay_enabled,
      sepayBankCode: payment?.sepay_bank_code,
      sepayAccountNumber: payment?.sepay_account_number,
    }),
    sepayEnabled: payment?.sepay_enabled === true,
    sepayHmacConfigured: Boolean(String(payment?.sepay_secret_key ?? '').trim()),
    hasCustomDomain: domain?.ok === true || String(domain?.ok) === 't',
    returnAddress: String(ai?.after_sales_return_address ?? '').trim(),
  }
  } catch {
    return null
  }
}
