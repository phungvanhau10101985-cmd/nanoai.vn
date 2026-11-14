import { purgeStaleWidgetAutoOpeningConversationsPg } from '@/lib/db/customer-care-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { emailUnsolvedHomeworkDigest } from '@/lib/homework-help/homework-help-unsolved'
import { runInventoryEmbedBackfill } from '@/lib/messaging/inventory-embed-backfill-cron'
import { runPartnerOrderFulfillmentCron } from '@/lib/messaging/fulfillment/order-fulfillment-service'
import { sweepImageLocProbes } from '@/lib/messaging/image-localization/probe-run'
import { resumeImageLocalizationAfterRestart } from '@/lib/messaging/image-localization/job-runtime'
import { resumeListingImportQueuesAfterRestart } from '@/lib/messaging/listing-import/listing-import-queue'
import { runMessagingPartnerAiJobBatch } from '@/lib/messaging/partner-ai-run-jobs'
import { runPartnerBirthdayPromoBatchAll } from '@/lib/messaging/partner-birthday-promo-batch'
import { runPartnerMarketingCampaignBatch } from '@/lib/messaging/partner-marketing-run-jobs'
import { runPartnerOrderReviewReminderBatch } from '@/lib/messaging/partner-order-review-reminder'
import { runPartnerPromotionMaintenance } from '@/lib/messaging/partner-promotion-auto-grant'
import { runPartnerCustomDomainSslWorker } from '@/lib/messaging/partner-custom-domain-ssl-worker'
import { resumeSourceStockAfterRestart } from '@/lib/messaging/source-stock-check/worker'
import { processPendingBunnyDeletesFromPg } from '@/lib/db/messaging-partner-pending-bunny-deletes-pg'
import { bunnyDeleteOnProductDeleteEnabled } from '@/lib/messaging/inventory-bunny-delete'
import { partnerBunnyAccountConfigured, provisionMissingPartnerBunnyCdns } from '@/lib/storage/partner-bunny-cdn'
import { runLadipageOnViewBatch } from '@/lib/partner-website/landing/ladipage-on-view'
import { ensureDailyPartnerMarketingBanners } from '@/lib/partner-website/promotions/partner-marketing-banner-cron'
import { warmPublishedShopOutfitPicks } from '@/lib/partner-website/shop/pdp-outfit-suggestions'

export { runCustomerNotificationCron } from '@/lib/cron/customer-notification-cron'
export { runLogoCleanupCron } from '@/lib/cron/logo-cleanup-cron'
export { runWeddingReminderCron } from '@/lib/cron/wedding-reminder-cron'

function dbSkipped() {
  return { skipped: 'no-db' as const }
}

export async function runPartnerAiCron() {
  if (!isPgConfigured()) return dbSkipped()
  const stats = await runMessagingPartnerAiJobBatch(15)
  const prunedAutoOpeningConversations = await purgeStaleWidgetAutoOpeningConversationsPg(30, 500)
  return { ...stats, prunedAutoOpeningConversations }
}

export async function runListingImportResumeCron() {
  if (!isPgConfigured()) return dbSkipped()
  return resumeListingImportQueuesAfterRestart()
}

export async function runSourceStockResumeCron() {
  if (!isPgConfigured()) return dbSkipped()
  return resumeSourceStockAfterRestart()
}

export async function runImageLocalizationResumeCron() {
  if (!isPgConfigured()) return dbSkipped()
  const out = await resumeImageLocalizationAfterRestart()
  const probes = await sweepImageLocProbes().catch((error) => {
    console.error('[shop-cron] image-localization probe sweep', error)
    return { expired: 0, stale: 0 }
  })
  return { ...out, probes }
}

export async function runBunnyCdnProvisionCron() {
  if (!isPgConfigured()) return dbSkipped()
  if (!partnerBunnyAccountConfigured()) return { skipped: true, reason: 'missing BUNNY_ACCOUNT_API_KEY' }
  const results = await provisionMissingPartnerBunnyCdns(1)
  return {
    count: results.length,
    provisioned: results.filter((row) => row.ok).map((row) => row.slug),
    failed: results.filter((row) => !row.ok).map((row) => ({ slug: row.slug, error: row.error || '' })),
  }
}

export async function runOutfitPicksCron() {
  if (!isPgConfigured()) return dbSkipped()
  return warmPublishedShopOutfitPicks(6)
}

export async function runLadipageOnViewCron() {
  if (!isPgConfigured()) return dbSkipped()
  return runLadipageOnViewBatch(1)
}

export async function runMarketingCampaignCron() {
  if (!isPgConfigured()) return dbSkipped()
  return runPartnerMarketingCampaignBatch()
}

export async function runCustomDomainSslCron() {
  return runPartnerCustomDomainSslWorker(5)
}

export async function runBunnyDeleteCron() {
  if (!bunnyDeleteOnProductDeleteEnabled()) {
    return { skipped: true, reason: 'BUNNY_DELETE_ON_PRODUCT_DELETE=false' }
  }
  if (!isPgConfigured()) return dbSkipped()
  try {
    return await processPendingBunnyDeletesFromPg()
  } catch (e) {
    const code = e && typeof e === 'object' && 'code' in e ? String((e as { code?: string }).code) : ''
    if (code === '42P01') return { skipped: true, reason: 'table_missing' }
    throw e
  }
}

export async function runMarketingBannersCron(maxGenerate?: number) {
  if (!isPgConfigured()) return dbSkipped()
  return ensureDailyPartnerMarketingBanners({
    maxGenerate: maxGenerate && maxGenerate > 0 ? maxGenerate : undefined,
  })
}

export async function runOrderShipmentCron() {
  if (!isPgConfigured()) return dbSkipped()
  return runPartnerOrderFulfillmentCron()
}

export async function runReviewReminderCron() {
  if (!isPgConfigured()) return dbSkipped()
  return runPartnerOrderReviewReminderBatch()
}

export async function runInventoryEmbedCron() {
  return runInventoryEmbedBackfill()
}

export async function runEmailDailyCron() {
  if (!isPgConfigured()) return dbSkipped()
  const birthday = await runPartnerBirthdayPromoBatchAll()
  const promotions = await runPartnerPromotionMaintenance()
  return { birthday, promotions }
}

export async function runHomeworkDigestCron() {
  if (!isPgConfigured()) return dbSkipped()
  return { digest: await emailUnsolvedHomeworkDigest() }
}
