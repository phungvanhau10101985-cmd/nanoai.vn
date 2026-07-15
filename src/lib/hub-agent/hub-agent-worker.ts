import {
  canAutoRunPlan,
  normalizePlanHref,
  planNeedsInputImages,
  type HubAutoRunImageQuality,
} from '@/lib/hub-agent/auto-run-support'
import { runBannerPipeline } from '@/lib/hub-agent/banner-pipeline'
import { runLyriaPipeline } from '@/lib/hub-agent/lyria-pipeline'
import { loadImageBufferFromUrl, runSharpenPipeline } from '@/lib/hub-agent/sharpen-pipeline'
import {
  pgAdvanceHubPlanStep,
  pgGetHubMultiTaskPlan,
  pgListHubPlansForAutoWorker,
  pgMarkHubStepResult,
  pgMarkHubStepStarted,
  pgSetHubPlanAutoRunStatus,
  type HubMultiTaskPlanRow,
} from '@/lib/db/hub-chat-pg'
import { uploadTryOnImagePublic } from '@/lib/storage/try-on-public-upload'

export type HubAgentWorkerResult = {
  processed: number
  completed: number
  failed: number
  details: { planId: string; ok: boolean; error?: string }[]
}

function currentStep(plan: HubMultiTaskPlanRow) {
  return (
    plan.steps.find((s) => s.status === 'in_progress') ??
    plan.steps[plan.currentStepIndex] ??
    null
  )
}

function previousStepResult(plan: HubMultiTaskPlanRow, stepIndex: number): string | null {
  for (let i = stepIndex - 1; i >= 0; i--) {
    const s = plan.steps.find((x) => x.stepIndex === i)
    if (s?.resultUrl) return s.resultUrl
  }
  return null
}

async function resolveInputImages(
  plan: HubMultiTaskPlanRow
): Promise<{ buffer: Buffer; mimeType: string }[]> {
  const out: { buffer: Buffer; mimeType: string }[] = []
  for (const url of plan.inputImages) {
    const loaded = await loadImageBufferFromUrl(url)
    if (loaded) out.push(loaded)
  }
  return out
}

async function executeStep(
  userId: string,
  plan: HubMultiTaskPlanRow,
  imageQuality: HubAutoRunImageQuality
): Promise<{ ok: true; resultUrl: string } | { ok: false; error: string }> {
  const step = currentStep(plan)
  if (!step) return { ok: false, error: 'Không có bước đang chạy.' }

  const href = normalizePlanHref(step.href)
  await pgMarkHubStepStarted(plan.id, step.stepIndex)

  if (href === '/tao-banner') {
    const images = await resolveInputImages(plan)
    if (!images.length) return { ok: false, error: 'Thiếu ảnh đầu vào cho bước tạo banner.' }
    const res = await runBannerPipeline({
      userId,
      imageBuffers: images,
      note: step.prefillPrompt,
      imageQuality,
    })
    if (!res.ok) return res
    return { ok: true, resultUrl: res.resultUrl }
  }

  if (href === '/lam-net-anh') {
    const prevUrl = previousStepResult(plan, step.stepIndex)
    if (!prevUrl) return { ok: false, error: 'Thiếu ảnh từ bước trước cho làm nét.' }
    const loaded = await loadImageBufferFromUrl(prevUrl)
    if (!loaded) return { ok: false, error: 'Không tải được ảnh từ bước trước.' }
    const res = await runSharpenPipeline({
      userId,
      imageBuffer: loaded.buffer,
      mimeType: loaded.mimeType,
      note: step.prefillPrompt,
      imageQuality,
    })
    if (!res.ok) return res
    return { ok: true, resultUrl: res.resultUrl }
  }

  if (href === '/tao-bai-hat-lyria-3') {
    const res = await runLyriaPipeline({
      userId,
      prompt: step.prefillPrompt || plan.sourcePrompt,
    })
    if (!res.ok) return res
    return { ok: true, resultUrl: res.resultUrl }
  }

  return { ok: false, error: `Tool chưa hỗ trợ auto-run: ${href}` }
}

/** Chạy một plan đến hết hoặc lỗi (sync). */
export async function runHubPlanAutoWorker(
  planId: string,
  opts: { userId: string; imageQuality?: HubAutoRunImageQuality; maxSteps?: number }
): Promise<{ ok: boolean; plan?: HubMultiTaskPlanRow; error?: string }> {
  const imageQuality = opts.imageQuality ?? '2K'
  const maxSteps = Math.min(6, Math.max(1, opts?.maxSteps ?? 4))
  const userId = opts.userId

  let plan = await pgGetHubMultiTaskPlan(userId, planId)
  if (!plan) return { ok: false, error: 'Không tìm thấy kế hoạch.' }
  if (plan.status !== 'active') return { ok: false, error: 'Kế hoạch không còn active.', plan }

  if (!canAutoRunPlan(plan.steps)) {
    return { ok: false, error: 'Kế hoạch không nằm trong danh sách auto-run.', plan }
  }
  if (planNeedsInputImages(plan.steps) && !plan.inputImages.length) {
    return { ok: false, error: 'Cần upload ảnh sản phẩm trước khi chạy tự động.', plan }
  }

  await pgSetHubPlanAutoRunStatus(planId, 'running')

  let stepsRun = 0
  while (stepsRun < maxSteps) {
    plan = (await pgGetHubMultiTaskPlan(userId, planId))!
    if (!plan || plan.status !== 'active') break

    const step = currentStep(plan)
    if (!step) {
      await pgSetHubPlanAutoRunStatus(planId, 'completed')
      return { ok: true, plan }
    }

    const result = await executeStep(userId, plan, imageQuality)
    if (!result.ok) {
      await pgMarkHubStepResult(planId, step.stepIndex, { errorMessage: result.error })
      await pgSetHubPlanAutoRunStatus(planId, 'failed', result.error)
      plan = (await pgGetHubMultiTaskPlan(userId, planId)) ?? plan
      return { ok: false, error: result.error, plan }
    }

    await pgMarkHubStepResult(planId, step.stepIndex, { resultUrl: result.resultUrl })
    const advanced = await pgAdvanceHubPlanStep(userId, planId, 'complete')
    plan = advanced ?? plan
    stepsRun += 1

    if (plan.status === 'completed') {
      await pgSetHubPlanAutoRunStatus(planId, 'completed')
      return { ok: true, plan }
    }
  }

  plan = (await pgGetHubMultiTaskPlan(userId, planId)) ?? plan
  if (plan.status === 'completed') {
    await pgSetHubPlanAutoRunStatus(planId, 'completed')
    return { ok: true, plan }
  }

  await pgSetHubPlanAutoRunStatus(planId, 'queued')
  return { ok: true, plan }
}

async function fetchPlanUserId(planId: string): Promise<string | null> {
  const { getPgPool, isPgConfigured } = await import('@/lib/db/pool')
  if (!isPgConfigured()) return null
  const pool = getPgPool()
  const r = await pool.query<{ user_id: string }>(
    `select user_id::text from public.hub_multi_task_plans where id = $1::uuid`,
    [planId]
  )
  return r.rows[0]?.user_id ?? null
}

/** Batch cron: xử lý các plan queued/running. */
export async function runHubPlanAutoWorkerBatch(limit = 3): Promise<HubAgentWorkerResult> {
  const plans = await pgListHubPlansForAutoWorker(limit)
  const details: HubAgentWorkerResult['details'] = []
  let completed = 0
  let failed = 0

  for (const p of plans) {
    const userId = await fetchPlanUserId(p.id)
    if (!userId) {
      details.push({ planId: p.id, ok: false, error: 'no_user' })
      failed += 1
      continue
    }
    const res = await runHubPlanAutoWorker(p.id, { userId, maxSteps: 4 })
    if (res.ok) {
      completed += 1
      details.push({ planId: p.id, ok: true })
    } else {
      failed += 1
      details.push({ planId: p.id, ok: false, error: res.error })
    }
  }

  return { processed: plans.length, completed, failed, details }
}

/** Upload ảnh đầu vào cho auto-run (từ FormData files). */
export async function uploadHubAutoRunImages(
  userId: string,
  files: { buffer: Buffer; mimeType: string }[]
): Promise<string[]> {
  const urls: string[] = []
  for (let i = 0; i < files.length; i++) {
    const f = files[i]!
    const path = `uploads/${userId}/hub_agent_${Date.now()}_${i}.png`
    const { publicUrl } = await uploadTryOnImagePublic(path, f.buffer, {
      contentType: f.mimeType || 'image/png',
    })
    urls.push(publicUrl)
  }
  return urls
}
