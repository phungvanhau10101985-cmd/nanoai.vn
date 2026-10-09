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
  applyImageLocProductResultFromPg,
} from '@/lib/db/messaging-partner-image-localization-pg'
import { ensureBunnyWritableBeforeImageModel } from '@/lib/storage/partner-bunny-cdn'
import {
  imageLocAiExplicitOnly,
  imageLocAiJobsAllowed,
  imageLocBatchLimit,
  imageLocJobQueueIdsMax,
  imageLocMaxAutoResumeCount,
  imageLocMaxConsecutiveProductFailures,
  imageLocStallMinutes,
} from './image-localization-config'
import { isDeepseekPeakUtc, offPeakWaitMessageVi, secondsUntilDeepseekOffPeak } from './deepseek-pricing'
import { processInventoryProduct } from './process-product'
import { loadImageLocBrandLogoBytes } from './overlay-brand-logo'
import { ImageLocalizationError, isImageLocalizationFatalDependencyError } from './gemini-adapter'
import { isImageLocalizationGptStopError, openaiApiAuth } from './openai-adapter'
import { notifyNanoAiAdminsImageLocGptStopped } from './gpt-stop-notify'
import {
  IMAGE_LOC_LANGUAGES,
  type ImageLocJob,
  type ImageLocRecentResult,
  type ImageLocSkippedReport,
  type ImageLocStartPayload,
} from './image-localization-types'

type WorkerHandle = { promise: Promise<void>; epoch: number }
const workerRegistry = new Map<string, WorkerHandle>()
const workerEpoch = new Map<string, number>()
const abortFlags = new Map<string, 'graceful' | 'force'>()

function workerKey(partnerId: string, jobId: string): string {
  return `${partnerId}:${jobId}`
}

function isForceAborted(partnerId: string, jobId: string): boolean {
  return abortFlags.get(workerKey(partnerId, jobId)) === 'force'
}

function workerSuperseded(partnerId: string, jobId: string, epoch: number): boolean {
  return workerEpoch.get(workerKey(partnerId, jobId)) !== epoch
}

function shouldStopWorker(partnerId: string, jobId: string, epoch: number): boolean {
  return isForceAborted(partnerId, jobId) || workerSuperseded(partnerId, jobId, epoch)
}

export function imageLocJobIsStalled(job: Pick<ImageLocJob, 'status' | 'phase' | 'updated_at'>, now = Date.now()): boolean {
  if (String(job.status || '').toLowerCase() !== 'running') return false
  if (String(job.phase || '').toLowerCase() === 'waiting_off_peak') return false
  const updated = Date.parse(String(job.updated_at || ''))
  return Number.isFinite(updated) && now - updated >= imageLocStallMinutes() * 60_000
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

/** Số lần cron đã spawn lại job trong process hiện tại. Deploy/restart PM2 tạo process mới nên đếm lại từ 0. */
const resumeAttemptsThisProcess = new Map<string, number>()

export type ImageLocAutoResumeDecision = 'running' | 'resume' | 'skip-cap'

/**
 * Job queued/running chưa xong phải được chạy lại sau deploy.
 * Trần chỉ chặn vòng crash lặp trong cùng process — không dùng resume_count trên DB.
 */
export function imageLocShouldAutoResume(input: {
  workerAlive: boolean
  stalled: boolean
  attemptsThisProcess: number
  maxAttempts: number
}): ImageLocAutoResumeDecision {
  if (input.workerAlive && !input.stalled) return 'running'
  const max = input.maxAttempts > 0 ? input.maxAttempts : 6
  if (input.attemptsThisProcess >= max) return 'skip-cap'
  return 'resume'
}

async function jobCancelled(partnerId: string, jobId: string): Promise<boolean> {
  const row = await fetchImageLocJobFromPg(partnerId, jobId)
  if (!row) return true
  const st = (row.status || '').toLowerCase()
  return st === 'cancelled' || Boolean(row.cancel_requested)
}

async function waitOffPeak(partnerId: string, job: ImageLocJob, epoch: number): Promise<boolean> {
  const settings = await fetchImageLocSettingsFromPg(partnerId)
  if (!settings.deepseek_off_peak_only) return true
  while (isDeepseekPeakUtc()) {
    if (shouldStopWorker(partnerId, job.job_id, epoch) || (await jobCancelled(partnerId, job.job_id))) return false
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

async function runJob(partnerId: string, jobId: string, resume: boolean, epoch: number): Promise<void> {
  const job = await fetchImageLocJobFromPg(partnerId, jobId)
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

  const localizationSettings = await fetchImageLocSettingsFromPg(partnerId)
  const logoUrl = localizationSettings.logo_url
  const logoBytes = await loadImageLocBrandLogoBytes(logoUrl)

  const allowsAi = payload.allow_ai_image_models === true ? true : payload.allow_ai_image_models === false ? false : !imageLocAiExplicitOnly()
  const geminiMode = 'openai' as const
  let consecutiveFails = 0

  if (!(await waitOffPeak(partnerId, { ...job, done, failed, skipped, total }, epoch))) {
    if (workerSuperseded(partnerId, jobId, epoch)) return
    await finalizeCancelled(partnerId, jobId, done, failed, skipped, total, processed, recent, skippedReports)
    return
  }

  if (total > 0) {
    const bunnyReady = await ensureBunnyWritableBeforeImageModel(partnerId)
    if (!bunnyReady.ok) {
      await updateImageLocJobFromPg(partnerId, jobId, {
        status: 'error',
        phase: 'error',
        message: clip(bunnyReady.error),
        finished_at: new Date().toISOString(),
      })
      return
    }
  }

  for (const inventoryId of queue) {
    if (processedSet.has(inventoryId)) continue
    if (workerSuperseded(partnerId, jobId, epoch)) return
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
          logoBytes,
          shouldCancel: () => shouldStopWorker(partnerId, jobId, epoch),
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
      if (isImageLocalizationGptStopError(e)) {
        const detail = e instanceof Error ? e.message : String(e)
        failed += 1
        processedSet.add(inventoryId)
        processed.push(inventoryId)
        recent.push({
          product_id: inventoryId,
          status: 'error',
          message: clip(`GPT Image lỗi — dừng job — ${detail}`, 400),
        })
        if (recent.length > 40) recent.splice(0, recent.length - 40)
        const pStop = progress(done, failed, skipped, total)
        const stopMessage = `Dừng job: GPT Image lỗi ở ${inventoryId}. ${detail}`
        await applyImageLocProductResultFromPg({
          partnerId,
          inventoryId,
          language: payload.language || 'vi',
          status: 'failed',
          error: clip(stopMessage, 2000),
        }).catch((error) => {
          console.warn('[image-localization] không lưu được trạng thái SP khi GPT dừng:', error)
        })
        await updateImageLocJobFromPg(partnerId, jobId, {
          status: 'error',
          phase: 'stopped',
          done,
          failed,
          skipped,
          current: pStop.current,
          percent: pStop.percent,
          processed_product_ids: processed,
          recent_results: recent,
          current_product_id: null,
          message: clip(stopMessage),
          finished_at: new Date().toISOString(),
        })
        await notifyNanoAiAdminsImageLocGptStopped({
          partnerId,
          jobId,
          inventoryId,
          detail,
        })
        return
      }
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
        if (workerSuperseded(partnerId, jobId, epoch)) return
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

  if (workerSuperseded(partnerId, jobId, epoch)) return
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

function spawn(partnerId: string, jobId: string, resume: boolean, replaceStalled = false) {
  const key = workerKey(partnerId, jobId)
  if (workerRegistry.has(key) && !replaceStalled) return
  const epoch = (workerEpoch.get(key) || 0) + 1
  workerEpoch.set(key, epoch)
  const p = runJob(partnerId, jobId, resume, epoch)
    .catch((e) => {
      if (workerSuperseded(partnerId, jobId, epoch)) return
      console.error('[image-localization] job failed', jobId, e)
      return updateImageLocJobFromPg(partnerId, jobId, {
        status: 'error',
        phase: 'error',
        message: clip(e instanceof Error ? e.message : String(e)),
        finished_at: new Date().toISOString(),
      })
    })
    .finally(() => {
      if (workerEpoch.get(key) === epoch) {
        workerRegistry.delete(key)
        workerEpoch.delete(key)
        abortFlags.delete(key)
      }
    })
  workerRegistry.set(key, { promise: p, epoch })
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
      'Server đang giới hạn chỉ pipeline OCR + DeepSeek + vẽ local — gửi allow_ai_image_models=false. Bật lại GPT ảnh: IMAGE_LOCALIZATION_AI_IMAGE_JOBS_ALLOWED=true.'
    )
  }
  const skipAi = payload.allow_ai_image_models === false
  if (!skipAi && !openaiApiAuth(payload.openai_image_model).ready) {
    throw new ImageLocalizationError('Chế độ GPT Image: thiếu OPENAI_API_KEY trong cấu hình backend.')
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
    gemini_mode: payload.allow_ai_image_models === false ? null : 'openai',
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
  const maxAttempts = imageLocMaxAutoResumeCount()
  let resumed = 0
  let skipped = 0
  for (const job of jobs) {
    const key = workerKey(job.partner_id, job.job_id)
    const workerAlive = imageLocWorkerAlive(job.partner_id, job.job_id)
    const decision = imageLocShouldAutoResume({
      workerAlive,
      stalled: imageLocJobIsStalled(job),
      attemptsThisProcess: resumeAttemptsThisProcess.get(key) || 0,
      maxAttempts,
    })
    if (decision === 'running') continue
    if (decision === 'skip-cap') {
      skipped += 1
      continue
    }
    resumeAttemptsThisProcess.set(key, (resumeAttemptsThisProcess.get(key) || 0) + 1)
    spawn(job.partner_id, job.job_id, true, workerAlive)
    resumed += 1
  }
  return { resumed, skipped }
}

export { deleteTerminalImageLocJobsFromPg }
