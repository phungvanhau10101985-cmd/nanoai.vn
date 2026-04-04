/**
 * Hàng đợi analyze + rebuild index Vision Warehouse (bảng vision_warehouse_runner, id=1).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'
import {
  analyzeVisionWarehouseCorpus,
  pollVisionAiOperation,
  readVisionWarehouseCorpusConfig,
  readVisionWarehouseIndexRebuildConfig,
  rebuildVisionWarehouseIndex,
  resolveVisionWarehouseProjectNumber,
  type VisionWarehouseLocation,
} from '@/lib/messaging/partner-vision-warehouse'

export type VisionWarehouseReindexKickResult = { step: string; detail?: string }

type Db = SupabaseClient<Database>

export async function markVisionWarehousePendingWork(
  db: Db,
  location: VisionWarehouseLocation
): Promise<void> {
  const now = new Date().toISOString()
  const { error } = await db
    .from('vision_warehouse_runner')
    .update({ pending_work: true, warehouse_location: location, updated_at: now })
    .eq('id', 1)
  if (error) console.error('[vision-warehouse-runner] mark pending', error.message)
}

/**
 * Gọi ngay sau khi đồng bộ catalog: bắt đầu analyze corpus nếu `pending_work` và không có op đang chạy.
 * Không poll (tránh treo request dashboard). Các bước poll + rebuild index vẫn do cron `/api/cron/vision-warehouse-reindex`.
 */
export async function kickVisionWarehouseReindexIfPending(
  db: Db,
  opts?: { errorScopePartnerId?: string }
): Promise<VisionWarehouseReindexKickResult> {
  const corpusCfg = readVisionWarehouseCorpusConfig()
  if (!corpusCfg.ok) return { step: 'skip_no_env', detail: corpusCfg.error }

  let projectNumber: string
  try {
    projectNumber = await resolveVisionWarehouseProjectNumber()
  } catch (e) {
    return { step: 'error', detail: e instanceof Error ? e.message : String(e) }
  }

  const { corpusId } = corpusCfg
  const { data: row, error: rErr } = await db.from('vision_warehouse_runner').select('*').eq('id', 1).maybeSingle()
  if (rErr) return { step: 'db_error', detail: rErr.message }
  if (!row) return { step: 'no_runner_row' }

  const location = warehouseLocationFromRunnerRow(row)
  const now = () => new Date().toISOString()

  if (row.index_operation || row.analyze_operation) {
    return { step: 'skip_ops_in_flight' }
  }
  if (!row.pending_work) {
    return { step: 'idle_no_pending' }
  }

  try {
    const anOp = await analyzeVisionWarehouseCorpus(projectNumber, location, corpusId)
    await db
      .from('vision_warehouse_runner')
      .update({ analyze_operation: anOp, updated_at: now() })
      .eq('id', 1)
    return { step: 'analyze_started' }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    await db
      .from('vision_warehouse_runner')
      .update({
        pending_work: false,
        analyze_operation: '',
        index_operation: '',
        updated_at: now(),
      })
      .eq('id', 1)

    const errPatch = {
      vision_index_error: `Vision Warehouse: ${msg.slice(0, 1800)}`,
      updated_at: now(),
    }
    const scopeId = opts?.errorScopePartnerId?.trim()
    if (scopeId) {
      await db.from('messaging_partner_ai_settings').update(errPatch).eq('partner_id', scopeId)
    } else {
      await db.from('messaging_partner_ai_settings').update(errPatch).eq('vision_product_search_enabled', true)
    }
    return { step: 'error', detail: msg }
  }
}

function warehouseLocationFromRunnerRow(row: { warehouse_location?: string | null }): VisionWarehouseLocation {
  const r = (row.warehouse_location ?? '').trim()
  if (r === 'europe-west4') return 'europe-west4'
  return 'us-central1'
}

/**
 * Một lần chạy cron: poll op đang có hoặc bắt đầu analyze / PATCH index.
 */
export async function processVisionWarehouseReindexCron(db: Db): Promise<{
  step: string
  detail?: string
}> {
  const corpusCfg = readVisionWarehouseCorpusConfig()
  if (!corpusCfg.ok) return { step: 'skip_no_env', detail: corpusCfg.error }

  let projectNumber: string
  try {
    projectNumber = await resolveVisionWarehouseProjectNumber()
  } catch (e) {
    return { step: 'error', detail: e instanceof Error ? e.message : String(e) }
  }

  const { corpusId } = corpusCfg

  const { data: row, error: rErr } = await db.from('vision_warehouse_runner').select('*').eq('id', 1).maybeSingle()
  if (rErr) return { step: 'db_error', detail: rErr.message }
  if (!row) return { step: 'no_runner_row' }

  const location = warehouseLocationFromRunnerRow(row)
  const now = () => new Date().toISOString()

  try {
    if (row.index_operation) {
      await pollVisionAiOperation(row.index_operation, { maxMs: 270_000, warehouseLocation: location })
      await db
        .from('vision_warehouse_runner')
        .update({
          index_operation: '',
          analyze_operation: '',
          pending_work: false,
          updated_at: now(),
        })
        .eq('id', 1)
      await db
        .from('messaging_partner_ai_settings')
        .update({
          vision_index_ready: true,
          vision_index_error: '',
          updated_at: now(),
        })
        .eq('vision_product_search_enabled', true)
      return { step: 'index_rebuild_done' }
    }

    if (row.analyze_operation) {
      await pollVisionAiOperation(row.analyze_operation, { maxMs: 270_000, warehouseLocation: location })
      const idxCfg = readVisionWarehouseIndexRebuildConfig()
      if (!idxCfg.ok) {
        const err = idxCfg.error
        await db
          .from('vision_warehouse_runner')
          .update({
            pending_work: false,
            analyze_operation: '',
            index_operation: '',
            updated_at: now(),
          })
          .eq('id', 1)
        await db
          .from('messaging_partner_ai_settings')
          .update({
            vision_index_error: err.slice(0, 2000),
            updated_at: now(),
          })
          .eq('vision_product_search_enabled', true)
        return { step: 'error', detail: err }
      }
      const idxOp = await rebuildVisionWarehouseIndex(
        projectNumber,
        location,
        idxCfg.corpusId,
        idxCfg.indexId
      )
      await db
        .from('vision_warehouse_runner')
        .update({ analyze_operation: '', index_operation: idxOp, updated_at: now() })
        .eq('id', 1)
      return { step: 'analyze_done_index_started' }
    }

    if (row.pending_work) {
      const anOp = await analyzeVisionWarehouseCorpus(projectNumber, location, corpusId)
      await db
        .from('vision_warehouse_runner')
        .update({ analyze_operation: anOp, updated_at: now() })
        .eq('id', 1)
      return { step: 'analyze_started' }
    }

    return { step: 'idle' }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    await db
      .from('vision_warehouse_runner')
      .update({
        pending_work: false,
        analyze_operation: '',
        index_operation: '',
        updated_at: now(),
      })
      .eq('id', 1)
    await db
      .from('messaging_partner_ai_settings')
      .update({
        vision_index_error: `Vision Warehouse cron: ${msg.slice(0, 1800)}`,
        updated_at: now(),
      })
      .eq('vision_product_search_enabled', true)
    return { step: 'error', detail: msg }
  }
}
