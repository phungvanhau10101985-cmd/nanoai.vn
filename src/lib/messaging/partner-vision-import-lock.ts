/**
 * Khóa toàn cục assets:import Vision Warehouse — Google chỉ cho 1 op ImportAssets / corpus cùng lúc.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'

type Db = SupabaseClient<Database>
export type VisionWarehouseImportLock = { ownerId: string }

const DEFAULT_STALE_SECONDS = 10 * 60
const ACQUIRE_POLL_MS = 4000
const DEFAULT_MAX_WAIT_MS = 90_000
const LOCK_OWNER_PREFIX = 'vision-sync'

function makeImportLockOwnerId(): string {
  const pid = typeof process !== 'undefined' && typeof process.pid === 'number' ? String(process.pid) : 'na'
  return `${LOCK_OWNER_PREFIX}-${pid}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export async function acquireVisionWarehouseImportLock(
  db: Db,
  opts?: { staleSeconds?: number; maxWaitMs?: number; ownerId?: string }
): Promise<VisionWarehouseImportLock> {
  const staleSeconds = opts?.staleSeconds ?? DEFAULT_STALE_SECONDS
  const maxWaitMs = opts?.maxWaitMs ?? DEFAULT_MAX_WAIT_MS
  const ownerId = opts?.ownerId?.trim() || makeImportLockOwnerId()
  const start = Date.now()
  while (Date.now() - start < maxWaitMs) {
    const { data, error } = await db.rpc('vision_warehouse_try_acquire_import_lock', {
      p_stale_seconds: staleSeconds,
      p_owner: ownerId,
    })
    if (error) throw new Error(`Vision import lock: ${error.message}`)
    if (data === true) return { ownerId }
    await new Promise((r) => setTimeout(r, ACQUIRE_POLL_MS))
  }
  throw new Error(
    'Vision Warehouse: corpus đang bị giữ bởi lượt import khác (hoặc khóa chưa hết hạn an toàn). Hãy thử lại sau vài phút; tránh chạy nhiều đồng bộ Vision cùng lúc (cron + tab, hoặc nhiều VPS).'
  )
}

export async function heartbeatVisionWarehouseImportLock(
  db: Db,
  lock: VisionWarehouseImportLock
): Promise<boolean> {
  const owner = lock.ownerId.trim()
  if (!owner) return false
  const { data, error } = await db.rpc('vision_warehouse_heartbeat_import_lock', { p_owner: owner })
  if (error) {
    console.error('[vision-import-lock] heartbeat', error.message)
    return false
  }
  return data === true
}

export async function releaseVisionWarehouseImportLock(
  db: Db,
  lock?: VisionWarehouseImportLock | null
): Promise<void> {
  const owner = lock?.ownerId?.trim() || ''
  if (!owner) return
  const { error } = await db.rpc('vision_warehouse_release_import_lock', { p_owner: owner })
  if (error) console.error('[vision-import-lock] release', error.message)
}
