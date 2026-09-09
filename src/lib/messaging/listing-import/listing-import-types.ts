export type ListingImportRunStatus =
  | 'idle'
  | 'running'
  | 'pausing'
  | 'paused'
  | 'completed'
  | 'stopped'

export type ListingImportItemState = 'pending' | 'running' | 'done' | 'error'

export type ListingImportQueueItem = {
  id: string
  url: string
  source: 'vipomall' | 'pandamall'
  label?: string | null
  chinese_name?: string | null
  shop_name_chinese?: string | null
  price?: number | null
  pro_lower_price?: string | null
  pro_high_price?: string | null
  state: ListingImportItemState
  job_id?: string | null
  draft_id?: string | null
  message?: string | null
  finished_at?: string | null
}

export type ListingImportQueuePayload = {
  queue_token: string
  created_at: string
  updated_at: string
  created_by?: string | null
  run_status: ListingImportRunStatus
  pause_requested: boolean
  stop_requested: boolean
  current_item_id?: string | null
  worker_error?: string | null
  items: ListingImportQueueItem[]
}

export type ListingImportQueueCounts = {
  total: number
  done: number
  error: number
  pending: number
  running: number
}

export type ListingImportQueueStatus = {
  queue_token: string
  created_at?: string | null
  updated_at?: string | null
  run_status: string
  pause_requested: boolean
  stop_requested: boolean
  worker_alive: boolean
  worker_error?: string | null
  current_item_id?: string | null
  counts: ListingImportQueueCounts
  items: ListingImportQueueItem[]
  can_resume: boolean
  can_pause: boolean
  can_stop: boolean
}

export type ListingImportQueueRunSummary = {
  queue_token: string
  created_at?: string | null
  updated_at?: string | null
  run_status?: string
  pause_requested?: boolean
  stop_requested?: boolean
  worker_alive?: boolean
  counts: ListingImportQueueCounts
}

export type ListingImportDraft = {
  id: string
  job_id: string
  source: string
  source_url: string
  source_offer_id?: string | null
  status: string
  /** Alias 188 `phase` — NanoAI dùng `status` (queued/running/done/error/published). */
  phase?: string | null
  message?: string | null
  errors: string[]
  warnings: string[]
  raw_payload?: Record<string, unknown> | null
  product_data?: Record<string, unknown> | null
  published_product_id?: string | null
  published_inventory_id?: string | null
  created_at?: string
  updated_at?: string | null
  finished_at?: string | null
}

export type ListingImportEnqueueItem = {
  url: string
  source?: string | null
  label?: string | null
  chinese_name?: string | null
  shop_name_chinese?: string | null
  price?: number | null
  pro_lower_price?: string | null
  pro_high_price?: string | null
}

export function listingImportQueueTokenOk(token: string): boolean {
  return /^[a-f0-9]{32,64}$/.test((token || '').trim().toLowerCase())
}

export function countsFromListingItems(items: ListingImportQueueItem[]): ListingImportQueueCounts {
  const total = items.length
  const done = items.filter((it) => it.state === 'done').length
  const error = items.filter((it) => it.state === 'error').length
  const pending = items.filter((it) => it.state === 'pending').length
  const running = items.filter((it) => it.state === 'running').length
  return { total, done, error, pending, running }
}

export function newListingImportQueueSkeleton(createdBy?: string | null): ListingImportQueuePayload {
  const now = new Date().toISOString()
  const token = crypto.randomUUID().replace(/-/g, '')
  return {
    queue_token: token,
    created_at: now,
    updated_at: now,
    created_by: createdBy || null,
    run_status: 'idle',
    pause_requested: false,
    stop_requested: false,
    current_item_id: null,
    worker_error: null,
    items: [],
  }
}
