import type {
  SourceStockActivityReport,
  SourceStockDomain,
  SourceStockPreviewUrlResult,
  SourceStockQueueStats,
  SourceStockWorkerState,
} from './source-stock-types'

function base(partnerId: string): string {
  return `/api/messaging/partners/${encodeURIComponent(partnerId)}/source-stock-check`
}

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
  })
  const data = (await res.json().catch(() => ({}))) as T & { error?: string; detail?: string }
  if (!res.ok) {
    throw new Error((data as { detail?: string; error?: string }).detail || (data as { error?: string }).error || `HTTP ${res.status}`)
  }
  return data
}

export const sourceStockClient = {
  queueStats(partnerId: string, domain: SourceStockDomain, activeOnly = true) {
    const u = new URL(base(partnerId) + '/queue-stats', window.location.origin)
    u.searchParams.set('domain', domain)
    u.searchParams.set('active_only', activeOnly ? '1' : '0')
    return json<SourceStockQueueStats>(u.pathname + u.search)
  },
  workerState(partnerId: string) {
    return json<{ ok: true } & SourceStockWorkerState>(`${base(partnerId)}/worker-state`)
  },
  workerPause(partnerId: string, paused: boolean) {
    return json<{ ok: true } & SourceStockWorkerState>(`${base(partnerId)}/worker-pause`, {
      method: 'POST',
      body: JSON.stringify({ paused }),
    })
  },
  report(
    partnerId: string,
    opts: {
      domain: SourceStockDomain
      activeOnly?: boolean
      windowDays?: number
      oosPage?: number
      inStockPage?: number
      ttlPage?: number
      pageSize?: number
    }
  ) {
    const u = new URL(base(partnerId) + '/report', window.location.origin)
    u.searchParams.set('domain', opts.domain)
    u.searchParams.set('active_only', opts.activeOnly === false ? '0' : '1')
    u.searchParams.set('window_days', String(opts.windowDays ?? 30))
    u.searchParams.set('samples_oos_page', String(opts.oosPage ?? 1))
    u.searchParams.set('samples_in_stock_page', String(opts.inStockPage ?? 1))
    u.searchParams.set('samples_batch_ttl_page', String(opts.ttlPage ?? 1))
    u.searchParams.set('sample_page_size', String(opts.pageSize ?? 200))
    return json<SourceStockActivityReport>(u.pathname + u.search)
  },
  previewUrl(partnerId: string, url: string) {
    return json<SourceStockPreviewUrlResult>(`${base(partnerId)}/preview-url`, {
      method: 'POST',
      body: JSON.stringify({ url }),
    })
  },
  resetPdp(partnerId: string, domain: SourceStockDomain) {
    return json<{ ok: true; products_updated: number; memory_queue_cleared: number }>(
      `${base(partnerId)}/reset-pdp-cycle`,
      { method: 'POST', body: JSON.stringify({ domain, active_only: true }) }
    )
  },
  deleteByIds(partnerId: string, dbIds: string[]) {
    return json<{ ok: true; deleted: number }>(`${base(partnerId)}/delete-by-db-ids`, {
      method: 'POST',
      body: JSON.stringify({ db_ids: dbIds }),
    })
  },
  clearOosFlag(partnerId: string, dbId: string) {
    return json<{ ok: true }>(`${base(partnerId)}/clear-oos-flag`, {
      method: 'POST',
      body: JSON.stringify({ db_id: dbId }),
    })
  },
  clearOosFlagBulk(partnerId: string, body: { db_ids?: string[]; all_in_window?: boolean; window_days?: number; domain?: string }) {
    return json<{ ok: true; cleared: number; restored_available: number }>(`${base(partnerId)}/clear-oos-flag-bulk`, {
      method: 'POST',
      body: JSON.stringify(body),
    })
  },
  forceRecheck(partnerId: string, dbId: string) {
    return json<{ ok: boolean; queued?: boolean }>(`${base(partnerId)}/force-worker-recheck`, {
      method: 'POST',
      body: JSON.stringify({ db_id: dbId }),
    })
  },
  oosIds(partnerId: string, domain: SourceStockDomain, windowDays = 30) {
    const u = new URL(base(partnerId) + '/oos-db-ids', window.location.origin)
    u.searchParams.set('domain', domain)
    u.searchParams.set('window_days', String(windowDays))
    u.searchParams.set('active_only', '1')
    return json<{ ok: true; ids: string[] }>(u.pathname + u.search)
  },
}
