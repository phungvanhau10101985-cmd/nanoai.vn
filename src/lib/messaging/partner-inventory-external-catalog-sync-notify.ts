import { deliverUserNotificationPg } from '@/lib/notifications/deliver-user-notification-pg'
import { DEFAULT_WEB_LOCALE, type WebLocale } from '@/lib/i18n/config'
import { getDictionary } from '@/lib/i18n/dictionaries'

export type ExternalCatalogSyncReportStats = {
  fetched: number
  mappedRows: number
  remarketingInFeed: number
  skippedEmptyApi: boolean
}

export type ExternalCatalogSyncReportOutcome =
  | {
      ok: true
      inserted: number
      updated: number
      deleted: number
      embeddingsDeferred: boolean
    }
  | { ok: false; code: string; detail?: string }

function fillReportPlaceholders(s: string, vars: Record<string, string>): string {
  let out = s
  for (const [k, v] of Object.entries(vars)) {
    out = out.split(`{${k}}`).join(v)
  }
  return out
}

/**
 * Thông báo in-app + email SMTP + Web Push cho chủ shop sau mỗi lần đồng bộ GET kho khách.
 */
export async function notifyPartnerExternalCatalogSyncReport(params: {
  userId: string
  partnerId: string
  shopLabel: string
  locale?: WebLocale
  source: 'manual' | 'cron'
  outcome: ExternalCatalogSyncReportOutcome
  stats: ExternalCatalogSyncReportStats
}): Promise<void> {
  const locale = params.locale ?? DEFAULT_WEB_LOCALE
  const t = getDictionary(locale).partnerMessagingAi
  const time = new Date().toISOString()
  const sourceLabel =
    params.source === 'manual'
      ? t.inventoryExternalCatalogSyncReportSourceManual
      : t.inventoryExternalCatalogSyncReportSourceCron

  if (params.outcome.ok) {
    const o = params.outcome
    const embedNote = o.embeddingsDeferred
      ? t.inventoryExternalCatalogSyncReportEmbedDeferred
      : t.inventoryExternalCatalogSyncReportEmbedSync
    const extraNote = params.stats.skippedEmptyApi ? t.inventoryExternalCatalogSyncReportExtraEmptyApi : ''
    const body = fillReportPlaceholders(t.inventoryExternalCatalogSyncReportBodyOk, {
      time,
      source: sourceLabel,
      shop: params.shopLabel,
      fetched: String(params.stats.fetched),
      mapped: String(params.stats.mappedRows),
      remarketing: String(params.stats.remarketingInFeed),
      inserted: String(o.inserted),
      updated: String(o.updated),
      deleted: String(o.deleted),
      embedNote,
      extraNote,
    })
    await deliverUserNotificationPg({
      user_id: params.userId,
      type: 'partner_inventory_external_catalog_sync',
      title: t.inventoryExternalCatalogSyncReportTitleOk,
      body,
      meta: {
        push_url: '/dashboard/messaging/settings',
        partner_id: params.partnerId,
        sync_ok: true,
        fetched: params.stats.fetched,
        mapped: params.stats.mappedRows,
        remarketing_in_feed: params.stats.remarketingInFeed,
        skipped_empty_api: params.stats.skippedEmptyApi,
        inserted: o.inserted,
        updated: o.updated,
        deleted: o.deleted,
        embeddings_deferred: o.embeddingsDeferred,
      },
    })
    return
  }

  const o = params.outcome
  const detail = (o.detail ?? '').trim() || '—'
  const body = fillReportPlaceholders(t.inventoryExternalCatalogSyncReportBodyFail, {
    time,
    source: sourceLabel,
    shop: params.shopLabel,
    code: o.code,
    detail,
  })
  await deliverUserNotificationPg({
    user_id: params.userId,
    type: 'partner_inventory_external_catalog_sync',
    title: t.inventoryExternalCatalogSyncReportTitleFail,
    body,
    meta: {
      push_url: '/dashboard/messaging/settings',
      partner_id: params.partnerId,
      sync_ok: false,
      error_code: o.code,
      fetched: params.stats.fetched,
      mapped: params.stats.mappedRows,
      remarketing_in_feed: params.stats.remarketingInFeed,
    },
  })
}
