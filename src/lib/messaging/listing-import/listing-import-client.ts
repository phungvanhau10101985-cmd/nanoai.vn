import type {
  ListingImportDraft,
  ListingImportQueueRunSummary,
  ListingImportQueueStatus,
} from '@/lib/messaging/listing-import/listing-import-types'

export type ListingImportQueueRunsResponse = {
  items: ListingImportQueueRunSummary[]
  total: number
  limit: number
  offset: number
}

type EnqueueItem = {
  url: string
  source?: string
  label?: string | null
  chinese_name?: string | null
  shop_name_chinese?: string | null
  price?: number | null
  pro_lower_price?: string | null
  pro_high_price?: string | null
}

async function parseError(res: Response): Promise<string> {
  const json = (await res.json().catch(() => null)) as { detail?: string; error?: string } | null
  return json?.detail || json?.error || res.statusText || 'Lỗi API'
}

export function listingImportClient(partnerId: string) {
  const base = `/api/messaging/partners/${encodeURIComponent(partnerId)}/listing-import`

  async function jsonFetch<T>(path: string, init?: RequestInit & { timeoutMs?: number }): Promise<T> {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), init?.timeoutMs ?? 60_000)
    try {
      const res = await fetch(`${base}/${path.replace(/^\//, '')}`, {
        ...init,
        signal: ctrl.signal,
        cache: 'no-store',
        headers: { ...(init?.headers || {}), ...(init?.body ? { 'Content-Type': 'application/json' } : {}) },
      })
      if (!res.ok) throw new Error(await parseError(res))
      return (await res.json()) as T
    } finally {
      clearTimeout(t)
    }
  }

  return {
    listingParserDbPresence: (
      ids: string[],
      opts?: { includeDoneDrafts?: boolean; productsActiveOnly?: boolean }
    ) =>
      jsonFetch<{ existing_normalized: string[] }>('listing-parser-db-presence', {
        method: 'POST',
        body: JSON.stringify({
          ids,
          include_done_drafts: opts?.includeDoneDrafts ?? true,
          products_active_only: opts?.productsActiveOnly ?? false,
        }),
        timeoutMs: 60_000,
      }),

    enqueueListingImportQueue: (params: { queue_token?: string | null; items: EnqueueItem[] }) =>
      jsonFetch<{ queue_token: string; added: number; message: string }>('listing-queue/enqueue', {
        method: 'POST',
        body: JSON.stringify({ queue_token: params.queue_token ?? undefined, items: params.items }),
        timeoutMs: 120_000,
      }),

    getListingImportQueueStatus: (queueToken: string) =>
      jsonFetch<ListingImportQueueStatus>(`listing-queue/${encodeURIComponent(queueToken)}`, { timeoutMs: 120_000 }),

    pauseListingImportQueue: (queueToken: string) =>
      jsonFetch<{ queue_token: string; message: string }>(
        `listing-queue/${encodeURIComponent(queueToken)}/pause`,
        { method: 'POST', timeoutMs: 30_000 }
      ),

    resumeListingImportQueue: (queueToken: string) =>
      jsonFetch<{ queue_token: string; message: string }>(
        `listing-queue/${encodeURIComponent(queueToken)}/resume`,
        { method: 'POST', timeoutMs: 60_000 }
      ),

    stopListingImportQueue: (queueToken: string) =>
      jsonFetch<{ queue_token: string; message: string }>(
        `listing-queue/${encodeURIComponent(queueToken)}/stop`,
        { method: 'POST', timeoutMs: 60_000 }
      ),

    listListingImportQueueRuns: (params?: { limit?: number; offset?: number }) => {
      const limit = params?.limit ?? 50
      const offset = params?.offset ?? 0
      return jsonFetch<ListingImportQueueRunsResponse>(
        `listing-queue/runs?limit=${encodeURIComponent(String(limit))}&offset=${encodeURIComponent(String(offset))}`,
        { timeoutMs: 60_000 }
      )
    },

    deleteListingImportQueueSaved: (queueToken: string) =>
      jsonFetch<{ queue_token: string; deleted: boolean }>(`listing-queue/${encodeURIComponent(queueToken)}`, {
        method: 'DELETE',
        timeoutMs: 30_000,
      }),

    downloadListingImportQueueCsv: async (queueToken: string, options?: { finishedOnly?: boolean }) => {
      const qs = options?.finishedOnly === true ? '?finished_only=true' : ''
      const res = await fetch(`${base}/listing-queue/${encodeURIComponent(queueToken)}/export.csv${qs}`, {
        cache: 'no-store',
      })
      if (!res.ok) throw new Error(await parseError(res))
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `listing_import_queue_${queueToken.slice(0, 12)}${options?.finishedOnly ? '_ket_qua' : '_snapshot'}.csv`
      a.click()
      URL.revokeObjectURL(url)
    },

    downloadListingImportQueueProductsExcel: async (queueToken: string) => {
      const res = await fetch(`${base}/listing-queue/${encodeURIComponent(queueToken)}/export-products.xlsx`, {
        cache: 'no-store',
      })
      if (!res.ok) throw new Error(await parseError(res))
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `listing_queue_products_${queueToken.slice(0, 12)}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    },

    downloadListingLinkTemplateExcel: async (
      rows: Array<{
        product_id: string
        url: string
        shop_name_chinese: string
        china_price: number | null
        chinese_name: string
      }>
    ) => {
      const res = await fetch(`${base}/export-listing-link-template.xlsx`, {
        method: 'POST',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows }),
      })
      if (!res.ok) throw new Error(await parseError(res))
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `listing_link_selected_${rows.length}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    },

    getImport1688Draft: (draftId: string) =>
      jsonFetch<ListingImportDraft>(`drafts/${encodeURIComponent(draftId)}`, { timeoutMs: 60_000 }),

    publishImport1688Draft: (draftId: string) =>
      jsonFetch<{ success: boolean; action: 'created' | 'updated'; product_id: string; slug?: string }>(
        `drafts/${encodeURIComponent(draftId)}/publish`,
        { method: 'POST', timeoutMs: 120_000 }
      ),

    getListingImportCookieSettings: () =>
      jsonFetch<{
        enabled: boolean
        has_cookie: boolean
        cookie_count: number
        cookie_names: string[]
        cookie_domains: string[]
        cookie_status: string
        cookie_warnings: string[]
        cookies_all_expired: boolean
        cookies_expired_count: number
        usage_note: string
        message: string | null
        pandamall_username: string
        has_pandamall_password: boolean
      }>('settings/cookie', { timeoutMs: 30_000 }),

    saveListingImportCookieSettings: (body: {
      cookie_text?: string
      pandamall_username?: string
      pandamall_password?: string
    }) =>
      jsonFetch<{
        has_cookie: boolean
        cookie_count: number
        cookie_status: string
        cookie_warnings: string[]
        message: string | null
        pandamall_username: string
        has_pandamall_password: boolean
      }>('settings/cookie', { method: 'POST', body: JSON.stringify(body), timeoutMs: 30_000 }),

    clearListingImportCookies: () =>
      jsonFetch<{ has_cookie: boolean; cookie_count: number; message: string | null }>('settings/cookie', {
        method: 'DELETE',
        timeoutMs: 30_000,
      }),
  }
}
