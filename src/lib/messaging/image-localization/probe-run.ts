import { randomUUID } from 'node:crypto'
import { deleteBunnyObjectForSource, uploadPartnerBunnyObject } from '@/lib/storage/partner-bunny-cdn'
import { fetchImageLocSettingsFromPg } from '@/lib/db/messaging-partner-image-localization-pg'
import {
  appendImageLocProbeLog,
  deleteImageLocProbe,
  findRunningImageLocProbe,
  insertImageLocProbe,
  listExpiredImageLocProbeFiles,
  listImageLocProbes,
  markStaleImageLocProbes,
  updateImageLocProbe,
  type ImageLocProbe,
} from '@/lib/db/messaging-partner-image-localization-probe-pg'
import { ImageLocalizationError } from './gemini-adapter'
import { encodeJpeg } from './local-pipeline'
import { localizeStandaloneImage } from './process-one'
import { imageLocAiJobsAllowed } from './image-localization-config'
import { IMAGE_LOC_LANGUAGES, type ImageLocGeminiMode, type ImageLocLanguage } from './image-localization-types'
import { probeExpiresAt } from './probe-report'

const workers = new Set<string>()

async function removeStored(partnerId: string, path: string | null, url: string | null) {
  if (!path || !url) return
  await deleteBunnyObjectForSource(path, url, partnerId).catch(() => undefined)
}

export async function sweepImageLocProbes(): Promise<{ expired: number; stale: number }> {
  const stale = await markStaleImageLocProbes()
  const expired = await listExpiredImageLocProbeFiles()
  for (const row of expired) {
    await removeStored(row.partner_id, row.original_path, row.original_url)
    await removeStored(row.partner_id, row.result_path, row.result_url)
  }
  return { expired: expired.length, stale }
}

export async function listImageLocProbeFolder(partnerId: string): Promise<ImageLocProbe[]> {
  await sweepImageLocProbes()
  return listImageLocProbes(partnerId)
}

export async function removeImageLocProbe(partnerId: string, id: string): Promise<boolean> {
  const row = await deleteImageLocProbe(partnerId, id)
  if (!row) return false
  await removeStored(partnerId, row.original_path, row.original_url)
  await removeStored(partnerId, row.result_path, row.result_url)
  return true
}

type ProbeRunOptions = {
  language: string
  apparelSheet: boolean
  mode: ImageLocGeminiMode
  openaiImageModel?: string | null
  openaiImageQuality?: string | null
  openaiImageSize?: string | null
}

function spawnProbe(partnerId: string, id: string, bytes: Buffer, filename: string, options: ProbeRunOptions, userId: string) {
  const key = `${partnerId}:${id}`
  if (workers.has(key)) return
  workers.add(key)
  const task = runProbe(partnerId, id, bytes, filename, options, userId)
    .catch((error) => {
      const message = error instanceof Error ? error.message : String(error)
      console.error('[image-localization] probe failed', id, message)
      return appendImageLocProbeLog(partnerId, id, message).then(() =>
        updateImageLocProbe(partnerId, id, { status: 'error', message })
      )
    })
    .finally(() => {
      workers.delete(key)
    })
  void task
}

async function runProbe(
  partnerId: string,
  id: string,
  bytes: Buffer,
  filename: string,
  options: ProbeRunOptions,
  userId: string
) {
  const { language, apparelSheet } = options
  const allowsAi = options.mode !== 'local_only'
  const originalPath = `localized-images/${partnerId}/probes/${id}/original.jpg`
  const originalJpeg = await encodeJpeg(bytes)
  const uploaded = await uploadPartnerBunnyObject(partnerId, originalPath, originalJpeg, 'image/jpeg')
  await updateImageLocProbe(partnerId, id, { originalUrl: uploaded.publicUrl, originalPath })
  const settings = await fetchImageLocSettingsFromPg(partnerId)
  const report = await localizeStandaloneImage(
    {
      partnerId,
      skuOrId: `probe-${id}`,
      language,
      geminiMode: allowsAi ? 'openai' : 'api',
      allowsAi,
      force: true,
      openaiImageModel: options.openaiImageModel,
      openaiImageQuality: options.openaiImageQuality,
      openaiImageSize: options.openaiImageSize,
      logoUrl: settings.logo_url,
      userId,
      apparelProduct: apparelSheet,
    },
    bytes,
    filename,
    (text) => appendImageLocProbeLog(partnerId, id, text)
  )
  await updateImageLocProbe(partnerId, id, {
    engine: report.engine,
    model: report.model,
    classifyType: report.classifyType,
    classifyReason: report.classifyReason,
    message: report.message,
  })
  let resultUrl: string | null = null
  let resultPath: string | null = null
  if (report.status === 'processed' && report.bytes) {
    resultPath = `localized-images/${partnerId}/probes/${id}/result.jpg`
    const jpeg = await encodeJpeg(report.bytes)
    const result = await uploadPartnerBunnyObject(partnerId, resultPath, jpeg, 'image/jpeg')
    resultUrl = result.publicUrl
  }
  await appendImageLocProbeLog(partnerId, id, 'Đã lưu vào thư mục thử. Ảnh tự xóa sau 7 ngày.')
  await updateImageLocProbe(partnerId, id, {
    engine: report.engine,
    model: report.model,
    classifyType: report.classifyType,
    classifyReason: report.classifyReason,
    message: report.message,
    resultUrl,
    resultPath,
    status: 'done',
  })
}

export async function startImageLocProbe(input: {
  partnerId: string
  userId: string
  bytes: Buffer
  filename: string
  language: string
  apparelSheet: boolean
  mode?: string | null
  openaiImageModel?: string | null
  openaiImageQuality?: string | null
  openaiImageSize?: string | null
}): Promise<ImageLocProbe> {
  const language = String(input.language || 'vi').trim().toLowerCase()
  if (!(IMAGE_LOC_LANGUAGES as readonly string[]).includes(language)) {
    throw new ImageLocalizationError('Ngôn ngữ không hỗ trợ. Dùng vi, en, th hoặc id.')
  }
  const mode: ImageLocGeminiMode = input.mode === 'openai' || input.mode === 'api' ? 'openai' : 'local_only'
  if (mode !== 'local_only' && !imageLocAiJobsAllowed()) {
    throw new ImageLocalizationError('Server đang tắt GPT Image. Chọn DeepSeek + vẽ local, hoặc bật IMAGE_LOCALIZATION_AI_IMAGE_JOBS_ALLOWED.')
  }
  await sweepImageLocProbes()
  const running = await findRunningImageLocProbe(input.partnerId)
  if (running) throw new ImageLocalizationError('Đang chạy một ảnh thử. Đợi ảnh đó xong rồi chạy tiếp.')
  const id = randomUUID()
  const probe = await insertImageLocProbe({
    id,
    partnerId: input.partnerId,
    language: language as ImageLocLanguage,
    apparelSheet: input.apparelSheet,
    expiresAt: probeExpiresAt(),
  })
  const branch = input.apparelSheet ? 'thời trang' : 'không phải thời trang'
  const engine = mode === 'local_only' ? 'DeepSeek + vẽ local' : 'GPT Image'
  await appendImageLocProbeLog(input.partnerId, id, `Đã nhận ảnh. Chế độ ${engine}, nhánh ${branch}.`)
  spawnProbe(
    input.partnerId,
    id,
    input.bytes,
    input.filename,
    {
      language,
      apparelSheet: input.apparelSheet,
      mode,
      openaiImageModel: input.openaiImageModel,
      openaiImageQuality: input.openaiImageQuality,
      openaiImageSize: input.openaiImageSize,
    },
    input.userId
  )
  return probe
}
