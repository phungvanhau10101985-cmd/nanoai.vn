import { getPgPool, isPgConfigured } from '@/lib/db/pool'
import type { HubChatWorkflowSuggestion } from '@/app/api/hub-chat/route'
import { emptyStudioSession, type HubStudioMessagePayload, type HubStudioSession } from '@/lib/hub-chat/hub-studio-types'

export type HubPlanStepStatus = 'pending' | 'in_progress' | 'done' | 'skipped'
export type HubPlanStatus = 'active' | 'completed' | 'cancelled'

export type HubPlanAutoRunStatus = 'off' | 'queued' | 'running' | 'failed' | 'completed'

export type HubPlanStepRow = {
  id: string
  stepIndex: number
  href: string
  labelKey: string
  label: string
  prefillPrompt: string
  reason: string
  status: HubPlanStepStatus
  doneAt: string | null
  resultUrl: string | null
  errorMessage: string | null
  startedAt: string | null
  finishedAt: string | null
}

export type HubMultiTaskPlanRow = {
  id: string
  threadId: string | null
  title: string
  sourcePrompt: string
  locale: string
  status: HubPlanStatus
  currentStepIndex: number
  createdAt: string
  updatedAt: string
  autoRunStatus: HubPlanAutoRunStatus
  autoRunError: string | null
  inputImages: string[]
  estimatedCredits: number | null
  steps: HubPlanStepRow[]
}

export type HubChatMessageRow = {
  id: string
  role: 'user' | 'assistant'
  content: string
  workflows: HubChatWorkflowSuggestion[] | null
  planId: string | null
  studio: HubStudioMessagePayload | null
  createdAt: string
}

export type HubChatThreadRow = {
  id: string
  title: string
  locale: string
  createdAt: string
  updatedAt: string
  session: HubStudioSession | null
  messages: HubChatMessageRow[]
}

export type HubPlanStepInput = {
  href: string
  labelKey: string
  label: string
  prefillPrompt: string
  reason: string
}

function mapStepRow(r: Record<string, unknown>): HubPlanStepRow {
  return {
    id: String(r.id),
    stepIndex: Number(r.step_index),
    href: String(r.href),
    labelKey: String(r.label_key ?? ''),
    label: String(r.label ?? ''),
    prefillPrompt: String(r.prefill_prompt ?? ''),
    reason: String(r.reason ?? ''),
    status: String(r.status) as HubPlanStepStatus,
    doneAt: r.done_at ? String(r.done_at) : null,
    resultUrl: r.result_url ? String(r.result_url) : null,
    errorMessage: r.error_message ? String(r.error_message) : null,
    startedAt: r.started_at ? String(r.started_at) : null,
    finishedAt: r.finished_at ? String(r.finished_at) : null,
  }
}

function mapPlanRow(r: Record<string, unknown>, steps: HubPlanStepRow[]): HubMultiTaskPlanRow {
  const inputRaw = r.input_images_json
  let inputImages: string[] = []
  if (Array.isArray(inputRaw)) {
    inputImages = inputRaw.map((x) => String(x)).filter(Boolean)
  }
  return {
    id: String(r.id),
    threadId: r.thread_id ? String(r.thread_id) : null,
    title: String(r.title),
    sourcePrompt: String(r.source_prompt ?? ''),
    locale: String(r.locale ?? 'vi'),
    status: String(r.status) as HubPlanStatus,
    currentStepIndex: Number(r.current_step_index ?? 0),
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
    autoRunStatus: (String(r.auto_run_status ?? 'off') as HubPlanAutoRunStatus) || 'off',
    autoRunError: r.auto_run_error ? String(r.auto_run_error) : null,
    inputImages,
    estimatedCredits: r.estimated_credits != null ? Number(r.estimated_credits) : null,
    steps,
  }
}

const PLAN_SELECT_PLAIN = `id, thread_id, title, source_prompt, locale, status, current_step_index,
  auto_run_status, auto_run_error, input_images_json, estimated_credits,
  created_at::text, updated_at::text`

const PLAN_SELECT_ALIASED = `p.id, p.thread_id, p.title, p.source_prompt, p.locale, p.status, p.current_step_index,
  p.auto_run_status, p.auto_run_error, p.input_images_json, p.estimated_credits,
  p.created_at::text, p.updated_at::text`

const STEP_SELECT = `id, step_index, href, label_key, label, prefill_prompt, reason, status,
  done_at::text, result_url, error_message, started_at::text, finished_at::text`

export async function pgEnsureHubChatThread(
  userId: string,
  threadId: string | null | undefined,
  locale: string,
  titleHint: string
): Promise<string | null> {
  if (!isPgConfigured()) return null
  const pool = getPgPool()
  if (threadId) {
    const check = await pool.query(`select id::text from public.hub_chat_threads where id = $1::uuid and user_id = $2::uuid`, [
      threadId,
      userId,
    ])
    if (check.rows[0]) return String(check.rows[0].id)
  }
  const title = titleHint.trim().slice(0, 120) || 'NanoAI chat'
  const ins = await pool.query<{ id: string }>(
    `insert into public.hub_chat_threads (user_id, title, locale)
     values ($1::uuid, $2, $3)
     returning id::text`,
    [userId, title, locale]
  )
  return ins.rows[0]?.id ?? null
}

export async function pgInsertHubChatMessage(params: {
  threadId: string
  role: 'user' | 'assistant'
  content: string
  workflows?: HubChatWorkflowSuggestion[] | null
  planId?: string | null
  studio?: HubStudioMessagePayload | null
}): Promise<void> {
  if (!isPgConfigured()) return
  const pool = getPgPool()
  await pool.query(
    `insert into public.hub_chat_messages (thread_id, role, content, workflows_json, plan_id, studio_json)
     values ($1::uuid, $2, $3, $4::jsonb, $5::uuid, $6::jsonb)`,
    [
      params.threadId,
      params.role,
      params.content,
      params.workflows?.length ? JSON.stringify(params.workflows) : null,
      params.planId ?? null,
      params.studio ? JSON.stringify(params.studio) : null,
    ]
  )
  await pool.query(`update public.hub_chat_threads set updated_at = now() where id = $1::uuid`, [params.threadId])
}

export async function pgGetHubThreadSession(threadId: string): Promise<HubStudioSession | null> {
  if (!isPgConfigured()) return null
  const pool = getPgPool()
  const r = await pool.query<{ session_json: unknown }>(
    `select session_json from public.hub_chat_threads where id = $1::uuid`,
    [threadId]
  )
  const raw = r.rows[0]?.session_json
  if (!raw || typeof raw !== 'object') return null
  return { ...emptyStudioSession(), ...(raw as HubStudioSession) }
}

export async function pgSaveHubThreadSession(threadId: string, session: HubStudioSession): Promise<void> {
  if (!isPgConfigured()) return
  const pool = getPgPool()
  await pool.query(
    `update public.hub_chat_threads set session_json = $2::jsonb, updated_at = now() where id = $1::uuid`,
    [threadId, JSON.stringify(session)]
  )
}

export async function pgCreateHubMultiTaskPlan(params: {
  userId: string
  threadId: string | null
  title: string
  sourcePrompt: string
  locale: string
  steps: HubPlanStepInput[]
}): Promise<HubMultiTaskPlanRow | null> {
  if (!isPgConfigured() || params.steps.length < 2) return null
  const pool = getPgPool()
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const planRes = await client.query<Record<string, unknown>>(
      `insert into public.hub_multi_task_plans
         (user_id, thread_id, title, source_prompt, locale, status, current_step_index)
       values ($1::uuid, $2::uuid, $3, $4, $5, 'active', 0)
       returning ${PLAN_SELECT_PLAIN}`,
      [params.userId, params.threadId, params.title, params.sourcePrompt, params.locale]
    )
    const planRow = planRes.rows[0]
    if (!planRow) {
      await client.query('ROLLBACK')
      return null
    }
    const planId = String(planRow.id)
    const stepRows: HubPlanStepRow[] = []
    for (let i = 0; i < params.steps.length; i++) {
      const s = params.steps[i]!
      const st = await client.query<Record<string, unknown>>(
        `insert into public.hub_multi_task_steps
           (plan_id, step_index, href, label_key, label, prefill_prompt, reason, status)
         values ($1::uuid, $2, $3, $4, $5, $6, $7, $8)
         returning ${STEP_SELECT}`,
        [
          planId,
          i,
          s.href,
          s.labelKey,
          s.label,
          s.prefillPrompt,
          s.reason,
          i === 0 ? 'in_progress' : 'pending',
        ]
      )
      if (st.rows[0]) stepRows.push(mapStepRow(st.rows[0]))
    }
    await client.query('COMMIT')
    return mapPlanRow(planRow, stepRows)
  } catch (e) {
    try {
      await client.query('ROLLBACK')
    } catch {
      /* ignore */
    }
    console.error('[pgCreateHubMultiTaskPlan]', e)
    return null
  } finally {
    client.release()
  }
}

export async function pgListHubMultiTaskPlans(
  userId: string,
  opts?: { status?: HubPlanStatus | 'active_only'; limit?: number }
): Promise<HubMultiTaskPlanRow[]> {
  if (!isPgConfigured()) return []
  const pool = getPgPool()
  const limit = Math.min(50, Math.max(1, opts?.limit ?? 20))
  const statusFilter =
    opts?.status === 'active_only' || opts?.status === 'active'
      ? `and p.status = 'active'`
      : opts?.status
        ? `and p.status = $2`
        : ''
  const params: string[] = [userId]
  if (opts?.status && opts.status !== 'active_only' && opts.status !== 'active') params.push(opts.status)

  const plansRes = await pool.query<Record<string, unknown>>(
    `select ${PLAN_SELECT_ALIASED}
     from public.hub_multi_task_plans p
     where p.user_id = $1::uuid ${statusFilter}
     order by p.updated_at desc
     limit ${limit}`,
    params
  )
  const out: HubMultiTaskPlanRow[] = []
  for (const pr of plansRes.rows) {
    const planId = String(pr.id)
    const stepsRes = await pool.query<Record<string, unknown>>(
      `select ${STEP_SELECT}
       from public.hub_multi_task_steps where plan_id = $1::uuid order by step_index asc`,
      [planId]
    )
    out.push(mapPlanRow(pr, stepsRes.rows.map(mapStepRow)))
  }
  return out
}

export async function pgGetHubMultiTaskPlan(userId: string, planId: string): Promise<HubMultiTaskPlanRow | null> {
  if (!isPgConfigured()) return null
  const pool = getPgPool()
  const planRes = await pool.query<Record<string, unknown>>(
    `select ${PLAN_SELECT_PLAIN}
     from public.hub_multi_task_plans where id = $1::uuid and user_id = $2::uuid`,
    [planId, userId]
  )
  const pr = planRes.rows[0]
  if (!pr) return null
  const stepsRes = await pool.query<Record<string, unknown>>(
    `select ${STEP_SELECT}
     from public.hub_multi_task_steps where plan_id = $1::uuid order by step_index asc`,
    [planId]
  )
  return mapPlanRow(pr, stepsRes.rows.map(mapStepRow))
}

export async function pgAdvanceHubPlanStep(
  userId: string,
  planId: string,
  action: 'complete' | 'skip'
): Promise<HubMultiTaskPlanRow | null> {
  if (!isPgConfigured()) return null
  const pool = getPgPool()
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const planRes = await client.query<Record<string, unknown>>(
      `select ${PLAN_SELECT_PLAIN}
       from public.hub_multi_task_plans
       where id = $1::uuid and user_id = $2::uuid and status = 'active'
       for update`,
      [planId, userId]
    )
    const pr = planRes.rows[0]
    if (!pr) {
      await client.query('ROLLBACK')
      return null
    }
    const cur = Number(pr.current_step_index)
    const newStatus = action === 'complete' ? 'done' : 'skipped'
    await client.query(
      `update public.hub_multi_task_steps
       set status = $1, done_at = now()
       where plan_id = $2::uuid and step_index = $3`,
      [newStatus, planId, cur]
    )
    const nextIndex = cur + 1
    const countRes = await client.query<{ cnt: string }>(
      `select count(*)::text as cnt from public.hub_multi_task_steps where plan_id = $1::uuid`,
      [planId]
    )
    const total = Number(countRes.rows[0]?.cnt ?? 0)
    if (nextIndex >= total) {
      await client.query(
        `update public.hub_multi_task_plans set status = 'completed', current_step_index = $1, updated_at = now() where id = $2::uuid`,
        [cur, planId]
      )
    } else {
      await client.query(
        `update public.hub_multi_task_plans set current_step_index = $1, updated_at = now() where id = $2::uuid`,
        [nextIndex, planId]
      )
      await client.query(
        `update public.hub_multi_task_steps set status = 'in_progress' where plan_id = $1::uuid and step_index = $2 and status = 'pending'`,
        [planId, nextIndex]
      )
    }
    await client.query('COMMIT')
    return pgGetHubMultiTaskPlan(userId, planId)
  } catch (e) {
    try {
      await client.query('ROLLBACK')
    } catch {
      /* ignore */
    }
    console.error('[pgAdvanceHubPlanStep]', e)
    return null
  } finally {
    client.release()
  }
}

export async function pgCancelHubMultiTaskPlan(userId: string, planId: string): Promise<boolean> {
  if (!isPgConfigured()) return false
  const pool = getPgPool()
  const r = await pool.query(
    `update public.hub_multi_task_plans set status = 'cancelled', updated_at = now()
     where id = $1::uuid and user_id = $2::uuid and status = 'active'`,
    [planId, userId]
  )
  return (r.rowCount ?? 0) > 0
}

export async function pgQueueHubPlanAutoRun(
  userId: string,
  planId: string,
  params: { inputImages: string[]; estimatedCredits: number }
): Promise<HubMultiTaskPlanRow | null> {
  if (!isPgConfigured()) return null
  const pool = getPgPool()
  await pool.query(
    `update public.hub_multi_task_plans
     set auto_run_status = 'queued', auto_run_error = null,
         input_images_json = $3::jsonb, estimated_credits = $4, updated_at = now()
     where id = $1::uuid and user_id = $2::uuid and status = 'active'`,
    [planId, userId, JSON.stringify(params.inputImages), params.estimatedCredits]
  )
  return pgGetHubMultiTaskPlan(userId, planId)
}

export async function pgSetHubPlanAutoRunStatus(
  planId: string,
  status: HubPlanAutoRunStatus,
  error?: string | null
): Promise<void> {
  if (!isPgConfigured()) return
  const pool = getPgPool()
  await pool.query(
    `update public.hub_multi_task_plans
     set auto_run_status = $2, auto_run_error = $3, updated_at = now()
     where id = $1::uuid`,
    [planId, status, error ?? null]
  )
}

export async function pgMarkHubStepStarted(planId: string, stepIndex: number): Promise<void> {
  if (!isPgConfigured()) return
  const pool = getPgPool()
  await pool.query(
    `update public.hub_multi_task_steps
     set started_at = coalesce(started_at, now()), error_message = null
     where plan_id = $1::uuid and step_index = $2`,
    [planId, stepIndex]
  )
}

export async function pgMarkHubStepResult(
  planId: string,
  stepIndex: number,
  params: { resultUrl?: string | null; errorMessage?: string | null }
): Promise<void> {
  if (!isPgConfigured()) return
  const pool = getPgPool()
  await pool.query(
    `update public.hub_multi_task_steps
     set result_url = coalesce($3, result_url),
         error_message = $4,
         finished_at = case when $4 is null then now() else finished_at end
     where plan_id = $1::uuid and step_index = $2`,
    [planId, stepIndex, params.resultUrl ?? null, params.errorMessage ?? null]
  )
}

export async function pgListHubPlansForAutoWorker(limit = 5): Promise<HubMultiTaskPlanRow[]> {
  if (!isPgConfigured()) return []
  const pool = getPgPool()
  const plansRes = await pool.query<Record<string, unknown>>(
    `select ${PLAN_SELECT_PLAIN}
     from public.hub_multi_task_plans
     where status = 'active' and auto_run_status in ('queued', 'running')
     order by updated_at asc
     limit $1`,
    [limit]
  )
  const out: HubMultiTaskPlanRow[] = []
  for (const pr of plansRes.rows) {
    const planId = String(pr.id)
    const stepsRes = await pool.query<Record<string, unknown>>(
      `select ${STEP_SELECT}
       from public.hub_multi_task_steps where plan_id = $1::uuid order by step_index asc`,
      [planId]
    )
    out.push(mapPlanRow(pr, stepsRes.rows.map(mapStepRow)))
  }
  return out
}

export async function pgGetHubMultiTaskPlanById(planId: string): Promise<HubMultiTaskPlanRow | null> {
  if (!isPgConfigured()) return null
  const pool = getPgPool()
  const planRes = await pool.query<Record<string, unknown>>(
    `select ${PLAN_SELECT_PLAIN} from public.hub_multi_task_plans where id = $1::uuid`,
    [planId]
  )
  const pr = planRes.rows[0]
  if (!pr) return null
  const stepsRes = await pool.query<Record<string, unknown>>(
    `select ${STEP_SELECT} from public.hub_multi_task_steps where plan_id = $1::uuid order by step_index asc`,
    [planId]
  )
  return mapPlanRow(pr, stepsRes.rows.map(mapStepRow))
}

function parseWorkflowsJson(raw: unknown): HubChatWorkflowSuggestion[] | null {
  if (raw == null) return null
  if (Array.isArray(raw)) return raw as HubChatWorkflowSuggestion[]
  if (typeof raw === 'string') {
    try {
      const p = JSON.parse(raw)
      return Array.isArray(p) ? (p as HubChatWorkflowSuggestion[]) : null
    } catch {
      return null
    }
  }
  return null
}

export async function pgGetHubChatThread(userId: string, threadId: string): Promise<HubChatThreadRow | null> {
  if (!isPgConfigured()) return null
  const pool = getPgPool()
  const tRes = await pool.query<Record<string, unknown>>(
    `select id::text, title, locale, created_at::text, updated_at::text, session_json
     from public.hub_chat_threads where id = $1::uuid and user_id = $2::uuid`,
    [threadId, userId]
  )
  const tr = tRes.rows[0]
  if (!tr) return null
  const mRes = await pool.query<Record<string, unknown>>(
    `select id::text, role, content, workflows_json, plan_id::text, studio_json, created_at::text
     from public.hub_chat_messages where thread_id = $1::uuid order by created_at asc limit 80`,
    [threadId]
  )
  const messages: HubChatMessageRow[] = mRes.rows.map((m) => ({
    id: String(m.id),
    role: String(m.role) as 'user' | 'assistant',
    content: String(m.content),
    workflows: parseWorkflowsJson(m.workflows_json),
    planId: m.plan_id ? String(m.plan_id) : null,
    studio: m.studio_json && typeof m.studio_json === 'object' ? (m.studio_json as HubStudioMessagePayload) : null,
    createdAt: String(m.created_at),
  }))
  return {
    id: String(tr.id),
    title: String(tr.title),
    locale: String(tr.locale),
    createdAt: String(tr.created_at),
    updatedAt: String(tr.updated_at),
    session: tr.session_json && typeof tr.session_json === 'object' ? (tr.session_json as HubStudioSession) : null,
    messages,
  }
}
