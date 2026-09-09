function envBool(name: string, fallback: boolean): boolean {
  const raw = process.env[name]
  if (raw == null || !String(raw).trim()) return fallback
  return !['0', 'false', 'no', 'off'].includes(String(raw).trim().toLowerCase())
}

function envInt(name: string, fallback: number, min: number): number {
  const n = Number(process.env[name] || fallback)
  if (!Number.isFinite(n)) return fallback
  return Math.max(min, Math.trunc(n))
}

export function sourceStockCheckEnabled(): boolean {
  return envBool('SOURCE_STOCK_CHECK_ENABLED', true)
}

export function sourceStockCheckIntervalSeconds(): number {
  return envInt('SOURCE_STOCK_CHECK_INTERVAL_SECONDS', 60, 5)
}

export function sourceStockCheckStaleMinutes(): number {
  return envInt('SOURCE_STOCK_CHECK_STALE_MINUTES', 360, 5)
}

export function sourceStockCheckErrorRetryMinutes(): number {
  return envInt('SOURCE_STOCK_CHECK_ERROR_RETRY_MINUTES', 30, 5)
}

export function sourceStockCheckPageviewMinIntervalSeconds(): number {
  return envInt('SOURCE_STOCK_CHECK_PAGEVIEW_MIN_INTERVAL_SECONDS', 300, 30)
}

export function sourceStockCheckPlaywrightTimeoutMs(): number {
  return envInt('SOURCE_STOCK_CHECK_PLAYWRIGHT_TIMEOUT_MS', 90_000, 8_000)
}

export function sourceStockCheckHeadless(): boolean {
  return envBool('SOURCE_STOCK_CHECK_HEADLESS', true)
}

export function adminSourceBatchScanCooldownDays(): number {
  return envInt('ADMIN_SOURCE_BATCH_SCAN_COOLDOWN_DAYS', 30, 1)
}

export function adminSourceBatchTrafficViewWindowDays(): number {
  return envInt('ADMIN_SOURCE_BATCH_TRAFFIC_VIEW_WINDOW_DAYS', 30, 1)
}

export function adminSourceBatchTrafficCheckGapDays(): number {
  return envInt('ADMIN_SOURCE_BATCH_TRAFFIC_CHECK_GAP_DAYS', 30, 1)
}

export const SOURCE_STOCK_OOS_RESTORE_QTY = 500

/** Khoảng khóa hàng in-flight (queued/checking) để process khác không scrape trùng. */
export function sourceStockCheckClaimLeaseMinutes(): number {
  return envInt('SOURCE_STOCK_CHECK_CLAIM_LEASE_MINUTES', 15, 5)
}

/** Hết hàng nguồn → 0. Về hàng khi tồn đang ≤ 0 → 500 (không tin previous_status sau queued/checking). */
export function nextStockQtyAfterSourceCheck(opts: {
  status: string
  stockQty: number
}): number {
  const st = (opts.status || '').trim().toLowerCase()
  if (st === 'out_of_stock') return 0
  if (st === 'in_stock' && opts.stockQty <= 0) return SOURCE_STOCK_OOS_RESTORE_QTY
  return opts.stockQty
}
