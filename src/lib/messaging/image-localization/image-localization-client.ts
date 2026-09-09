import type {
  ImageLocAuthStatus,
  ImageLocJob,
  ImageLocJobList,
  ImageLocProductReport,
  ImageLocStartPayload,
  ImageLocSummary,
} from './image-localization-types'

function base(partnerId: string): string {
  return `/api/messaging/partners/${encodeURIComponent(partnerId)}/image-localization`
}

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
  })
  const data = (await res.json().catch(() => ({}))) as T & { error?: string; detail?: string }
  if (!res.ok) {
    throw new Error(data.detail || data.error || `HTTP ${res.status}`)
  }
  return data
}

export const imageLocalizationClient = {
  geminiAuth(partnerId: string, language = 'vi') {
    const u = new URL(base(partnerId) + '/settings/gemini-auth', window.location.origin)
    u.searchParams.set('language', language)
    return json<ImageLocAuthStatus>(u.pathname + u.search)
  },
  setDeepseekOffPeak(partnerId: string, enabled: boolean) {
    return json<{ deepseek_pricing: ImageLocAuthStatus['deepseek_pricing'] }>(
      `${base(partnerId)}/settings/deepseek-off-peak`,
      { method: 'PATCH', body: JSON.stringify({ enabled }) }
    )
  },
  summary(partnerId: string) {
    return json<ImageLocSummary>(`${base(partnerId)}/summary`)
  },
  startJob(partnerId: string, payload: ImageLocStartPayload) {
    return json<{ job_id: string; status: string }>(`${base(partnerId)}/jobs`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },
  listJobs(partnerId: string, opts?: { limit?: number; activeOnly?: boolean }) {
    const u = new URL(base(partnerId) + '/jobs', window.location.origin)
    u.searchParams.set('limit', String(opts?.limit ?? 40))
    if (opts?.activeOnly) u.searchParams.set('active_only', '1')
    return json<ImageLocJobList>(u.pathname + u.search)
  },
  getJob(partnerId: string, jobId: string) {
    return json<ImageLocJob>(`${base(partnerId)}/jobs/${encodeURIComponent(jobId)}`)
  },
  cancelJob(partnerId: string, jobId: string, mode: 'graceful' | 'force' = 'graceful') {
    const u = new URL(`${base(partnerId)}/jobs/${encodeURIComponent(jobId)}/cancel`, window.location.origin)
    u.searchParams.set('mode', mode)
    return json<ImageLocJob>(u.pathname + u.search, { method: 'POST' })
  },
  deleteJob(partnerId: string, jobId: string) {
    return json<{ deleted: true; job_id: string }>(`${base(partnerId)}/jobs/${encodeURIComponent(jobId)}`, {
      method: 'DELETE',
    })
  },
  deleteTerminalJobs(partnerId: string) {
    return json<{ deleted: number }>(`${base(partnerId)}/jobs/terminal`, { method: 'DELETE' })
  },
  productReport(partnerId: string, inventoryId: string) {
    return json<ImageLocProductReport>(`${base(partnerId)}/products/${encodeURIComponent(inventoryId)}/report`)
  },
}
