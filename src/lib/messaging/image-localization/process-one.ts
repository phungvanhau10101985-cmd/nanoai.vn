import { createHash } from 'node:crypto'
import { fetchImageWith1688Bypass } from '@/lib/fetch-image-1688'
import { uploadPartnerBunnyObject } from '@/lib/storage/partner-bunny-cdn'
import { isOwnCdnUrl, normalizeImageUrl, imageLocGptVerifyAttempts } from './image-localization-config'
import type { ImageLocOcrBlock, ImageProcessResult } from './image-localization-types'
import { classifyImage, hasSizeOrLaundryContext, hasSizeTableContext, isLaundryInstructionImage } from './image-localization-classifier'
import { collectImageConsultSourceLines } from './image-consult-context'
import { encodeJpeg, localBlocksNeedDraw, localDrawTranslated, ocrImageBlocks } from './local-pipeline'
import { ImageLocalizationError, raiseIfFatalDependency } from './gemini-adapter'
import { ImageLocalizationGptStopError, openaiProcessImage } from './openai-adapter'
import { chineseBlocksToRedraw, localizedImageFix, localizedImageProblem, remainingChineseOnLocalizedImage } from './gpt-verify'
import { detectInkBleed } from './ink-bleed-check'
import { splitTallImageIfNeeded, vstackImageParts } from './split-tall-image'
import { overlayBrandLogoOnProcessedImage, loadImageLocBrandLogoBytes } from './overlay-brand-logo'

export async function downloadLocalizationImage(url: string): Promise<{ bytes: Buffer; filename: string }> {
  const normalized = normalizeImageUrl(url)
  const bytes = await fetchImageWith1688Bypass(normalized, { timeoutMs: 45_000, maxBytes: 12 * 1024 * 1024 })
  let name = 'image.jpg'
  try {
    const path = new URL(normalized).pathname
    name = path.split('/').pop() || name
  } catch {
    /* keep */
  }
  if (!name.includes('.')) name = `${name}.jpg`
  return { bytes, filename: name }
}

export async function uploadLocalizedImage(opts: {
  partnerId: string
  skuOrId: string
  language: string
  imageBytes: Buffer
}): Promise<string> {
  const jpeg = await encodeJpeg(opts.imageBytes)
  const digest = createHash('sha1').update(jpeg).digest('hex').slice(0, 12)
  const safe = (opts.skuOrId || 'product').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'product'
  const filename = `${safe}-${opts.language}-${Date.now()}-${digest}.jpg`
  const path = `localized-images/${opts.partnerId}/${safe}/${filename}`
  const { publicUrl } = await uploadPartnerBunnyObject(opts.partnerId, path, jpeg, 'image/jpeg')
  return publicUrl
}

export type ProcessImageContext = {
  partnerId: string
  skuOrId: string
  language: string
  geminiMode: 'api' | 'openai'
  allowsAi: boolean
  force: boolean
  dry_run?: boolean
  geminiImageModel?: string | null
  geminiImageSize?: string | null
  openaiImageModel?: string | null
  openaiImageQuality?: string | null
  openaiImageSize?: string | null
  logoUrl?: string | null
  logoBytes?: Buffer | null
  userId?: string | null
  /** Hostname Pull Zone của shop — ảnh trên host này coi là CDN shop. */
  cdnHosts?: readonly string[]
  shouldCancel?: () => boolean
}

type PartOutcome =
  | { kind: 'processed'; bytes: Buffer; message: string }
  | { kind: 'kept'; bytes: Buffer; message: string }
  | { kind: 'deleted'; message: string }

async function runAiEdit(
  ctx: ProcessImageContext,
  imageBytes: Buffer,
  filename: string,
  opts?: { removeModel?: boolean }
) {
  return openaiProcessImage({
    imageBytes,
    filename,
    language: ctx.language,
    imageModel: ctx.openaiImageModel,
    imageQuality: ctx.openaiImageQuality,
    imageSize: ctx.openaiImageSize,
    removeModel: opts?.removeModel,
  })
}

function throwIfCancelled(ctx: ProcessImageContext) {
  if (ctx.shouldCancel?.()) throw new ImageLocalizationError('Job đã bị hủy')
}

export type LocalizationEngineChoice = 'delete' | 'keep' | 'ai' | 'local'

/**
 * Chỉ bảng size và hướng dẫn giặt tẩy đi GPT Image.
 * Ảnh khác dịch local, trừ khi `forceAi` chỉ định đúng ảnh đó.
 */
export function selectLocalizationEngine(opts: {
  classification: string
  allowsAi: boolean
  geminiMode: 'api' | 'openai'
  hasSizeOrLaundry: boolean
  forceAi?: boolean
}): LocalizationEngineChoice {
  if (opts.classification === 'delete') return 'delete'
  if (opts.classification === 'keep') return 'keep'
  if (!opts.allowsAi) return 'local'
  if (opts.hasSizeOrLaundry || opts.forceAi) return 'ai'
  void opts.geminiMode
  return 'local'
}

function overlapAbortThreshold(): number | null {
  const raw = (process.env.IMAGE_LOCALIZATION_LOCAL_OVERLAP_ABORT_THRESHOLD || '').trim().toLowerCase()
  if (!raw || raw === 'none' || raw === 'off') return null
  const value = Number(raw)
  return Number.isFinite(value) ? value : null
}

function maxProcessedOverlapRatio(blocks: ImageLocOcrBlock[]): number {
  let max = 0
  const boxes = blocks.filter((block) => !block.layoutOnly && (block.text || '').trim())
  for (let i = 0; i < boxes.length; i++) {
    const a = boxes[i].bbox
    const areaA = Math.max(0, a[2] - a[0]) * Math.max(0, a[3] - a[1])
    for (let j = i + 1; j < boxes.length; j++) {
      const b = boxes[j].bbox
      const width = Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0]))
      const height = Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]))
      const areaB = Math.max(0, b[2] - b[0]) * Math.max(0, b[3] - b[1])
      const minArea = Math.min(areaA, areaB)
      if (minArea > 0) max = Math.max(max, (width * height) / minArea)
    }
  }
  return max
}

async function transformImageBytes(
  ctx: ProcessImageContext,
  bytes: Buffer,
  filename: string,
  blocks: ImageLocOcrBlock[],
  sourceUrl: string
): Promise<PartOutcome> {
  throwIfCancelled(ctx)
  const cls = classifyImage(blocks, [], sourceUrl)

  if (cls.type === 'delete') {
    return { kind: 'deleted', message: `Xóa theo classifier: ${String(cls.details.detected_keyword || 'keyword')}` }
  }
  if (cls.type === 'keep') {
    return { kind: 'kept', bytes, message: 'Không có chữ Trung cần xử lý' }
  }

  const runLocal = async (): Promise<PartOutcome> => {
    throwIfCancelled(ctx)
    const local = localBlocksNeedDraw(blocks)
    if (local.action === 'deleted') return { kind: 'deleted', message: local.message }
    if (local.action === 'empty') return { kind: 'kept', bytes, message: local.message }
    const abort = overlapAbortThreshold()
    if (abort != null) {
      const ratio = maxProcessedOverlapRatio(local.blocks)
      if (ratio > abort) {
        return {
          kind: 'kept',
          bytes,
          message: `Local overlap cao (${Math.round(ratio * 100)}% > ${Math.round(abort * 100)}%), giữ ảnh gốc — tắt IMAGE_LOCALIZATION_LOCAL_OVERLAP_ABORT_THRESHOLD hoặc tăng ngưỡng nếu muốn vẫn vẽ.`,
        }
      }
    }
    const drawn = await localDrawTranslated(bytes, local.blocks, ctx.language, ctx.userId)
    if (drawn.kind === 'unchanged') return { kind: 'kept', bytes, message: local.message }
    return { kind: 'processed', bytes: drawn.bytes, message: local.message }
  }

  const runAi = async (): Promise<PartOutcome> => {
    if (!ctx.allowsAi) return runLocal()
    const attempts = imageLocGptVerifyAttempts()
    const removeModel = hasSizeTableContext(blocks)
    let current = bytes
    let message = ''
    let lastProblem = 'không đọc lại được ảnh'
    try {
      const first = await runAiEdit(ctx, bytes, filename, { removeModel })
      current = first.bytes
      message = first.message
    } catch (e) {
      if (e instanceof ImageLocalizationError && e.message === 'Job đã bị hủy') throw e
      if (e instanceof ImageLocalizationGptStopError) throw e
      const detail = e instanceof Error ? e.message : String(e)
      throw new ImageLocalizationGptStopError(detail)
    }
    for (let check = 1; check <= attempts; check++) {
      throwIfCancelled(ctx)
      let fix: 'ok' | 'gpt' | 'deepseek' = 'ok'
      let chineseBlocks: ReturnType<typeof chineseBlocksToRedraw> = []
      try {
        const [bleed, post] = await Promise.all([
          detectInkBleed(current),
          ocrImageBlocks(current, ctx.userId),
        ])
        chineseBlocks = chineseBlocksToRedraw(post.blocks)
        const chinese = remainingChineseOnLocalizedImage(chineseBlocks.map((block) => block.text || ''))
        fix = localizedImageFix({ bleed: bleed.bleed, chineseCount: chinese.length })
        if (fix === 'ok') {
          const note = check > 1 ? `${message} (hậu kiểm lần ${check})` : message
          return { kind: 'processed', bytes: current, message: note }
        }
        lastProblem = localizedImageProblem({ bleed: bleed.bleed, where: bleed.where, chinese })
      } catch (e) {
        if (e instanceof ImageLocalizationError && e.message === 'Job đã bị hủy') throw e
        if (e instanceof ImageLocalizationGptStopError) throw e
        raiseIfFatalDependency(e)
        const detail = e instanceof Error ? e.message : String(e)
        throw new ImageLocalizationGptStopError(detail)
      }
      if (check === attempts) break
      if (fix === 'gpt') {
        try {
          const again = await runAiEdit(ctx, bytes, filename, { removeModel })
          current = again.bytes
          message = `${again.message} (vẽ lại vì mực loang)`
        } catch (e) {
          if (e instanceof ImageLocalizationError && e.message === 'Job đã bị hủy') throw e
          if (e instanceof ImageLocalizationGptStopError) throw e
          const detail = e instanceof Error ? e.message : String(e)
          throw new ImageLocalizationGptStopError(detail)
        }
        continue
      }
      try {
        const drawn = await localDrawTranslated(current, chineseBlocks, ctx.language, ctx.userId)
        if (drawn.kind === 'drawn') {
          current = drawn.bytes
          message = `${message} + DeepSeek vẽ chữ Trung còn sót`
        }
      } catch (e) {
        if (e instanceof ImageLocalizationError && e.message === 'Job đã bị hủy') throw e
        raiseIfFatalDependency(e)
        lastProblem = e instanceof Error ? e.message : String(e)
      }
    }
    throw new ImageLocalizationGptStopError(`Hậu kiểm chưa đạt sau ${attempts} lần — ${lastProblem}`)
  }

  const route = selectLocalizationEngine({
    classification: cls.type,
    allowsAi: ctx.allowsAi,
    geminiMode: ctx.geminiMode,
    hasSizeOrLaundry: hasSizeOrLaundryContext(blocks) || isLaundryInstructionImage(blocks),
  })
  if (route === 'ai') return runAi()
  return runLocal()
}

export async function processOneImageUrl(
  ctx: ProcessImageContext,
  url: string
): Promise<ImageProcessResult> {
  throwIfCancelled(ctx)
  const normalized = normalizeImageUrl(url)
  if (!ctx.force && isOwnCdnUrl(normalized, ctx.cdnHosts)) {
    return { original_url: normalized, final_url: normalized, status: 'kept', message: 'Ảnh đã ở CDN shop' }
  }
  const { bytes, filename } = await downloadLocalizationImage(normalized)
  throwIfCancelled(ctx)
  const { blocks } = await ocrImageBlocks(bytes, ctx.userId)
  return processPreparedImage(ctx, { url: normalized, bytes, filename, blocks })
}

export async function processPreparedImage(
  ctx: ProcessImageContext,
  input: {
    url: string
    bytes: Buffer
    filename: string
    blocks: ImageLocOcrBlock[]
  }
): Promise<ImageProcessResult> {
  const normalized = normalizeImageUrl(input.url)
  const { bytes, filename, blocks } = input
  const consultSources = collectImageConsultSourceLines(blocks)
  const withConsult = (result: ImageProcessResult): ImageProcessResult => ({
    ...result,
    consult_sources: consultSources,
  })
  throwIfCancelled(ctx)
  const parts = await splitTallImageIfNeeded({ bytes, blocks, filename })

  const outcomes: PartOutcome[] = []
  for (const part of parts) {
    throwIfCancelled(ctx)
    outcomes.push(await transformImageBytes(ctx, part.bytes, part.filename, part.blocks, normalized))
  }

  const finishProcessed = async (out: Buffer, message: string): Promise<ImageProcessResult> => {
    let withLogo = out
    try {
      if (ctx.logoBytes === undefined) {
        ctx.logoBytes = await loadImageLocBrandLogoBytes(ctx.logoUrl)
      }
      withLogo = await overlayBrandLogoOnProcessedImage(out, ctx.logoBytes)
    } catch (error) {
      console.warn('[image-localization] đóng logo lên ảnh đã dịch thất bại:', error)
    }
    const finalUrl = await uploadLocalizedImage({
      partnerId: ctx.partnerId,
      skuOrId: ctx.skuOrId,
      language: ctx.language,
      imageBytes: withLogo,
    })
    return withConsult({ original_url: normalized, final_url: finalUrl, status: 'processed', message })
  }

  if (outcomes.every((o) => o.kind === 'deleted')) {
    return withConsult({
      original_url: normalized,
      final_url: null,
      status: 'deleted',
      message: outcomes[0]?.message || 'Xóa ảnh',
    })
  }
  if (outcomes.every((o) => o.kind === 'kept')) {
    return withConsult({
      original_url: normalized,
      final_url: normalized,
      status: 'kept',
      message: parts.length > 1 ? 'Ảnh dài: các phần giữ nguyên' : outcomes[0]?.message || 'Giữ nguyên',
    })
  }

  const stitch: Buffer[] = []
  const originalShapes: Array<{ width: number; height: number }> = []
  const notes: string[] = []
  if (parts.length > 1) notes.push(`cắt ${parts.length} phần`)
  if (parts.length > 1 && outcomes.some((outcome) => outcome.kind === 'deleted')) {
    const deletedIndex = outcomes.findIndex((outcome) => outcome.kind === 'deleted')
    return withConsult({
      original_url: normalized,
      final_url: null,
      status: 'deleted',
      message: `Phần ${deletedIndex + 1}/${parts.length}: ${outcomes[deletedIndex]?.message || 'yêu cầu xóa ảnh'}`,
    })
  }
  for (let i = 0; i < outcomes.length; i++) {
    const o = outcomes[i]
    if (o.kind === 'deleted') {
      notes.push(`bỏ phần ${i + 1}`)
      continue
    }
    stitch.push(o.bytes)
    originalShapes.push({
      width: parts[i].width,
      height: Math.max(1, parts[i].y1 - parts[i].y0),
    })
    notes.push(o.message)
  }
  const anyProcessed = outcomes.some((o) => o.kind === 'processed')
  const anyDeleted = outcomes.some((o) => o.kind === 'deleted')
  if (!anyProcessed && !anyDeleted) {
    return withConsult({
      original_url: normalized,
      final_url: normalized,
      status: 'kept',
      message: notes.filter(Boolean).join(' · ') || 'Giữ nguyên',
    })
  }
  if (!stitch.length) {
    return withConsult({
      original_url: normalized,
      final_url: null,
      status: 'deleted',
      message: notes.filter(Boolean).join(' · ') || 'Xóa ảnh',
    })
  }
  const merged = await vstackImageParts(stitch, originalShapes)
  return finishProcessed(merged, notes.filter(Boolean).join(' · '))
}
