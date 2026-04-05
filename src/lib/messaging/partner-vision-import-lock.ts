/**
 * Khóa toàn cục assets:import Vision Warehouse — Google chỉ cho 1 op ImportAssets / corpus cùng lúc.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'

type Db = SupabaseClient<Database>

const DEFAULT_STALE_SECONDS = 45 * 60
const ACQUIRE_POLL_MS = 4000
const DEFAULT_MAX_WAIT_MS = 90_000

export async function acquireVisionWarehouseImportLock(
  db: Db,
  opts?: { staleSeconds?: number; maxWaitMs?: number }
): Promise<void> {
  const staleSeconds = opts?.staleSeconds ?? DEFAULT_STALE_SECONDS
  const maxWaitMs = opts?.maxWaitMs ?? DEFAULT_MAX_WAIT_MS
  const start = Date.now()
  while (Date.now() - start < maxWaitMs) {
    const { data, error } = await db.rpc('vision_warehouse_try_acquire_import_lock', {
      p_stale_seconds: staleSeconds,
    })
    if (error) throw new Error(`Vision import lock: ${error.message}`)
    if (data === true) return
    await new Promise((r) => setTimeout(r, ACQUIRE_POLL_MS))
  }
  throw new Error(
    'Vision Warehouse: corpus đang bị giữ bởi lượt import khác (hoặc khóa chưa hết hạn an toàn). Hãy thử lại sau vài phút; tránh chạy nhiều đồng bộ Vision cùng lúc (cron + tab, hoặc nhiều VPS).'
  )
}

export async function releaseVisionWarehouseImportLock(db: Db): Promise<void> {
  const { error } = await db.rpc('vision_warehouse_release_import_lock')
  if (error) console.error('[vision-import-lock] release', error.message)
}
