import {
  insertListingImportDraftFromPg,
  updateListingImportDraftFromPg,
} from '@/lib/db/messaging-partner-listing-import-pg'
import {
  extract1688OfferId,
  extractTaobaoTmallItemId,
  normalizeProductImportUrl,
  parseTPrefixedItemId,
} from '@/lib/messaging/listing-import/import-source-ids'
import {
  extractPandamallDetail,
  extractVipomallOfferId,
  inferListingImportSource,
} from '@/lib/messaging/listing-import/listing-import-urls'
import { applyListingImportColorTranslation } from '@/lib/messaging/listing-import/listing-import-color-translate'
import { applyListingImportRatingGroups } from '@/lib/messaging/listing-import/listing-import-rating-groups'
import { applyListingImportTaxonomy } from '@/lib/messaging/listing-import/listing-import-taxonomy'
import { scrapePandamallForImport } from '@/lib/messaging/listing-import/pandamall-scraper'
import { mergeListingOverlayIntoProductData, preferListingChineseName } from '@/lib/messaging/listing-import/scrape-common'
import { scrapeVipomallForImport } from '@/lib/messaging/listing-import/vipomall-scraper'

function resolveOfferId(source: 'vipomall' | 'pandamall', url: string): string {
  if (source === 'pandamall') {
    return extractPandamallDetail(url)?.itemId || extract1688OfferId(url) || parseTPrefixedItemId(url) || extractTaobaoTmallItemId(url) || ''
  }
  return (
    extractVipomallOfferId(url) ||
    parseTPrefixedItemId(url) ||
    extractTaobaoTmallItemId(url) ||
    extract1688OfferId(url) ||
    ''
  )
}

export async function executeOneListingImport(input: {
  partnerId: string
  url: string
  source?: string | null
  overlay?: Record<string, unknown> | null
}): Promise<{
  ok: boolean
  job_id?: string
  draft_id?: string
  draft_status?: string
  message?: string
  errors?: string[]
  error?: string
}> {
  const sourceUrl = normalizeProductImportUrl((input.url || '').trim())
  if (sourceUrl.length < 10) {
    return { ok: false, error: 'URL quá ngắn sau khi chuẩn hoá.' }
  }
  const source = inferListingImportSource(sourceUrl, input.source)
  const offerId = resolveOfferId(source, sourceUrl)
  const jobId = crypto.randomUUID()
  const draft = await insertListingImportDraftFromPg({
    partnerId: input.partnerId,
    jobId,
    source,
    sourceUrl,
    sourceOfferId: offerId || null,
  })
  if (!draft) {
    return { ok: false, error: 'Không tạo được nháp import.' }
  }

  await updateListingImportDraftFromPg(input.partnerId, draft.id, {
    status: 'running',
    message: 'Đang cào dữ liệu…',
  })

  try {
    const scraped =
      source === 'pandamall'
        ? await scrapePandamallForImport(sourceUrl, input.partnerId)
        : await scrapeVipomallForImport(sourceUrl, input.partnerId)
    const productData = { ...scraped.productData }
    mergeListingOverlayIntoProductData(productData, input.overlay)
    preferListingChineseName(productData)
    const warnings = [...(scraped.warnings || [])]
    try {
      await applyListingImportColorTranslation(productData, warnings)
    } catch (e) {
      warnings.push(`color_translate: ${e instanceof Error ? e.message : String(e)}`)
    }
    try {
      await applyListingImportTaxonomy(input.partnerId, productData, warnings)
    } catch (e) {
      warnings.push(`taxonomy: ${e instanceof Error ? e.message : String(e)}`)
    }
    try {
      applyListingImportRatingGroups(productData, warnings)
    } catch (e) {
      warnings.push(`import_groups: ${e instanceof Error ? e.message : String(e)}`)
    }
    const updated = await updateListingImportDraftFromPg(input.partnerId, draft.id, {
      status: 'done',
      message: 'OK',
      warnings,
      errors: [],
      rawPayload: scraped.raw,
      productData,
      finished: true,
    })
    return {
      ok: true,
      job_id: jobId,
      draft_id: draft.id,
      draft_status: updated?.status || 'done',
      message: updated?.message || 'OK',
      errors: [],
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    await updateListingImportDraftFromPg(input.partnerId, draft.id, {
      status: 'error',
      message: msg,
      errors: [msg],
      finished: true,
    })
    return {
      ok: false,
      job_id: jobId,
      draft_id: draft.id,
      draft_status: 'error',
      error: msg,
      message: msg,
    }
  }
}
