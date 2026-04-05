/**
 * Cấu hình Vision sync chỉ dùng phía server (đọc env). Không import từ Client Components.
 */
import {
  VISION_INCREMENTAL_BATCH_SIZE,
  VISION_INCREMENTAL_MAX_IMPORTS_PER_REQUEST,
  VISION_WAREHOUSE_ASSETS_IMPORT_POLL_MAX_MS,
  VISION_WAREHOUSE_POST_IMPORT_COOLDOWN_MS,
} from '@/lib/messaging/partner-vision-constants'

export function resolveVisionWarehouseAssetsImportPollMaxMs(): number {
  const raw = process.env.VISION_WAREHOUSE_ASSETS_IMPORT_POLL_MAX_MS?.trim()
  if (!raw) return VISION_WAREHOUSE_ASSETS_IMPORT_POLL_MAX_MS
  const n = Number.parseInt(raw, 10)
  if (!Number.isFinite(n)) return VISION_WAREHOUSE_ASSETS_IMPORT_POLL_MAX_MS
  /** Self-hosted có thể tăng (catalog lớn / Google chậm); Vercel cần maxDuration route đủ lớn. */
  return Math.min(2_400_000, Math.max(60_000, n))
}

export function resolveVisionIncrementalBatchSize(): number {
  const raw = process.env.VISION_INCREMENTAL_BATCH_SIZE?.trim()
  if (!raw) return VISION_INCREMENTAL_BATCH_SIZE
  const n = Number.parseInt(raw, 10)
  if (!Number.isFinite(n)) return VISION_INCREMENTAL_BATCH_SIZE
  return Math.min(200, Math.max(5, n))
}

export function resolveVisionIncrementalMaxImportsPerRequest(): number {
  const raw = process.env.VISION_INCREMENTAL_MAX_IMPORTS_PER_REQUEST?.trim()
  if (!raw) return VISION_INCREMENTAL_MAX_IMPORTS_PER_REQUEST
  const n = Number.parseInt(raw, 10)
  if (!Number.isFinite(n)) return VISION_INCREMENTAL_MAX_IMPORTS_PER_REQUEST
  /** Trần 12 để tránh 429 hàng loạt; Google khuyến nghị 1 op / corpus. */
  return Math.min(12, Math.max(1, n))
}

export function resolveVisionIncrementalMaxDirtyPerRequest(): number {
  return resolveVisionIncrementalBatchSize() * resolveVisionIncrementalMaxImportsPerRequest()
}

export function resolveVisionWarehousePostImportCooldownMs(): number {
  const raw = process.env.VISION_WAREHOUSE_POST_IMPORT_COOLDOWN_MS?.trim()
  if (!raw) return VISION_WAREHOUSE_POST_IMPORT_COOLDOWN_MS
  const n = Number.parseInt(raw, 10)
  if (!Number.isFinite(n)) return VISION_WAREHOUSE_POST_IMPORT_COOLDOWN_MS
  return Math.min(120_000, Math.max(0, n))
}

/**
 * Thời gian tối đa một lần gọi cron / run-once: phải ≥ poll một op `assets:import` + đệm I/O.
 */
export function defaultVisionCatalogBgSyncMaxWallMs(): number {
  const poll = resolveVisionWarehouseAssetsImportPollMaxMs()
  return Math.max(720_000, poll + 180_000)
}
