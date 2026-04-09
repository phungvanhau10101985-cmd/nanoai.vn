import { getPgPool, isPgConfigured } from '@/lib/db/pool'
import { pgQueryOne } from '@/lib/db/pg-query'

export type VisionWarehouseRunnerLockFields = {
  assets_import_busy: boolean
  assets_import_busy_at: string | null
  assets_import_owner: string | null
  assets_import_heartbeat_at: string | null
}

function tsIso(v: unknown): string | null {
  if (v == null || v === '') return null
  if (v instanceof Date) return v.toISOString()
  const s = String(v)
  return s || null
}

/**
 * Các cột khóa import Vision (bảng singleton). `null` = không pool / không có dòng / lỗi — caller xử lý khi không có PG.
 */
export async function fetchVisionWarehouseRunnerLockFieldsFromPg(
  id: number
): Promise<VisionWarehouseRunnerLockFields | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<{
      assets_import_busy: boolean | null
      assets_import_busy_at: unknown
      assets_import_owner: string | null
      assets_import_heartbeat_at: unknown
    }>(
      `select coalesce(assets_import_busy, false) as assets_import_busy,
              assets_import_busy_at,
              assets_import_owner,
              assets_import_heartbeat_at
       from public.vision_warehouse_runner
       where id = $1
       limit 1`,
      [id]
    )
    if (!row) return null
    return {
      assets_import_busy: row.assets_import_busy !== false,
      assets_import_busy_at: tsIso(row.assets_import_busy_at),
      assets_import_owner: row.assets_import_owner?.trim() || null,
      assets_import_heartbeat_at: tsIso(row.assets_import_heartbeat_at),
    }
  } catch (e) {
    console.warn('[fetchVisionWarehouseRunnerLockFieldsFromPg]', e)
    return null
  }
}

/** Mở khóa import Vision (singleton). `false` = lỗi / không pool. */
export async function unlockVisionWarehouseImportLockFromPg(id: number, updatedAt: string): Promise<boolean> {
  if (!isPgConfigured()) return false
  try {
    await getPgPool().query(
      `update public.vision_warehouse_runner set
        assets_import_busy = false,
        assets_import_busy_at = null,
        assets_import_owner = null,
        assets_import_heartbeat_at = null,
        assets_import_operation = '',
        assets_import_operation_started_at = null,
        updated_at = $2::timestamptz
       where id = $1`,
      [id, updatedAt]
    )
    return true
  } catch (e) {
    console.warn('[unlockVisionWarehouseImportLockFromPg]', e)
    return false
  }
}

/** Kill switch: xóa queue/lock runner. `false` = lỗi / không pool. */
export async function emergencyClearVisionWarehouseRunnerFromPg(id: number, updatedAt: string): Promise<boolean> {
  if (!isPgConfigured()) return false
  try {
    await getPgPool().query(
      `update public.vision_warehouse_runner set
        pending_work = false,
        analyze_operation = '',
        index_operation = '',
        assets_import_busy = false,
        assets_import_busy_at = null,
        assets_import_owner = null,
        assets_import_heartbeat_at = null,
        assets_import_operation = '',
        assets_import_operation_started_at = null,
        updated_at = $2::timestamptz
       where id = $1`,
      [id, updatedAt]
    )
    return true
  } catch (e) {
    console.warn('[emergencyClearVisionWarehouseRunnerFromPg]', e)
    return false
  }
}
