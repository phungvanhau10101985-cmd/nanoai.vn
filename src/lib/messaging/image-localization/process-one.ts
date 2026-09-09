import { createHash } from 'node:crypto'
import sharp from 'sharp'
import { fetchImageWith1688Bypass } from '@/lib/fetch-image-1688'
import { uploadTryOnImagePublic } from '@/lib/storage/try-on-public-upload'
import { imageLocJpegQuality, isOwnCdnUrl, normalizeImageUrl } from './image-localization-config'
import type { ImageLocOcrBlock, ImageProcessResult } from './image-localization-types'
import { classifyImage, hasChineseText, hasSizeOrLaundryContext } from './image-localization-classifier'
import { encodeJpeg, localBlocksNeedDraw, localDrawTranslated, ocrImageBlocks } from './local-pipeline'
import { geminiProcessImage, ImageLocalizationError, raiseIfFatalDependency } from './gemini-adapter'
import { openaiProcessImage } from './openai-adapter'
import { splitTallImageIfNeeded, vstackImageParts } from './split-tall-image'

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
  const { publicUrl } = await uploadTryOnImagePublic(path, jpeg, { contentType: 'image/jpeg' })
  return publicUrl
}

async function overlayBrandLogo(imageBytes: Buffer, logoUrl?: string | null): Promise<Buffer> {
  const logoSrc = (logoUrl || '').trim()
  if (!logoSrc || !/^https?:\/\//i.test(logoSrc)) return imageBytes
  try {
    const logoBuf = await fetchImageWith1688Bypass(logoSrc, { timeoutMs: 15_000, maxBytes: 2 * 1024 * 1024 })
    const base = sharp(imageBytes)
    const meta = await base.metadata()
    const w = meta.width || 0
    const h = meta.height || 0
    if (w < 48 || h < 16) return imageBytes
    const maxW = Math.max(8, Math.floor(w * 0.22))
    const logo = sharp(logoBuf).resize({ width: maxW, withoutEnlargement: true })
    const logoMeta = await logo.metadata()
    const lw = logoMeta.width || maxW
    const margin = Math.max(4, Math.floor(Math.min(h, w) * 0.012))
    const left = w - lw - margin
    const top = margin
    if (left < 0 || top < 0) return imageBytes
    return base
      .composite([{ input: await logo.png().toBuffer(), left, top }])
      .jpeg({ quality: imageLocJpegQuality(), mozjpeg: true })
      .toBuffer()
  } catch {
    return imageBytes
  }
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
  userId?: string | null
  shouldCancel?: () => boolean
}

type PartOutcome =
  | { kind: 'processed'; bytes: Buffer; message: string }
  | { kind: 'kept'; bytes: Buffer; message: string }
  | { kind: 'deleted'; message: string }

async function runAiEdit(ctx: ProcessImageContext, imageBytes: Buffer, filename: string) {
  if (ctx.geminiMode === 'openai') {
    return openaiProcessImage({
      imageBytes,
      filename,
      language: ctx.language,
      imageModel: ctx.openaiImageModel,
      imageQuality: ctx.openaiImageQuality,
      imageSize: ctx.openaiImageSize,
    })
  }
  return geminiProcessImage({
    imageBytes,
    filename,
    language: ctx.language,
    imageModel: ctx.geminiImageModel,
    imageSize: ctx.geminiImageSize,
  })
}

function throwIfCancelled(ctx: ProcessImageContext) {
  if (ctx.shouldCancel?.()) throw new ImageLocalizationError('Job đã bị hủy')
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
  const useGeminiForRich = ctx.allowsAi && ctx.geminiMode === 'api'
  const deleteSizeAndLaundry = !useGeminiForRich

  if (cls.type === 'delete') {
    return { kind: 'deleted', message: `Xóa theo classifier: ${String(cls.details.detected_keyword || 'keyword')}` }
  }
  if (cls.type === 'keep') {
    return { kind: 'kept', bytes, message: 'Không có chữ Trung cần xử lý' }
  }

  const runLocal = async (): Promise<PartOutcome> => {
    throwIfCancelled(ctx)
    const local = localBlocksNeedDraw(blocks, { deleteSizeAndLaundry })
    if (local.action === 'deleted') return { kind: 'deleted', message: local.message }
    if (local.action === 'empty') return { kind: 'kept', bytes, message: local.message }
    const drawn = await localDrawTranslated(bytes, local.blocks, ctx.language, ctx.userId)
    return { kind: 'processed', bytes: drawn, message: local.message }
  }

  const runAi = async (): Promise<PartOutcome> => {
    if (!ctx.allowsAi) return runLocal()
    throwIfCancelled(ctx)
    const preserveRich = useGeminiForRich && hasSizeOrLaundryContext(blocks)
    try {
      const ai = await runAiEdit(ctx, bytes, filename)
      throwIfCancelled(ctx)
      const post = await ocrImageBlocks(ai.bytes, ctx.userId)
      if (post.blocks.some((b) => hasChineseText(b.text))) {
        const local = localBlocksNeedDraw(post.blocks, { deleteSizeAndLaundry: !useGeminiForRich })
        if (local.action === 'draw') {
          const drawn = await localDrawTranslated(ai.bytes, local.blocks, ctx.language, ctx.userId)
          return { kind: 'processed', bytes: drawn, message: `${ai.message} + hậu kiểm local` }
        }
      }
      return { kind: 'processed', bytes: ai.bytes, message: ai.message }
    } catch (e) {
      if (e instanceof ImageLocalizationError && e.message === 'Job đã bị hủy') throw e
      raiseIfFatalDependency(e)
      if (preserveRich) {
        return {
          kind: 'kept',
          bytes,
          message: `Gemini API không xử lý được — giữ ảnh bảng size/giặt tẩy — ${e instanceof Error ? e.message : String(e)}`,
        }
      }
      return {
        kind: 'kept',
        bytes,
        message: `Gemini/GPT không tạo ảnh dùng được — ${e instanceof Error ? e.message : String(e)}`,
      }
    }
  }

  if (cls.type === 'gemini') {
    if (!ctx.allowsAi) return runLocal()
    return runAi()
  }
  if (useGeminiForRich && hasSizeOrLaundryContext(blocks)) return runAi()
  return runLocal()
}

export async function processOneImageUrl(
  ctx: ProcessImageContext,
  url: string
): Promise<ImageProcessResult> {
  throwIfCancelled(ctx)
  const normalized = normalizeImageUrl(url)
  if (!ctx.force && isOwnCdnUrl(normalized)) {
    return { original_url: normalized, final_url: normalized, status: 'kept', message: 'Ảnh đã ở CDN shop' }
  }
  const { bytes, filename } = await downloadLocalizationImage(normalized)
  throwIfCancelled(ctx)
  const { blocks } = await ocrImageBlocks(bytes, ctx.userId)
  throwIfCancelled(ctx)
  const parts = await splitTallImageIfNeeded({ bytes, blocks, filename })

  const outcomes: PartOutcome[] = []
  for (const part of parts) {
    throwIfCancelled(ctx)
    outcomes.push(await transformImageBytes(ctx, part.bytes, part.filename, part.blocks, normalized))
  }

  const finishProcessed = async (out: Buffer, message: string): Promise<ImageProcessResult> => {
    const withLogo = await overlayBrandLogo(out, ctx.logoUrl)
    const finalUrl = await uploadLocalizedImage({
      partnerId: ctx.partnerId,
      skuOrId: ctx.skuOrId,
      language: ctx.language,
      imageBytes: withLogo,
    })
    return { original_url: normalized, final_url: finalUrl, status: 'processed', message }
  }

  if (outcomes.every((o) => o.kind === 'deleted')) {
    return {
      original_url: normalized,
      final_url: null,
      status: 'deleted',
      message: outcomes[0]?.message || 'Xóa ảnh',
    }
  }
  if (outcomes.every((o) => o.kind === 'kept')) {
    return {
      original_url: normalized,
      final_url: normalized,
      status: 'kept',
      message: parts.length > 1 ? 'Ảnh dài: các phần giữ nguyên' : outcomes[0]?.message || 'Giữ nguyên',
    }
  }

  const stitch: Buffer[] = []
  const notes: string[] = []
  if (parts.length > 1) notes.push(`cắt ${parts.length} phần`)
  for (let i = 0; i < outcomes.length; i++) {
    const o = outcomes[i]
    if (o.kind === 'deleted') {
      notes.push(`bỏ phần ${i + 1}`)
      continue
    }
    stitch.push(o.bytes)
    notes.push(o.message)
  }
  const anyProcessed = outcomes.some((o) => o.kind === 'processed')
  const anyDeleted = outcomes.some((o) => o.kind === 'deleted')
  if (!anyProcessed && !anyDeleted) {
    return {
      original_url: normalized,
      final_url: normalized,
      status: 'kept',
      message: notes.filter(Boolean).join(' · ') || 'Giữ nguyên',
    }
  }
  if (!stitch.length) {
    return {
      original_url: normalized,
      final_url: null,
      status: 'deleted',
      message: notes.filter(Boolean).join(' · ') || 'Xóa ảnh',
    }
  }
  const merged = await vstackImageParts(stitch)
  return finishProcessed(merged, notes.filter(Boolean).join(' · '))
}
