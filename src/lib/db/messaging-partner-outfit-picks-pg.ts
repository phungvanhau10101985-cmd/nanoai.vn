import { isPgConfigured } from '@/lib/db/pool'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'
import type { OutfitSlotId } from '@/lib/partner-website/shop/pdp-outfit-roles'

export const OUTFIT_PICKS_ALGO_VERSION = 'v8'
export const OUTFIT_PICKS_TTL_MS = 7 * 24 * 3600 * 1000
export const OUTFIT_STORED_LIMIT = 12

export type PartnerOutfitPickItem = {
  id: string
  matchScore: number
  reasons: string[]
}

export type PartnerOutfitPickSlot = {
  id: OutfitSlotId
  listingPath: string | null
  items: PartnerOutfitPickItem[]
}

export type PartnerOutfitPickPayload = {
  applicable: boolean
  reason: string | null
  /** True only after a compute whose queries succeeded. Missing on older rows. */
  computeOk?: boolean
  anchor: {
    id: string
    role: OutfitSlotId | null
    gender: 'male' | 'female' | 'unisex'
  } | null
  slots: PartnerOutfitPickSlot[]
}

function isMissingOutfitPicksTableError(e: unknown): boolean {
  if (!e || typeof e !== 'object') return false
  const err = e as { code?: string; message?: string }
  if (err.code !== '42P01') return false
  return /messaging_partner_outfit_picks/i.test(String(err.message ?? ''))
}

/** A saved row can be served. Query failures must not stick as `applicable: false`. */
export function storedOutfitPayloadIsServable(payload: PartnerOutfitPickPayload | null | undefined): boolean {
  if (!payload || typeof payload.applicable !== 'boolean') return false
  if (payload.computeOk === true) return true
  return (
    payload.applicable === true &&
    (payload.slots || []).some((slot) => (slot.items || []).length > 0)
  )
}

export function persistedOutfitIsFresh(algoVersion: string | null | undefined, computedAt: Date | string | null | undefined): boolean {
  if ((algoVersion || '') !== OUTFIT_PICKS_ALGO_VERSION || !computedAt) return false
  const at = computedAt instanceof Date ? computedAt : new Date(computedAt)
  if (!Number.isFinite(at.getTime())) return false
  const age = Date.now() - at.getTime()
  return age >= 0 && age < OUTFIT_PICKS_TTL_MS
}

export function filterStoredOutfitPayload(
  payload: PartnerOutfitPickPayload,
  opts?: { onlySlot?: OutfitSlotId | null; limit?: number }
): PartnerOutfitPickPayload {
  if (!payload.applicable) return payload
  const onlySlot = opts?.onlySlot ?? null
  const cap = Math.max(1, Math.floor(opts?.limit || OUTFIT_STORED_LIMIT))
  const slots = (payload.slots || [])
    .filter((slot) => (onlySlot ? slot.id === onlySlot : true))
    .map((slot) => ({ ...slot, items: (slot.items || []).slice(0, cap) }))
    .filter((slot) => slot.items.length > 0)
  if (!slots.length) {
    return { applicable: false, reason: payload.reason || 'no_slots', anchor: null, slots: [] }
  }
  return { ...payload, slots }
}

export async function loadPartnerOutfitPicksFromPg(
  partnerId: string,
  inventoryId: string
): Promise<PartnerOutfitPickPayload | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<{
      algo_version: string | null
      payload: unknown
      computed_at: unknown
    }>(
      `select algo_version, payload, computed_at
         from public.messaging_partner_outfit_picks
        where partner_id = $1::uuid and inventory_id = $2::uuid
        limit 1`,
      [partnerId, inventoryId]
    )
    if (!row || !persistedOutfitIsFresh(row.algo_version, row.computed_at as string)) return null
    const payload = row.payload && typeof row.payload === 'object' ? (row.payload as PartnerOutfitPickPayload) : null
    return payload && typeof payload.applicable === 'boolean' ? payload : null
  } catch (e) {
    if (isMissingOutfitPicksTableError(e)) return null
    console.warn('[loadPartnerOutfitPicksFromPg]', e)
    return null
  }
}

export async function savePartnerOutfitPicksFromPg(
  partnerId: string,
  inventoryId: string,
  payload: PartnerOutfitPickPayload
): Promise<void> {
  if (!isPgConfigured() || !payload) return
  try {
    await pgQuery(
      `insert into public.messaging_partner_outfit_picks
         (partner_id, inventory_id, algo_version, payload, computed_at)
       values ($1::uuid, $2::uuid, $3, $4::jsonb, now())
       on conflict (partner_id, inventory_id)
       do update set
         algo_version = excluded.algo_version,
         payload = excluded.payload,
         computed_at = excluded.computed_at`,
      [partnerId, inventoryId, OUTFIT_PICKS_ALGO_VERSION, JSON.stringify(payload)]
    )
  } catch (e) {
    if (isMissingOutfitPicksTableError(e)) return
    console.warn('[savePartnerOutfitPicksFromPg]', e)
  }
}

const OUTFIT_BACKFILL_SERVABLE_SQL = `(
  coalesce(p.payload->>'computeOk', '') = 'true'
  or (
    coalesce((p.payload->>'applicable')::boolean, false) = true
    and case
      when jsonb_typeof(p.payload->'slots') = 'array' then jsonb_array_length(p.payload->'slots')
      else 0
    end > 0
  )
)`

/** Published shops: products whose saved outfit is missing, stale, or not servable. */
export async function listPublishedOutfitPickBackfillFromPg(limit: number): Promise<
  Array<{ partnerId: string; inventoryId: string }>
> {
  if (!isPgConfigured()) return []
  const lim = Math.min(24, Math.max(1, Math.floor(limit) || 1))
  try {
    const rows = await pgQuery<{ partner_id: string; inventory_id: string }>(
      `select i.partner_id::text as partner_id, i.id::text as inventory_id
         from public.messaging_partner_inventory i
         inner join public.messaging_partner_websites w
           on w.partner_id = i.partner_id
          and w.is_published = true
         left join public.messaging_partner_outfit_picks p
           on p.partner_id = i.partner_id
          and p.inventory_id = i.id
        where coalesce(i.is_active, true) = true
          and (
            p.inventory_id is null
            or p.algo_version is distinct from $2
            or p.computed_at is null
            or p.computed_at < now() - interval '7 days'
            or not ${OUTFIT_BACKFILL_SERVABLE_SQL}
          )
        order by p.computed_at asc nulls first, i.updated_at desc nulls last
        limit $1`,
      [lim, OUTFIT_PICKS_ALGO_VERSION]
    )
    return rows.map((row) => ({ partnerId: row.partner_id, inventoryId: row.inventory_id }))
  } catch (e) {
    if (isMissingOutfitPicksTableError(e)) return []
    console.warn('[listPublishedOutfitPickBackfillFromPg]', e)
    return []
  }
}

export async function deletePartnerOutfitPicksFromPg(partnerId: string, inventoryIds: string[]): Promise<void> {
  if (!isPgConfigured() || !inventoryIds.length) return
  try {
    await pgQuery(
      `delete from public.messaging_partner_outfit_picks
        where partner_id = $1::uuid and inventory_id = any($2::uuid[])`,
      [partnerId, inventoryIds]
    )
  } catch (e) {
    if (isMissingOutfitPicksTableError(e)) return
    console.warn('[deletePartnerOutfitPicksFromPg]', e)
  }
}
