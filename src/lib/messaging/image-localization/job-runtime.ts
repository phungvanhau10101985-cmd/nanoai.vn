import { randomUUID } from 'node:crypto'
import {
  deleteTerminalImageLocJobsFromPg,
  fetchImageLocJobFromPg,
  fetchImageLocSettingsFromPg,
  fetchLocalizedIdsInQueueFromPg,
  insertImageLocJobFromPg,
  listPendingImageLocInventoryIdsFromPg,
  listResumableImageLocJobsFromPg,
  resetStaleImageLocProcessingFromPg,
  updateImageLocJobFromPg,
} from '@/lib/db/messaging-partner-image-localization-pg'
import { pgQueryOne } from '@/lib/db/pg-query'
import { isPgConfigured } from '@/lib/db/pool'
import {
  imageLocAiExplicitOnly,
  imageLocAiJobsAllowed,
  imageLocBatchLimit,
  imageLocDefaultGeminiMode,
  imageLocJobQueueIdsMax,
  imageLocMaxAutoResumeCount,
  imageLocMaxConsecutiveProductFailures,
} from './image-localization-config'
import { isDeepseekPeakUtc, offPeakWaitMessageVi, secondsUntilDeepseekOffPeak } from './deepseek-pricing'
import { processInventoryProduct } from './process-product'
import { geminiApiAuth, ImageLocalizationError, isImageLocalizationFatalDependencyError } from './gemini-adapter'
import { openaiApiAuth } from './openai-adapter'
import {
  IMAGE_LOC_LANGUAGES,
  type ImageLocJob,
  type ImageLocRecentResult,
  type ImageLocSkippedReport,
  type ImageLocStartPayload,
} from './image-localization-types'

const workerRegistry = new Map<string, Promise<void>>()
const abortFlags = new Map<string, 'graceful' | 'force'>()

function workerKey(partnerId: string, jobId: string): string {
  return `${partnerId}:${jobId}`
}

function isForceAborted(partnerId: string, jobId: string): boolean {
  return abortFlags.get(workerKey(partnerId, jobId)) === 'force'
}

function clip(v: unknown, max = 600): string {
  const s = String(v || '').trim()
  return s.length <= max ? s : `${s.slice(0, max - 1).trimEnd()}…`
}

function uniqueIds(ids: Iterable<string> | null | undefined): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of ids || []) {
    const id = String(raw || '').trim()
    if (!id || seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  return out
}

function progress(done: number, failed: number, skipped: number, total: number, inFlight = false) {
  const completed = done + failed + skipped
  let current = completed + (inFlight ? 1 : 0)
  let percent = 0
  if (total > 0) {
    current = Math.min(current, total)
    percent = Math.round((1000 * Math.min(completed, total)) / total) / 10
  }
  return { current, percent }
}

export function imageLocWorkerAlive(partnerId: string, jobId: string): boolean {
  return workerRegistry.has(workerKey(partnerId, jobId))
}

async function jobCancelled(partnerId: string, jobId: string): Promise<boolean> {
  const row = await fetchImageLocJobFromPg(partnerId, jobId)
  if (!row) return true
  const st = (row.status || '').toLowerCase()
  return st === 'cancelled' || Boolean(row.cancel_requested)
}

async function waitOffPeak(partnerId: string, job: ImageLocJob): Promise<boolean> {
  const settings = await fetchImageLocSettingsFromPg(partnerId)
  if (!settings.deepseek_off_peak_only) return true
  while (isDeepseekPeakUtc()) {
    if (isForceAborted(partnerId, job.job_id) || (await jobCancelled(partnerId, job.job_id))) return false
    const sec = secondsUntilDeepseekOffPeak()
    const { current, percent } = progress(job.done, job.failed, job.skipped, job.total || 0)
    await updateImageLocJobFromPg(partnerId, job.job_id, {
      status: 'running',
      phase: 'waiting_off_peak',
      message: offPeakWaitMessageVi(sec),
      current,
      percent,
      current_product_id: null,
    })
    await new Promise((r) => setTimeout(r, Math.min(60_000, Math.max(1000, sec * 1000))))
  }
  return true
}

async function runJob(partnerId: string, jobId: string, resume: boolean): Promise<void> {
  let job = await fetchImageLocJobFromPg(partnerId, jobId)
  if (!job) return
  const payload = (job.payload || {}) as ImageLocStartPayload
  const processed = uniqueIds(job.processed_product_ids)
  const processedSet = new Set(processed)
  let queue = uniqueIds(job.queue_product_ids)
  let done = job.done
  let failed = job.failed
  let skipped = job.skipped
  const recent: ImageLocRecentResult[] = [...(job.recent_results || [])]
  const skippedReports: ImageLocSkippedReport[] = [...(job.skipped_product_reports || [])]

  if (resume) {
    const leftover = queue.filter((id) => !processedSet.has(id))
    if (leftover.length) await resetStaleImageLocProcessingFromPg(partnerId, leftover)
  } else {
    await resetStaleImageLocProcessingFromPg(partnerId)
  }

  if (!queue.length) {
    const limit = payload.limit || imageLocBatchLimit() || 10000
    queue = await listPendingImageLocInventoryIdsFromPg(partnerId, {
      force: Boolean(payload.force),
      productIds: payload.product_ids,
      limit,
    })
  }

  if (!payload.force) {
    const already = await fetchLocalizedIdsInQueueFromPg(partnerId, queue.filter((id) => !processedSet.has(id)))
    for (const id of already) {
      if (processedSet.has(id)) continue
      processedSet.add(id)
      processed.push(id)
      skipped += 1
      skippedReports.push({ product_id: id, message: 'Bỏ qua vì sản phẩm đã bản địa hóa trước đó.' })
    }
  }

  const truncated = queue.length > imageLocJobQueueIdsMax()
  const total = queue.length
  const { current, percent } = progress(done, failed, skipped, total)
  await updateImageLocJobFromPg(partnerId, jobId, {
    status: 'running',
    phase: 'processing',
    message: resume ? 'Tiếp tục job sau restart…' : 'Bắt đầu xử lý…',
    queue_product_ids: queue,
    processed_product_ids: processed,
    job_queue_truncated: truncated,
    total,
    current,
    percent,
    skipped,
    skipped_product_reports: skippedReports.slice(-120),
    started_at: job.started_at || new Date().toISOString(),
    resume_count: resume ? job.resume_count + 1 : job.resume_count,
  })

  const logoUrl = await fetchPartnerLogoUrl(partnerId)

  const allowsAi = payload.allow_ai_image_models === true ? true : payload.allow_ai_image_models === false ? false : !imageLocAiExplicitOnly()
  const geminiMode = payload.gemini_mode === 'openai' ? 'openai' : 'api'
  let consecutiveFails = 0

  if (!(await waitOffPeak(partnerId, { ...job, done, failed, skipped, total }))) {
    await finalizeCancelled(partnerId, jobId, done, failed, skipped, total, processed, recent, skippedReports)
    return
  }

  for (const inventoryId of queue) {
    if (processedSet.has(inventoryId)) continue
    if (isForceAborted(partnerId, jobId) || (await jobCancelled(partnerId, jobId))) {
      await finalizeCancelled(partnerId, jobId, done, failed, skipped, total, processed, recent, skippedReports)
      return
    }
    const { current: cur, percent: pct } = progress(done, failed, skipped, total, true)
    let lastBeat = 0
    const progressCb = (phase: string) => {
      const now = Date.now()
      if (now - lastBeat < 3000) return
      lastBeat = now
      void updateImageLocJobFromPg(partnerId, jobId, {
        status: 'running',
        phase: 'processing',
        current: cur,
        percent: pct,
        current_product_id: inventoryId,
        message: clip(`Đang xử lý ${cur}/${total}: ${inventoryId} — ${phase}`),
      })
    }
    await updateImageLocJobFromPg(partnerId, jobId, {
      status: 'running',
      phase: 'processing',
      current: cur,
      percent: pct,
      current_product_id: inventoryId,
      message: clip(`Đang xử lý ${cur}/${total}: ${inventoryId}`),
    })
    try {
      const out = await processInventoryProduct({
        partnerId,
        inventoryId,
        ctx: {
          language: payload.language || 'vi',
          geminiMode,
          allowsAi,
          force: Boolean(payload.force),
          dry_run: Boolean(payload.dry_run),
          geminiImageModel: payload.gemini_image_model,
          geminiImageSize: payload.gemini_image_size,
          openaiImageModel: payload.openai_image_model,
          openaiImageQuality: payload.openai_image_quality,
          openaiImageSize: payload.openai_image_size,
          logoUrl,
          shouldCancel: () => isForceAborted(partnerId, jobId),
        },
        progressCb,
      })
      processedSet.add(inventoryId)
      processed.push(inventoryId)
      if (out.status === 'failed') {
        failed += 1
        consecutiveFails += 1
      } else if (out.status === 'skipped') {
        skipped += 1
        consecutiveFails = 0
        skippedReports.push({ product_id: inventoryId, message: out.message })
      } else {
        done += 1
        consecutiveFails = 0
      }
      recent.push({
        product_id: inventoryId,
        status: out.status,
        message: clip(out.message, 400),
        processed_images: out.processed_images,
        failed_images: out.failed_images,
      })
      if (recent.length > 40) recent.splice(0, recent.length - 40)
      const p = progress(done, failed, skipped, total)
      await updateImageLocJobFromPg(partnerId, jobId, {
        done,
        failed,
        skipped,
        current: p.current,
        percent: p.percent,
        processed_product_ids: processed,
        recent_results: recent,
        skipped_product_reports: skippedReports.slice(-120),
        current_product_id: null,
        message: clip(out.message),
      })
      if (consecutiveFails >= imageLocMaxConsecutiveProductFailures()) {
        const p2 = progress(done, failed, skipped, total)
        await updateImageLocJobFromPg(partnerId, jobId, {
          status: 'error',
          phase: 'stopped',
          message: `Dừng job: ${consecutiveFails} sản phẩm lỗi liên tiếp.`,
          finished_at: new Date().toISOString(),
          current: p2.current,
          percent: p2.percent,
        })
        return
      }
    } catch (e) {
      if (isImageLocalizationFatalDependencyError(e)) {
        await updateImageLocJobFromPg(partnerId, jobId, {
          status: 'error',
          phase: 'fatal',
          message: clip(e instanceof Error ? e.message : String(e)),
          finished_at: new Date().toISOString(),
        })
        return
      }
      if (e instanceof ImageLocalizationError && e.message === 'Job đã bị hủy') {
        await finalizeCancelled(partnerId, jobId, done, failed, skipped, total, processed, recent, skippedReports)
        return
      }
      processedSet.add(inventoryId)
      processed.push(inventoryId)
      failed += 1
      consecutiveFails += 1
      recent.push({
        product_id: inventoryId,
        status: 'error',
        message: clip(e instanceof Error ? e.message : String(e), 400),
      })
      const p = progress(done, failed, skipped, total)
      await updateImageLocJobFromPg(partnerId, jobId, {
        done,
        failed,
        skipped,
        current: p.current,
        percent: p.percent,
        processed_product_ids: processed,
        recent_results: recent,
        current_product_id: null,
        message: clip(e instanceof Error ? e.message : String(e)),
      })
    }
  }

  if (isForceAborted(partnerId, jobId) || (await jobCancelled(partnerId, jobId))) {
    await finalizeCancelled(partnerId, jobId, done, failed, skipped, total, processed, recent, skippedReports)
    return
  }

  const p = progress(done, failed, skipped, total)
  await updateImageLocJobFromPg(partnerId, jobId, {
    status: 'done',
    phase: 'done',
    message: `Xong: ${done} OK · ${failed} lỗi · ${skipped} bỏ qua`,
    current: p.current,
    percent: 100,
    finished_at: new Date().toISOString(),
    current_product_id: null,
    processed_product_ids: processed,
    recent_results: recent,
    skipped_product_reports: skippedReports.slice(-120),
    done,
    failed,
    skipped,
  })
}

async function finalizeCancelled(
  partnerId: string,
  jobId: string,
  done: number,
  failed: number,
  skipped: number,
  total: number,
  processed: string[],
  recent: ImageLocRecentResult[],
  skippedReports: ImageLocSkippedReport[]
) {
  const leftover = (await fetchImageLocJobFromPg(partnerId, jobId))?.queue_product_ids || []
  const remain = leftover.filter((id) => !processed.includes(id))
  if (remain.length) await resetStaleImageLocProcessingFromPg(partnerId, remain)
  const p = progress(done, failed, skipped, total)
  await updateImageLocJobFromPg(partnerId, jobId, {
    status: 'cancelled',
    phase: 'cancelled',
    cancel_requested: true,
    message: 'Đã hủy job bản địa hóa ảnh',
    finished_at: new Date().toISOString(),
    current: p.current,
    percent: p.percent,
    current_product_id: null,
    processed_product_ids: processed,
    recent_results: recent,
    skipped_product_reports: skippedReports.slice(-120),
    done,
    failed,
    skipped,
  })
}

function spawn(partnerId: string, jobId: string, resume: boolean) {
  const key = workerKey(partnerId, jobId)
  if (workerRegistry.has(key)) return
  const p = runJob(partnerId, jobId, resume)
    .catch((e) => {
      console.error('[image-localization] job failed', jobId, e)
      return updateImageLocJobFromPg(partnerId, jobId, {
        status: 'error',
        phase: 'error',
        message: clip(e instanceof Error ? e.message : String(e)),
        finished_at: new Date().toISOString(),
      })
    })
    .finally(() => {
      workerRegistry.delete(key)
      abortFlags.delete(key)
    })
  workerRegistry.set(key, p)
}

async function fetchPartnerLogoUrl(partnerId: string): Promise<string | null> {
  if (!isPgConfigured()) return null
  const row = await pgQueryOne<{ logo_url: string | null }>(
    `select logo_url from public.messaging_partners where id = $1::uuid limit 1`,
    [partnerId]
  )
  const u = String(row?.logo_url || '').trim()
  return /^https?:\/\//i.test(u) ? u : null
}

export async function startImageLocalizationJob(
  partnerId: string,
  payload: ImageLocStartPayload,
  createdBy?: string | null
): Promise<{ job_id: string; status: string }> {
  const lang = String(payload.language || 'vi').trim().toLowerCase()
  if (!(IMAGE_LOC_LANGUAGES as readonly string[]).includes(lang)) {
    throw new ImageLocalizationError('Ngôn ngữ không hỗ trợ. Dùng vi, en, th hoặc id.')
  }
  payload.language = lang as ImageLocStartPayload['language']
  if (!imageLocAiJobsAllowed() && payload.allow_ai_image_models !== false) {
    throw new ImageLocalizationError(
      'Server đang giới hạn chỉ pipeline OCR + DeepSeek + vẽ local — gửi allow_ai_image_models=false. Bật lại Gemini/GPT ảnh: IMAGE_LOCALIZATION_AI_IMAGE_JOBS_ALLOWED=true.'
    )
  }
  const skipAi = payload.allow_ai_image_models === false
  const mode = payload.gemini_mode === 'openai' ? 'openai' : imageLocDefaultGeminiMode()
  if (!skipAi) {
    if ((payload.gemini_mode || mode) === 'openai') {
      if (!openaiApiAuth(payload.openai_image_model).ready) {
        throw new ImageLocalizationError('Chế độ OpenAI GPT Image: thiếu OPENAI_API_KEY trong cấu hình backend.')
      }
    } else if (payload.gemini_mode === 'api' || payload.allow_ai_image_models === true) {
      if (!geminiApiAuth(payload.gemini_image_model).ready) {
        throw new ImageLocalizationError('Chế độ Gemini API: thiếu GEMINI_API_KEY trong cấu hình backend.')
      }
    }
  }
  void createdBy
  const jobId = randomUUID()
  const limit = payload.limit || imageLocBatchLimit() || 10000
  const queue = await listPendingImageLocInventoryIdsFromPg(partnerId, {
    force: Boolean(payload.force),
    productIds: payload.product_ids,
    limit,
  })
  if (!queue.length) {
    throw new ImageLocalizationError('Không có sản phẩm nào cần bản địa hóa ảnh.')
  }
  const truncated = queue.length > imageLocJobQueueIdsMax()
  const job: ImageLocJob = {
    job_id: jobId,
    partner_id: partnerId,
    status: 'queued',
    phase: 'queued',
    message: 'Đã xếp hàng bản địa hóa ảnh.',
    payload,
    current: 0,
    total: queue.length,
    done: 0,
    failed: 0,
    skipped: 0,
    percent: 0,
    current_product_id: null,
    cancel_requested: false,
    queue_product_ids: queue,
    processed_product_ids: [],
    job_queue_product_ids: queue,
    job_queue_truncated: truncated,
    recent_results: [],
    skipped_product_reports: [],
    language: payload.language,
    force: Boolean(payload.force),
    dry_run: Boolean(payload.dry_run),
    gemini_mode: payload.gemini_mode || imageLocDefaultGeminiMode(),
    local_image_only: payload.allow_ai_image_models === false,
    resume_count: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    started_at: null,
    finished_at: null,
  }
  await insertImageLocJobFromPg(job)
  spawn(partnerId, jobId, false)
  return { job_id: jobId, status: 'queued' }
}

export async function cancelImageLocalizationJob(
  partnerId: string,
  jobId: string,
  mode: 'graceful' | 'force' = 'graceful'
): Promise<ImageLocJob | null> {
  const job = await fetchImageLocJobFromPg(partnerId, jobId)
  if (!job) return null
  abortFlags.set(workerKey(partnerId, jobId), mode)
  await updateImageLocJobFromPg(partnerId, jobId, {
    cancel_requested: true,
    message: mode === 'force' ? 'Đang hủy ngay…' : 'Sẽ hủy sau sản phẩm hiện tại…',
  })
  if (mode === 'force') {
    const leftover = uniqueIds(job.queue_product_ids).filter((id) => !uniqueIds(job.processed_product_ids).includes(id))
    if (leftover.length) await resetStaleImageLocProcessingFromPg(partnerId, leftover)
    await updateImageLocJobFromPg(partnerId, jobId, {
      status: 'cancelled',
      phase: 'cancelled',
      message: 'Đã hủy ngay job bản địa hóa ảnh',
      finished_at: new Date().toISOString(),
      current_product_id: null,
    })
  }
  return fetchImageLocJobFromPg(partnerId, jobId)
}

export async function resumeImageLocalizationAfterRestart(): Promise<{ resumed: number; skipped: number }> {
  const jobs = await listResumableImageLocJobsFromPg()
  let resumed = 0
  let skipped = 0
  for (const job of jobs) {
    if (job.resume_count >= imageLocMaxAutoResumeCount()) {
      skipped += 1
      continue
    }
    if (imageLocWorkerAlive(job.partner_id, job.job_id)) continue
    spawn(job.partner_id, job.job_id, true)
    resumed += 1
  }
  return { resumed, skipped }
}

export { deleteTerminalImageLocJobsFromPg }
