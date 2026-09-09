import { fetchPartnerInventoryRowByIdForPartnerFromPg } from '@/lib/db/messaging-partner-inventory-pg'
import {
  applyImageLocProductResultFromPg,
  claimInventoryForImageLocFromPg,
} from '@/lib/db/messaging-partner-image-localization-pg'
import { collectInventoryImageRefs, uniqueImageUrls } from './collect-image-refs'
import { imageLocMaxImagesPerProduct, normalizeImageUrl } from './image-localization-config'
import type { ImageProcessResult } from './image-localization-types'
import { processOneImageUrl, type ProcessImageContext } from './process-one'
import { ImageLocalizationError } from './gemini-adapter'

function asInfoObject(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) return { ...(raw as Record<string, unknown>) }
  return {}
}

function applyResultsToRow(
  row: {
    image_url?: string | null
    colors_json?: unknown
    gallery_urls?: unknown
    detail_image_urls?: unknown
    material_detail_image_url?: string | null
  },
  results: Record<string, ImageProcessResult>
) {
  const replacement = (url: string): string | null => {
    const r = results[normalizeImageUrl(url)]
    if (!r) return url
    return r.final_url
  }
  const colors = Array.isArray(row.colors_json) ? [...row.colors_json] : []
  const nextColors = colors.map((item) => {
    if (!item || typeof item !== 'object') return item
    const rec = { ...(item as Record<string, unknown>) }
    if (typeof rec.img === 'string') {
      const nxt = replacement(rec.img)
      if (nxt) rec.img = nxt
      else delete rec.img
    }
    return rec
  })
  const gallery = Array.isArray(row.gallery_urls) ? (row.gallery_urls as unknown[]) : []
  const detail = Array.isArray(row.detail_image_urls) ? (row.detail_image_urls as unknown[]) : []
  const nextGallery = gallery
    .map((u) => (typeof u === 'string' ? replacement(u) : null))
    .filter((u): u is string => Boolean(u))
  const nextDetail = detail
    .map((u) => (typeof u === 'string' ? replacement(u) : null))
    .filter((u): u is string => Boolean(u))
  const main = typeof row.image_url === 'string' ? replacement(row.image_url) : row.image_url
  const material =
    typeof row.material_detail_image_url === 'string' ? replacement(row.material_detail_image_url) : row.material_detail_image_url
  return {
    colors_json: nextColors,
    gallery_urls: nextGallery,
    detail_image_urls: nextDetail,
    image_url: main ?? '',
    material_detail_image_url: material ?? '',
  }
}

export async function processInventoryProduct(opts: {
  partnerId: string
  inventoryId: string
  ctx: Omit<ProcessImageContext, 'partnerId' | 'skuOrId'>
  progressCb?: (phase: string) => void
}): Promise<{ status: string; processed_images: number; failed_images?: number; message: string }> {
  const dryRun = Boolean(opts.ctx.dry_run)
  const claimed = dryRun
    ? true
    : await claimInventoryForImageLocFromPg({
        partnerId: opts.partnerId,
        inventoryId: opts.inventoryId,
        language: opts.ctx.language,
        force: opts.ctx.force,
      })
  const row = await fetchPartnerInventoryRowByIdForPartnerFromPg(opts.partnerId, opts.inventoryId)
  if (!row) {
    return { status: 'skipped', processed_images: 0, message: 'Sản phẩm không còn trong kho.' }
  }
  if (!claimed) {
    const st = String((row as { image_localization_status?: string }).image_localization_status || 'pending')
    const msg =
      st === 'processing'
        ? 'Bỏ qua vì sản phẩm đang được job bản địa hóa khác xử lý.'
        : `Bỏ qua vì trạng thái hiện tại là ${st}.`
    return { status: 'skipped', processed_images: 0, message: msg }
  }

  const refs = collectInventoryImageRefs(row)
  const urls = uniqueImageUrls(refs, imageLocMaxImagesPerProduct())
  if (!urls.length) {
    await applyImageLocProductResultFromPg({
      partnerId: opts.partnerId,
      inventoryId: opts.inventoryId,
      language: opts.ctx.language,
      status: 'skipped',
      error: 'Sản phẩm không có URL ảnh ở O/P/Q/T',
    })
    return { status: 'skipped', processed_images: 0, message: 'Sản phẩm không có URL ảnh ở O/P/Q/T' }
  }

  const skuOrId = String(row.sku || row.remarketing_id || row.id)
  const ctx: ProcessImageContext = { ...opts.ctx, partnerId: opts.partnerId, skuOrId }
  const results: Record<string, ImageProcessResult> = {}
  for (let i = 0; i < urls.length; i++) {
    if (ctx.shouldCancel?.()) throw new ImageLocalizationError('Job đã bị hủy')
    opts.progressCb?.(`ảnh ${i + 1}/${urls.length}`)
    try {
      results[urls[i]] = await processOneImageUrl(ctx, urls[i])
    } catch (e) {
      if (e instanceof ImageLocalizationError && e.message === 'Job đã bị hủy') throw e
      results[urls[i]] = {
        original_url: urls[i],
        final_url: urls[i],
        status: 'error',
        message: e instanceof Error ? e.message : String(e),
      }
    }
  }

  if (ctx.shouldCancel?.()) throw new ImageLocalizationError('Job đã bị hủy')

  const failed = Object.values(results).filter((r) => r.status === 'error')
  const changed = Object.values(results).filter((r) => r.final_url && r.final_url !== r.original_url)
  if (failed.length && !changed.length) {
    const failMsg = failed[0].message.slice(0, 2000)
    await applyImageLocProductResultFromPg({
      partnerId: opts.partnerId,
      inventoryId: opts.inventoryId,
      language: opts.ctx.language,
      status: 'failed',
      error: failMsg,
    })
    return { status: 'failed', processed_images: 0, message: failMsg }
  }

  if (dryRun) {
    return {
      status: 'localized',
      processed_images: changed.length,
      failed_images: failed.length,
      message: `Dry-run: ${changed.length} ảnh sẽ đổi` + (failed.length ? `, lỗi ${failed.length}` : ''),
    }
  }

  const patched = applyResultsToRow(row, results)
  const info = asInfoObject(row.product_info_json)
  const loc = asInfoObject(info.image_localization)
  loc.language = opts.ctx.language
  loc.processed_at = new Date().toISOString()
  loc.originals = refs
    .filter((r) => normalizeImageUrl(r.url) in results)
    .map((r) => ({ bucket: r.bucket, index: r.index, url: normalizeImageUrl(r.url) }))
  loc.results = Object.fromEntries(
    Object.entries(results).map(([url, res]) => [
      url,
      { final_url: res.final_url, status: res.status, message: res.message, ...(res.detail ? { detail: res.detail } : {}) },
    ])
  )
  info.image_localization = loc

  await applyImageLocProductResultFromPg({
    partnerId: opts.partnerId,
    inventoryId: opts.inventoryId,
    language: opts.ctx.language,
    status: 'localized',
    error: failed[0]?.message.slice(0, 2000) ?? null,
    imageUrl: patched.image_url,
    colorsJson: patched.colors_json,
    galleryUrls: patched.gallery_urls,
    detailImageUrls: patched.detail_image_urls,
    materialDetailImageUrl: patched.material_detail_image_url,
    productInfoJson: info,
  })

  return {
    status: 'localized',
    processed_images: changed.length,
    failed_images: failed.length,
    message: `Đã cập nhật ${changed.length} ảnh` + (failed.length ? `, lỗi ${failed.length} ảnh` : ''),
  }
}
