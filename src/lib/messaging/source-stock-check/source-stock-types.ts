export type SourceStockStatus =
  | 'unknown'
  | 'queued'
  | 'checking'
  | 'in_stock'
  | 'out_of_stock'
  | 'blocked'
  | 'error'
  | 'skipped'

export type SourceStockPlatform = 'cssbuy' | 'vipomall' | 'pandamall' | 'cssbuy+vipomall+pandamall'

export type SourceStockDomain = 'cssbuy' | 'vipomall'

export type SourceStockCheckResult = {
  status: string
  error: string | null
  checked_via: string | null
}

export type SourceStockPreviewBranch = {
  status: string
  error: string | null
  checked_via: string | null
}

export type SourceStockPreviewUrlResult = {
  ok: true
  canonical_input: string
  link_eligible: boolean
  coercion: {
    cssbuy_url: string
    cssbuy_coercion_error: string
    vipomall_url: string
    vipomall_coercion_error: string
    pandamall_url: string
    pandamall_coercion_error: string
  }
  cssbuy: SourceStockPreviewBranch
  vipomall: SourceStockPreviewBranch
  pandamall: SourceStockPreviewBranch
  merged: SourceStockPreviewBranch
}

export type SourceStockWorkerProgressRow = {
  product_db_id: string
  product_code: string | null
  name: string | null
  link_default: string | null
  source_stock_check_platform?: string | null
  source_stock_status?: string | null
  checking_started_at_utc_iso?: string | null
  finished_at_utc_iso?: string | null
  queue_hint?: string | null
  queue_hint_vi?: string | null
}

export type SourceStockWorkerState = {
  env_source_stock_check_enabled: boolean
  db_paused: boolean
  db_pause_updated_at_utc_iso: string | null
  daemon_thread_started_flag: boolean
  daemon_thread_alive: boolean
  process_in_memory_queue_depth: number
  check_interval_seconds: number
  effective_idle_reason: string | null
  effective_idle_hint_vi: string | null
  deployment_notes_vi: string
  checking: SourceStockWorkerProgressRow | null
  last_completed: SourceStockWorkerProgressRow | null
  next_upcoming_primary: SourceStockWorkerProgressRow | null
  upcoming_candidates: SourceStockWorkerProgressRow[]
  products_commit_audit: {
    ok: boolean | null
    at_utc_iso: string | null
    detail: string | null
    product_db_id: string | null
    consistency_hint_vi: string | null
  } | null
  progress_notes_vi: string
}

export type SourceStockQueueStats = {
  ok: boolean
  domain: string
  active_only: boolean
  admin_batch_scan_cooldown_days: number
  admin_batch_traffic_view_window_days: number
  admin_batch_traffic_check_gap_days: number
  cooldown_cutoff_utc_iso: string
  traffic_recent_check_cutoff_utc_iso: string
  traffic_view_since_utc_iso: string
  total_in_scope: number
  eligible_now: number
  eligible_never_scanned: number
  eligible_rescan_after_ttl: number
  eligible_with_recent_customer_view: number
  eligible_without_recent_customer_view: number
  in_cooldown: number
}

export type SourceStockActivityReportSampleRow = {
  id: string
  product_id: string
  name: string
  slug: string
  link_default: string
  link_convert_cssbuy?: string
  link_convert_cssbuy_err?: string
  link_convert_vipomall?: string
  link_convert_vipomall_err?: string
  source_stock_status: string | null
  source_stock_checked_at: string | null
  source_stock_check_platform?: string | null
  admin_source_batch_scanned_at: string | null
  available: number
}

export type SourceStockReportSamplePaginationSlice = {
  page: number
  total: number
  total_pages: number
}

export type SourceStockActivityReport = {
  ok: boolean
  domain: string
  active_only: boolean
  window_days: number
  window_since_utc_iso: string
  samples_pagination: {
    page_size: number
    oos: SourceStockReportSamplePaginationSlice
    in_stock: SourceStockReportSamplePaginationSlice
    batch_ttl_recent: SourceStockReportSamplePaginationSlice
  }
  queue: SourceStockQueueStats
  counts: {
    batch_ttl_stamped_in_window: number
    source_stock_checked_any_in_window: number
    source_stock_oos_signal_in_window: number
    source_stock_in_stock_signal_in_window: number
    checked_available_positive_in_window: number
    checked_available_zero_or_negative_in_window: number
  }
  checked_in_window_by_source_stock_status: Record<string, number>
  samples: {
    oos: SourceStockActivityReportSampleRow[]
    in_stock: SourceStockActivityReportSampleRow[]
    batch_ttl_recent: SourceStockActivityReportSampleRow[]
  }
}
