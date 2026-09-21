import { fetchPartnerInventoryRowByIdForPartnerFromPg } from '@/lib/db/messaging-partner-inventory-pg'
import {
  applyImageLocProductResultFromPg,
  claimInventoryForImageLocFromPg,
} from '@/lib/db/messaging-partner-image-localization-pg'
import { collectInventoryImageRefs, uniqueImageUrls } from './collect-image-refs'
import { imageLocMaxImagesPerProduct, normalizeImageUrl } from './image-localization-config'
import type { ImageProcessResult } from './image-localization-types'
import { prepareImageLocBatchOcr } from './batch-ocr'
import { processPreparedImage, type ProcessImageContext } from './process-one'
import { ImageLocalizationError, raiseIfFatalDependency } from './gemini-adapter'

export function isTransientImageLocDbError(error: unknown): boolean {
  const code = String((error as { code?: unknown })?.code || '').toUpperCase()
  if (['40001', '40P01', '53300', '57P01', '57P02', '57P03', '08000', '08001', '08003', '08004', '08006', '08007', '08P01'].includes(code)) {
    return true
  }
  return /ECONNRESET|ETIMEDOUT|connection terminated|connection.*closed|server closed the connection|timeout acquiring a client/i.test(
    error instanceof Error ? error.message : String(error || '')
  )
}

async function withDbRetry<T>(work: () => Promise<T>, label: string): Promise<T> {
  let lastError: unknown
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      return await work()
    } catch (error) {
      lastError = error
      if (!isTransientImageLocDbError(error) || attempt >= 3) throw error
      await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** (attempt - 1)))
    }
  }
  throw new ImageLocalizationError(`${label}: ${lastError instanceof Error ? lastError.message : String(lastError)}`)
}

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
  const row = await withDbRetry(
    () => fetchPartnerInventoryRowByIdForPartnerFromPg(opts.partnerId, opts.inventoryId),
    'Đọc sản phẩm sau retry DB'
  )
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
    await withDbRetry(() => applyImageLocProductResultFromPg({
      partnerId: opts.partnerId,
      inventoryId: opts.inventoryId,
      language: opts.ctx.language,
      status: 'skipped',
      error: 'Sản phẩm không có URL ảnh ở O/P/Q/T',
    }), 'Lưu trạng thái bỏ qua sau retry DB')
    return { status: 'skipped', processed_images: 0, message: 'Sản phẩm không có URL ảnh ở O/P/Q/T' }
  }

  const skuOrId = String(row.sku || row.remarketing_id || row.id)
  const ctx: ProcessImageContext = { ...opts.ctx, partnerId: opts.partnerId, skuOrId }
  const results: Record<string, ImageProcessResult> = {}
  opts.progressCb?.(`tải/ghép ${urls.length} ảnh`)
  const batchOcr = await prepareImageLocBatchOcr({
    urls,
    force: ctx.force,
    userId: ctx.userId,
    shouldCancel: ctx.shouldCancel,
    progressCb: opts.progressCb,
  })
  for (const [url, result] of batchOcr.earlyResults) results[url] = result

  for (let i = 0; i < urls.length; i++) {
    if (ctx.shouldCancel?.()) throw new ImageLocalizationError('Job đã bị hủy')
    const normalized = normalizeImageUrl(urls[i])
    if (results[normalized]) continue
    opts.progressCb?.(`ảnh ${i + 1}/${urls.length}`)
    try {
      const prepared = batchOcr.prepared.get(normalized)
      results[normalized] = prepared
        ? await processPreparedImage(ctx, prepared)
        : {
            original_url: normalized,
            final_url: normalized,
            status: 'kept',
            message: 'Không cần xử lý',
          }
    } catch (e) {
      if (e instanceof ImageLocalizationError && e.message === 'Job đã bị hủy') throw e
      raiseIfFatalDependency(e)
      results[normalized] = {
        original_url: normalized,
        final_url: normalized,
        status: 'error',
        message: e instanceof Error ? e.message : String(e),
      }
    }
  }

  if (ctx.shouldCancel?.()) throw new ImageLocalizationError('Job đã bị hủy')

  const failed = Object.values(results).filter((r) => r.status === 'error')
  const changed = Object.values(results).filter(
    (r) => r.status === 'processed' || r.status === 'deleted'
  )
  if (failed.length && !changed.length) {
    const failMsg = failed[0].message.slice(0, 2000)
    await withDbRetry(() => applyImageLocProductResultFromPg({
      partnerId: opts.partnerId,
      inventoryId: opts.inventoryId,
      language: opts.ctx.language,
      status: 'failed',
      error: failMsg,
    }), 'Lưu lỗi sản phẩm sau retry DB')
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

  await withDbRetry(() => applyImageLocProductResultFromPg({
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
  }), 'Lưu ảnh bản địa hóa sau retry DB')

  return {
    status: 'localized',
    processed_images: changed.length,
    failed_images: failed.length,
    message: `Đã cập nhật ${changed.length} ảnh` + (failed.length ? `, lỗi ${failed.length} ảnh` : ''),
  }
}
