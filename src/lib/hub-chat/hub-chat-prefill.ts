export const HUB_PREFILL_STORAGE_KEY = 'nanoai_hub_prefill'
export const HUB_ACTIVE_PLAN_KEY = 'nanoai_hub_active_plan'
export const HUB_THREAD_STORAGE_KEY = 'nanoai_hub_thread_id'

export type HubPrefillPayload = {
  href: string
  prompt: string
  planId?: string
  stepIndex?: number
  savedAt: number
}

export type HubActivePlanContext = {
  planId: string
  stepIndex: number
  title: string
  totalSteps: number
}

export function saveHubPrefill(
  href: string,
  prompt: string,
  ctx?: { planId?: string; stepIndex?: number }
): void {
  if (typeof window === 'undefined') return
  const payload: HubPrefillPayload = {
    href,
    prompt: prompt.trim(),
    planId: ctx?.planId,
    stepIndex: ctx?.stepIndex,
    savedAt: Date.now(),
  }
  try {
    sessionStorage.setItem(HUB_PREFILL_STORAGE_KEY, JSON.stringify(payload))
  } catch {
    /* ignore */
  }
}

export function saveHubActivePlanContext(ctx: HubActivePlanContext): void {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(HUB_ACTIVE_PLAN_KEY, JSON.stringify(ctx))
  } catch {
    /* ignore */
  }
}

export function readHubActivePlanContext(): HubActivePlanContext | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(HUB_ACTIVE_PLAN_KEY)
    if (!raw) return null
    const p = JSON.parse(raw) as Partial<HubActivePlanContext>
    if (!p.planId || p.stepIndex == null) return null
    return {
      planId: String(p.planId),
      stepIndex: Number(p.stepIndex),
      title: String(p.title ?? ''),
      totalSteps: Number(p.totalSteps ?? 0),
    }
  } catch {
    return null
  }
}

export function clearHubActivePlanContext(): void {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.removeItem(HUB_ACTIVE_PLAN_KEY)
  } catch {
    /* ignore */
  }
}

export function readHubThreadId(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const id = sessionStorage.getItem(HUB_THREAD_STORAGE_KEY)
    return id?.trim() || null
  } catch {
    return null
  }
}

export function saveHubThreadId(threadId: string): void {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(HUB_THREAD_STORAGE_KEY, threadId)
  } catch {
    /* ignore */
  }
}

export function clearHubThreadId(): void {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.removeItem(HUB_THREAD_STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

export function openHubPlanStep(
  href: string,
  prefillPrompt: string,
  ctx: HubActivePlanContext
): void {
  saveHubPrefill(href, prefillPrompt, { planId: ctx.planId, stepIndex: ctx.stepIndex })
  saveHubActivePlanContext(ctx)
}

/** Đọc prefill nếu `href` khớp (exact hoặc cùng path prefix cho try-on). */
export function consumeHubPrefill(currentHref: string): HubPrefillPayload | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(HUB_PREFILL_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<HubPrefillPayload>
    const savedHref = String(parsed.href ?? '').trim()
    const prompt = String(parsed.prompt ?? '').trim()
    if (!savedHref || !prompt) return null
    const match =
      savedHref === currentHref ||
      (savedHref.startsWith('/thu-do-online') && currentHref.startsWith('/thu-do-online'))
    if (!match) return null
    sessionStorage.removeItem(HUB_PREFILL_STORAGE_KEY)
    return {
      href: savedHref,
      prompt,
      planId: parsed.planId,
      stepIndex: parsed.stepIndex,
      savedAt: Number(parsed.savedAt ?? Date.now()),
    }
  } catch {
    return null
  }
}
