import { isPgConfigured } from '@/lib/db/pool'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'

const UUID_SQL = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function safeUuid(v: unknown): string | null {
  const s = typeof v === 'string' ? v.trim() : String(v ?? '').trim()
  if (!s || !UUID_SQL.test(s)) return null
  return s
}

function asIso(v: unknown): string {
  if (v instanceof Date) return v.toISOString()
  return String(v ?? '')
}

export type HospitalityRoomTypeRow = {
  id: string
  partner_id: string
  code: string
  name: string
  description: string | null
  max_guests: number
  base_hourly_rate: number | null
  base_daily_rate: number | null
  currency: string
  amenities: unknown[]
  is_active: boolean
}

export async function fetchHospitalityRoomTypesPg(partnerId: string): Promise<HospitalityRoomTypeRow[]> {
  if (!isPgConfigured()) return []
  const pid = safeUuid(partnerId)
  if (!pid) return []
  try {
    const rows = await pgQuery<{
      id: string
      partner_id: string
      code: string
      name: string
      description: string | null
      max_guests: number
      base_hourly_rate: string | number | null
      base_daily_rate: string | number | null
      currency: string
      amenities: unknown[] | null
      is_active: boolean | null
    }>(
      `select id::text, partner_id::text, code, name, description, max_guests,
              base_hourly_rate, base_daily_rate, currency, amenities, is_active
       from public.hospitality_room_types
       where partner_id = $1::uuid
       order by created_at desc`,
      [pid]
    )
    return rows.map((r) => ({
      id: r.id,
      partner_id: r.partner_id,
      code: String(r.code ?? ''),
      name: String(r.name ?? ''),
      description: r.description ? String(r.description) : null,
      max_guests: Number(r.max_guests ?? 1),
      base_hourly_rate: r.base_hourly_rate == null ? null : Number(r.base_hourly_rate),
      base_daily_rate: r.base_daily_rate == null ? null : Number(r.base_daily_rate),
      currency: String(r.currency ?? 'VND'),
      amenities: Array.isArray(r.amenities) ? r.amenities : [],
      is_active: r.is_active !== false,
    }))
  } catch (e) {
    console.warn('[fetchHospitalityRoomTypesPg]', e)
    return []
  }
}

export async function createHospitalityRoomTypePg(params: {
  partner_id: string
  code: string
  name: string
  description?: string | null
  max_guests?: number
  base_hourly_rate?: number | null
  base_daily_rate?: number | null
  currency?: string
  amenities?: unknown[]
}): Promise<HospitalityRoomTypeRow | null> {
  if (!isPgConfigured()) return null
  const pid = safeUuid(params.partner_id)
  if (!pid) return null
  const code = String(params.code ?? '').trim()
  const name = String(params.name ?? '').trim()
  if (!code || !name) return null
  try {
    const row = await pgQueryOne<{
      id: string
      partner_id: string
      code: string
      name: string
      description: string | null
      max_guests: number
      base_hourly_rate: string | number | null
      base_daily_rate: string | number | null
      currency: string
      amenities: unknown[] | null
      is_active: boolean | null
    }>(
      `insert into public.hospitality_room_types
         (partner_id, code, name, description, max_guests, base_hourly_rate, base_daily_rate, currency, amenities, updated_at)
       values
         ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, now())
       returning id::text, partner_id::text, code, name, description, max_guests,
                 base_hourly_rate, base_daily_rate, currency, amenities, is_active`,
      [
        pid,
        code,
        name,
        params.description ? String(params.description).trim() : null,
        Math.max(1, Number(params.max_guests ?? 2)),
        params.base_hourly_rate == null ? null : Number(params.base_hourly_rate),
        params.base_daily_rate == null ? null : Number(params.base_daily_rate),
        String(params.currency ?? 'VND').trim().toUpperCase() || 'VND',
        JSON.stringify(Array.isArray(params.amenities) ? params.amenities : []),
      ]
    )
    if (!row) return null
    return {
      id: row.id,
      partner_id: row.partner_id,
      code: String(row.code ?? ''),
      name: String(row.name ?? ''),
      description: row.description ? String(row.description) : null,
      max_guests: Number(row.max_guests ?? 1),
      base_hourly_rate: row.base_hourly_rate == null ? null : Number(row.base_hourly_rate),
      base_daily_rate: row.base_daily_rate == null ? null : Number(row.base_daily_rate),
      currency: String(row.currency ?? 'VND'),
      amenities: Array.isArray(row.amenities) ? row.amenities : [],
      is_active: row.is_active !== false,
    }
  } catch (e) {
    console.warn('[createHospitalityRoomTypePg]', e)
    return null
  }
}

export async function updateHospitalityRoomTypePg(params: {
  partner_id: string
  room_type_id: string
  code?: string
  name?: string
  description?: string | null
  max_guests?: number
  base_hourly_rate?: number | null
  base_daily_rate?: number | null
  currency?: string
  amenities?: unknown[]
  is_active?: boolean
}): Promise<HospitalityRoomTypeRow | null> {
  if (!isPgConfigured()) return null
  const pid = safeUuid(params.partner_id)
  const rtid = safeUuid(params.room_type_id)
  if (!pid || !rtid) return null
  try {
    const row = await pgQueryOne<{
      id: string
      partner_id: string
      code: string
      name: string
      description: string | null
      max_guests: number
      base_hourly_rate: string | number | null
      base_daily_rate: string | number | null
      currency: string
      amenities: unknown[] | null
      is_active: boolean | null
    }>(
      `update public.hospitality_room_types set
         code             = coalesce($3, code),
         name             = coalesce($4, name),
         description      = case when $5::text is not null then $5 else description end,
         max_guests       = coalesce($6, max_guests),
         base_hourly_rate = case when $7::text = '__keep__' then base_hourly_rate
                                 when $7::text = '__null__' then null
                                 else $7::numeric end,
         base_daily_rate  = case when $8::text = '__keep__' then base_daily_rate
                                 when $8::text = '__null__' then null
                                 else $8::numeric end,
         currency         = coalesce($9, currency),
         amenities        = case when $10::text is not null then $10::jsonb else amenities end,
         is_active        = coalesce($11, is_active),
         updated_at       = now()
       where id = $2::uuid and partner_id = $1::uuid
       returning id::text, partner_id::text, code, name, description, max_guests,
                 base_hourly_rate, base_daily_rate, currency, amenities, is_active`,
      [
        pid,
        rtid,
        params.code != null && String(params.code).trim() ? String(params.code).trim() : null,
        params.name != null && String(params.name).trim() ? String(params.name).trim() : null,
        params.description === undefined ? null : (params.description == null ? '' : String(params.description)),
        params.max_guests != null ? Math.max(1, Number(params.max_guests)) : null,
        params.base_hourly_rate === undefined
          ? '__keep__'
          : params.base_hourly_rate == null
            ? '__null__'
            : String(Number(params.base_hourly_rate)),
        params.base_daily_rate === undefined
          ? '__keep__'
          : params.base_daily_rate == null
            ? '__null__'
            : String(Number(params.base_daily_rate)),
        params.currency != null && String(params.currency).trim() ? String(params.currency).trim().toUpperCase() : null,
        params.amenities === undefined ? null : JSON.stringify(Array.isArray(params.amenities) ? params.amenities : []),
        params.is_active === undefined ? null : Boolean(params.is_active),
      ]
    )
    if (!row) return null
    return {
      id: row.id,
      partner_id: row.partner_id,
      code: String(row.code ?? ''),
      name: String(row.name ?? ''),
      description: row.description ? String(row.description) : null,
      max_guests: Number(row.max_guests ?? 1),
      base_hourly_rate: row.base_hourly_rate == null ? null : Number(row.base_hourly_rate),
      base_daily_rate: row.base_daily_rate == null ? null : Number(row.base_daily_rate),
      currency: String(row.currency ?? 'VND'),
      amenities: Array.isArray(row.amenities) ? row.amenities : [],
      is_active: row.is_active !== false,
    }
  } catch (e) {
    console.warn('[updateHospitalityRoomTypePg]', e)
    return null
  }
}

export async function deleteHospitalityRoomTypePg(partnerId: string, roomTypeId: string): Promise<boolean> {
  if (!isPgConfigured()) return false
  const pid = safeUuid(partnerId)
  const rtid = safeUuid(roomTypeId)
  if (!pid || !rtid) return false
  try {
    const row = await pgQueryOne<{ id: string }>(
      `delete from public.hospitality_room_types
       where id = $2::uuid and partner_id = $1::uuid
       returning id::text`,
      [pid, rtid]
    )
    return Boolean(row)
  } catch (e) {
    console.warn('[deleteHospitalityRoomTypePg]', e)
    return false
  }
}

export type HospitalityRoomImageRow = {
  id: string
  room_id: string
  image_url: string
  sort_order: number
  created_at: string
}

export async function fetchHospitalityRoomImagesPg(partnerId: string): Promise<HospitalityRoomImageRow[]> {
  if (!isPgConfigured()) return []
  const pid = safeUuid(partnerId)
  if (!pid) return []
  try {
    const rows = await pgQuery<{
      id: string
      room_id: string
      image_url: string
      sort_order: number | null
      created_at: string | Date
    }>(
      `select img.id::text, img.room_id::text, img.image_url, img.sort_order, img.created_at
       from public.hospitality_room_images img
       join public.hospitality_rooms r on r.id = img.room_id
       where r.partner_id = $1::uuid
       order by img.sort_order asc, img.created_at asc`,
      [pid]
    )
    return rows.map((r) => ({
      id: r.id,
      room_id: r.room_id,
      image_url: String(r.image_url ?? ''),
      sort_order: Number(r.sort_order ?? 0),
      created_at: asIso(r.created_at),
    }))
  } catch (e) {
    console.warn('[fetchHospitalityRoomImagesPg]', e)
    return []
  }
}

export async function fetchHospitalityRoomImagesByRoomPg(
  partnerId: string,
  roomId: string
): Promise<HospitalityRoomImageRow[]> {
  if (!isPgConfigured()) return []
  const pid = safeUuid(partnerId)
  const rid = safeUuid(roomId)
  if (!pid || !rid) return []
  try {
    const rows = await pgQuery<{
      id: string
      room_id: string
      image_url: string
      sort_order: number | null
      created_at: string | Date
    }>(
      `select img.id::text, img.room_id::text, img.image_url, img.sort_order, img.created_at
       from public.hospitality_room_images img
       join public.hospitality_rooms r on r.id = img.room_id
       where r.partner_id = $1::uuid and img.room_id = $2::uuid
       order by img.sort_order asc, img.created_at asc`,
      [pid, rid]
    )
    return rows.map((r) => ({
      id: r.id,
      room_id: r.room_id,
      image_url: String(r.image_url ?? ''),
      sort_order: Number(r.sort_order ?? 0),
      created_at: asIso(r.created_at),
    }))
  } catch (e) {
    console.warn('[fetchHospitalityRoomImagesByRoomPg]', e)
    return []
  }
}

export async function insertHospitalityRoomImagePg(params: {
  partner_id: string
  room_id: string
  image_url: string
  sort_order?: number
}): Promise<HospitalityRoomImageRow | null> {
  if (!isPgConfigured()) return null
  const pid = safeUuid(params.partner_id)
  const rid = safeUuid(params.room_id)
  const url = String(params.image_url ?? '').trim()
  if (!pid || !rid || !url) return null
  try {
    const row = await pgQueryOne<{
      id: string
      room_id: string
      image_url: string
      sort_order: number | null
      created_at: string | Date
    }>(
      `insert into public.hospitality_room_images (room_id, image_url, sort_order)
       select $2::uuid, $3, $4
       where exists (
         select 1 from public.hospitality_rooms
         where id = $2::uuid and partner_id = $1::uuid
       )
       returning id::text, room_id::text, image_url, sort_order, created_at`,
      [pid, rid, url, Number(params.sort_order ?? 0)]
    )
    if (!row) return null
    return {
      id: row.id,
      room_id: row.room_id,
      image_url: String(row.image_url ?? ''),
      sort_order: Number(row.sort_order ?? 0),
      created_at: asIso(row.created_at),
    }
  } catch (e) {
    console.warn('[insertHospitalityRoomImagePg]', e)
    return null
  }
}

export async function deleteHospitalityRoomImagePg(partnerId: string, imageId: string): Promise<boolean> {
  if (!isPgConfigured()) return false
  const pid = safeUuid(partnerId)
  const iid = safeUuid(imageId)
  if (!pid || !iid) return false
  try {
    const row = await pgQueryOne<{ id: string }>(
      `delete from public.hospitality_room_images img
       using public.hospitality_rooms r
       where img.id = $2::uuid and img.room_id = r.id and r.partner_id = $1::uuid
       returning img.id::text`,
      [pid, iid]
    )
    return Boolean(row)
  } catch (e) {
    console.warn('[deleteHospitalityRoomImagePg]', e)
    return false
  }
}

export type HospitalityRoomRow = {
  id: string
  partner_id: string
  room_type_id: string
  room_code: string
  floor_label: string | null
  status: string
}

export async function fetchHospitalityRoomsPg(partnerId: string): Promise<HospitalityRoomRow[]> {
  if (!isPgConfigured()) return []
  const pid = safeUuid(partnerId)
  if (!pid) return []
  try {
    const rows = await pgQuery<{
      id: string
      partner_id: string
      room_type_id: string
      room_code: string
      floor_label: string | null
      status: string
    }>(
      `select id::text, partner_id::text, room_type_id::text, room_code, floor_label, status
       from public.hospitality_rooms
       where partner_id = $1::uuid
       order by room_code asc`,
      [pid]
    )
    return rows.map((r) => ({
      id: r.id,
      partner_id: r.partner_id,
      room_type_id: r.room_type_id,
      room_code: String(r.room_code ?? ''),
      floor_label: r.floor_label ? String(r.floor_label) : null,
      status: String(r.status ?? 'active'),
    }))
  } catch (e) {
    console.warn('[fetchHospitalityRoomsPg]', e)
    return []
  }
}

export async function createHospitalityRoomPg(params: {
  partner_id: string
  room_type_id: string
  room_code: string
  floor_label?: string | null
}): Promise<HospitalityRoomRow | null> {
  if (!isPgConfigured()) return null
  const pid = safeUuid(params.partner_id)
  const roomTypeId = safeUuid(params.room_type_id)
  if (!pid || !roomTypeId) return null
  const roomCode = String(params.room_code ?? '').trim()
  if (!roomCode) return null
  try {
    const row = await pgQueryOne<{
      id: string
      partner_id: string
      room_type_id: string
      room_code: string
      floor_label: string | null
      status: string
    }>(
      `insert into public.hospitality_rooms
         (partner_id, room_type_id, room_code, floor_label, updated_at)
       values
         ($1::uuid, $2::uuid, $3, $4, now())
       returning id::text, partner_id::text, room_type_id::text, room_code, floor_label, status`,
      [pid, roomTypeId, roomCode, params.floor_label ? String(params.floor_label).trim() : null]
    )
    if (!row) return null
    return {
      id: row.id,
      partner_id: row.partner_id,
      room_type_id: row.room_type_id,
      room_code: row.room_code,
      floor_label: row.floor_label ? String(row.floor_label) : null,
      status: String(row.status ?? 'active'),
    }
  } catch (e) {
    console.warn('[createHospitalityRoomPg]', e)
    return null
  }
}

export async function updateHospitalityRoomPg(params: {
  partner_id: string
  room_id: string
  room_code?: string
  floor_label?: string | null
  status?: 'active' | 'maintenance' | 'inactive'
}): Promise<HospitalityRoomRow | null> {
  if (!isPgConfigured()) return null
  const pid = safeUuid(params.partner_id)
  const rid = safeUuid(params.room_id)
  if (!pid || !rid) return null
  try {
    const row = await pgQueryOne<{
      id: string
      partner_id: string
      room_type_id: string
      room_code: string
      floor_label: string | null
      status: string
    }>(
      `update public.hospitality_rooms set
         room_code   = coalesce($3, room_code),
         floor_label = case when $4::text = '__keep__' then floor_label
                            when $4::text = '__null__' then null
                            else $4 end,
         status      = coalesce($5, status),
         updated_at  = now()
       where id = $2::uuid and partner_id = $1::uuid
       returning id::text, partner_id::text, room_type_id::text, room_code, floor_label, status`,
      [
        pid,
        rid,
        params.room_code != null && String(params.room_code).trim() ? String(params.room_code).trim() : null,
        params.floor_label === undefined
          ? '__keep__'
          : params.floor_label == null || !String(params.floor_label).trim()
            ? '__null__'
            : String(params.floor_label).trim(),
        params.status ?? null,
      ]
    )
    if (!row) return null
    return {
      id: row.id,
      partner_id: row.partner_id,
      room_type_id: row.room_type_id,
      room_code: String(row.room_code ?? ''),
      floor_label: row.floor_label ? String(row.floor_label) : null,
      status: String(row.status ?? 'active'),
    }
  } catch (e) {
    console.warn('[updateHospitalityRoomPg]', e)
    return null
  }
}

export async function deleteHospitalityRoomPg(partnerId: string, roomId: string): Promise<boolean> {
  if (!isPgConfigured()) return false
  const pid = safeUuid(partnerId)
  const rid = safeUuid(roomId)
  if (!pid || !rid) return false
  try {
    const row = await pgQueryOne<{ id: string }>(
      `delete from public.hospitality_rooms
       where id = $2::uuid and partner_id = $1::uuid
       returning id::text`,
      [pid, rid]
    )
    return Boolean(row)
  } catch (e) {
    console.warn('[deleteHospitalityRoomPg]', e)
    return false
  }
}

export type HospitalityAvailabilityItem = {
  room_type_id: string
  room_type_name: string
  available_rooms: number
  base_hourly_rate: number | null
  base_daily_rate: number | null
  currency: string
}

export type HospitalityRoomScheduleSlot = {
  start_at: string
  end_at: string
  status: string
  source: string
}

export async function fetchHospitalityRoomScheduleSlotsPg(params: {
  partner_id: string
  room_id: string
  from_at: string
  to_at: string
}): Promise<HospitalityRoomScheduleSlot[]> {
  if (!isPgConfigured()) return []
  const pid = safeUuid(params.partner_id)
  const rid = safeUuid(params.room_id)
  if (!pid || !rid) return []
  const fromIso = new Date(params.from_at).toISOString()
  const toIso = new Date(params.to_at).toISOString()
  if (!fromIso || !toIso || new Date(toIso).getTime() <= new Date(fromIso).getTime()) return []
  try {
    const rows = await pgQuery<{
      start_at: unknown
      end_at: unknown
      status: string
      source: string
    }>(
      `with slot_rows as (
         select a.start_at, a.end_at, a.status, coalesce(a.source, 'slot') as source
         from public.hospitality_availability_slots a
         where a.partner_id = $1::uuid
           and a.room_id = $2::uuid
           and tstzrange(a.start_at, a.end_at, '[)') && tstzrange($3::timestamptz, $4::timestamptz, '[)')
       ),
       booking_rows as (
         select b.checkin_at as start_at,
                b.checkout_at as end_at,
                'booked'::text as status,
                'booking'::text as source
         from public.hospitality_bookings b
         where b.partner_id = $1::uuid
           and b.room_id = $2::uuid
           and b.status in ('pending', 'confirmed', 'checked_in', 'checked_out')
           and tstzrange(b.checkin_at, b.checkout_at, '[)') && tstzrange($3::timestamptz, $4::timestamptz, '[)')
       )
       select s.start_at, s.end_at, s.status, s.source
       from slot_rows s
       union all
       select b.start_at, b.end_at, b.status, b.source
       from booking_rows b
       where not exists (
         select 1
         from slot_rows s
         where tstzrange(s.start_at, s.end_at, '[)') && tstzrange(b.start_at, b.end_at, '[)')
       )
       order by start_at asc`,
      [pid, rid, fromIso, toIso]
    )
    return rows.map((r) => ({
      start_at: asIso(r.start_at),
      end_at: asIso(r.end_at),
      status: String(r.status ?? 'booked'),
      source: String(r.source ?? 'slot'),
    }))
  } catch (e) {
    console.warn('[fetchHospitalityRoomScheduleSlotsPg]', e)
    return []
  }
}

export async function fetchHospitalityAvailabilityPg(params: {
  partner_id: string
  checkin_at: string
  checkout_at: string
}): Promise<HospitalityAvailabilityItem[]> {
  if (!isPgConfigured()) return []
  const pid = safeUuid(params.partner_id)
  if (!pid) return []
  const checkinIso = new Date(params.checkin_at).toISOString()
  const checkoutIso = new Date(params.checkout_at).toISOString()
  if (!checkinIso || !checkoutIso || new Date(checkoutIso).getTime() <= new Date(checkinIso).getTime()) return []
  try {
    const rows = await pgQuery<{
      room_type_id: string
      room_type_name: string
      available_rooms: number
      base_hourly_rate: string | number | null
      base_daily_rate: string | number | null
      currency: string
    }>(
      `with room_base as (
         select r.id as room_id, r.room_type_id
         from public.hospitality_rooms r
         where r.partner_id = $1::uuid and r.status = 'active'
       ),
       blocked as (
         select distinct a.room_id
         from public.hospitality_availability_slots a
         where a.partner_id = $1::uuid
           and tstzrange(a.start_at, a.end_at, '[)') && tstzrange($2::timestamptz, $3::timestamptz, '[)')
       )
       select rt.id::text as room_type_id,
              rt.name as room_type_name,
              count(rb.room_id) filter (where b.room_id is null)::int as available_rooms,
              rt.base_hourly_rate, rt.base_daily_rate, rt.currency
       from public.hospitality_room_types rt
       left join room_base rb on rb.room_type_id = rt.id
       left join blocked b on b.room_id = rb.room_id
       where rt.partner_id = $1::uuid and coalesce(rt.is_active, true) = true
       group by rt.id, rt.name, rt.base_hourly_rate, rt.base_daily_rate, rt.currency
       order by rt.name asc`,
      [pid, checkinIso, checkoutIso]
    )
    return rows.map((r) => ({
      room_type_id: r.room_type_id,
      room_type_name: String(r.room_type_name ?? ''),
      available_rooms: Number(r.available_rooms ?? 0),
      base_hourly_rate: r.base_hourly_rate == null ? null : Number(r.base_hourly_rate),
      base_daily_rate: r.base_daily_rate == null ? null : Number(r.base_daily_rate),
      currency: String(r.currency ?? 'VND'),
    }))
  } catch (e) {
    console.warn('[fetchHospitalityAvailabilityPg]', e)
    return []
  }
}

export type HospitalityHoldRow = {
  id: string
  partner_id: string
  room_type_id: string
  checkin_at: string
  checkout_at: string
  expires_at: string
  status: string
}

export async function createHospitalityHoldPg(params: {
  partner_id: string
  room_type_id: string
  conversation_id?: string | null
  customer_name?: string | null
  customer_phone?: string | null
  guests?: number
  checkin_at: string
  checkout_at: string
  expires_minutes?: number
}): Promise<HospitalityHoldRow | null> {
  if (!isPgConfigured()) return null
  const pid = safeUuid(params.partner_id)
  const roomTypeId = safeUuid(params.room_type_id)
  if (!pid || !roomTypeId) return null
  const checkinAt = new Date(params.checkin_at)
  const checkoutAt = new Date(params.checkout_at)
  if (!Number.isFinite(checkinAt.getTime()) || !Number.isFinite(checkoutAt.getTime())) return null
  if (checkoutAt.getTime() <= checkinAt.getTime()) return null
  const expiresMinutes = Math.max(5, Math.min(120, Number(params.expires_minutes ?? 15)))
  const conversationId = safeUuid(params.conversation_id ?? null)
  try {
    const row = await pgQueryOne<{
      id: string
      partner_id: string
      room_type_id: string
      checkin_at: unknown
      checkout_at: unknown
      expires_at: unknown
      status: string
    }>(
      `insert into public.hospitality_holds
         (partner_id, room_type_id, conversation_id, customer_name, customer_phone, guests, checkin_at, checkout_at, expires_at, status, updated_at)
       values
         ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6, $7::timestamptz, $8::timestamptz, now() + ($9::text || ' minutes')::interval, 'active', now())
       returning id::text, partner_id::text, room_type_id::text, checkin_at, checkout_at, expires_at, status`,
      [
        pid,
        roomTypeId,
        conversationId,
        params.customer_name ? String(params.customer_name).trim() : null,
        params.customer_phone ? String(params.customer_phone).trim() : null,
        Math.max(1, Number(params.guests ?? 1)),
        checkinAt.toISOString(),
        checkoutAt.toISOString(),
        String(expiresMinutes),
      ]
    )
    if (!row) return null
    return {
      id: row.id,
      partner_id: row.partner_id,
      room_type_id: row.room_type_id,
      checkin_at: asIso(row.checkin_at),
      checkout_at: asIso(row.checkout_at),
      expires_at: asIso(row.expires_at),
      status: String(row.status ?? 'active'),
    }
  } catch (e) {
    console.warn('[createHospitalityHoldPg]', e)
    return null
  }
}

export type HospitalityBookingRow = {
  id: string
  partner_id: string
  room_type_id: string
  room_id: string | null
  hold_id: string | null
  customer_name: string
  customer_phone: string | null
  checkin_at: string
  checkout_at: string
  total_amount: number
  paid_amount: number
  currency: string
  status: string
  created_at: string
}

export async function createHospitalityBookingFromHoldPg(params: {
  partner_id: string
  hold_id: string
  customer_name: string
  customer_phone?: string | null
  customer_email?: string | null
  note?: string | null
  total_amount?: number
  currency?: string
  channel?: string
}): Promise<HospitalityBookingRow | null> {
  if (!isPgConfigured()) return null
  const pid = safeUuid(params.partner_id)
  const holdId = safeUuid(params.hold_id)
  if (!pid || !holdId) return null
  const customerName = String(params.customer_name ?? '').trim()
  if (!customerName) return null
  try {
    const row = await pgQueryOne<{
      id: string
      partner_id: string
      room_type_id: string
      room_id: string | null
      hold_id: string | null
      customer_name: string
      customer_phone: string | null
      checkin_at: unknown
      checkout_at: unknown
      total_amount: string | number
      paid_amount: string | number
      currency: string
      status: string
      created_at: unknown
    }>(
      `with hold_row as (
         select id, partner_id, room_type_id, checkin_at, checkout_at, conversation_id
         from public.hospitality_holds
         where id = $2::uuid and partner_id = $1::uuid and status = 'active' and expires_at > now()
         for update
       ),
       ins as (
         insert into public.hospitality_bookings
           (partner_id, room_type_id, hold_id, conversation_id, channel, customer_name, customer_phone, customer_email, guests,
            checkin_at, checkout_at, total_amount, paid_amount, currency, status, note, updated_at)
         select h.partner_id, h.room_type_id, h.id, h.conversation_id, $3, $4, $5, $6, 1,
                h.checkin_at, h.checkout_at, $7, 0, $8, 'pending', $9, now()
         from hold_row h
         returning id, partner_id, room_type_id, room_id, hold_id, customer_name, customer_phone, checkin_at, checkout_at,
                   total_amount, paid_amount, currency, status, created_at
       ),
       hold_upd as (
         update public.hospitality_holds
         set status = 'converted', updated_at = now()
         where id = $2::uuid and partner_id = $1::uuid and exists (select 1 from ins)
         returning id
       )
       select id::text, partner_id::text, room_type_id::text, room_id::text, hold_id::text,
              customer_name, customer_phone, checkin_at, checkout_at, total_amount, paid_amount,
              currency, status, created_at
       from ins`,
      [
        pid,
        holdId,
        String(params.channel ?? 'widget'),
        customerName,
        params.customer_phone ? String(params.customer_phone).trim() : null,
        params.customer_email ? String(params.customer_email).trim() : null,
        Number(params.total_amount ?? 0),
        String(params.currency ?? 'VND').trim().toUpperCase() || 'VND',
        params.note ? String(params.note).trim() : null,
      ]
    )
    if (!row) return null
    return {
      id: row.id,
      partner_id: row.partner_id,
      room_type_id: row.room_type_id,
      room_id: row.room_id ? String(row.room_id) : null,
      hold_id: row.hold_id ? String(row.hold_id) : null,
      customer_name: String(row.customer_name ?? ''),
      customer_phone: row.customer_phone ? String(row.customer_phone) : null,
      checkin_at: asIso(row.checkin_at),
      checkout_at: asIso(row.checkout_at),
      total_amount: Number(row.total_amount ?? 0),
      paid_amount: Number(row.paid_amount ?? 0),
      currency: String(row.currency ?? 'VND'),
      status: String(row.status ?? 'pending'),
      created_at: asIso(row.created_at),
    }
  } catch (e) {
    console.warn('[createHospitalityBookingFromHoldPg]', e)
    return null
  }
}

export async function fetchHospitalityBookingsPg(partnerId: string, limit = 50): Promise<HospitalityBookingRow[]> {
  if (!isPgConfigured()) return []
  const pid = safeUuid(partnerId)
  if (!pid) return []
  const safeLimit = Math.max(1, Math.min(200, Number(limit || 50)))
  try {
    const rows = await pgQuery<{
      id: string
      partner_id: string
      room_type_id: string
      room_id: string | null
      hold_id: string | null
      customer_name: string
      customer_phone: string | null
      checkin_at: unknown
      checkout_at: unknown
      total_amount: string | number
      paid_amount: string | number
      currency: string
      status: string
      created_at: unknown
    }>(
      `select id::text, partner_id::text, room_type_id::text, room_id::text, hold_id::text,
              customer_name, customer_phone, checkin_at, checkout_at, total_amount, paid_amount, currency, status, created_at
       from public.hospitality_bookings
       where partner_id = $1::uuid
       order by created_at desc
       limit $2`,
      [pid, safeLimit]
    )
    return rows.map((r) => ({
      id: r.id,
      partner_id: r.partner_id,
      room_type_id: r.room_type_id,
      room_id: r.room_id ? String(r.room_id) : null,
      hold_id: r.hold_id ? String(r.hold_id) : null,
      customer_name: String(r.customer_name ?? ''),
      customer_phone: r.customer_phone ? String(r.customer_phone) : null,
      checkin_at: asIso(r.checkin_at),
      checkout_at: asIso(r.checkout_at),
      total_amount: Number(r.total_amount ?? 0),
      paid_amount: Number(r.paid_amount ?? 0),
      currency: String(r.currency ?? 'VND'),
      status: String(r.status ?? 'pending'),
      created_at: asIso(r.created_at),
    }))
  } catch (e) {
    console.warn('[fetchHospitalityBookingsPg]', e)
    return []
  }
}

export async function fetchHospitalityBookingsForConversationPg(
  partnerId: string,
  conversationId: string,
  limit = 20
): Promise<HospitalityBookingRow[]> {
  if (!isPgConfigured()) return []
  const pid = safeUuid(partnerId)
  const cid = safeUuid(conversationId)
  if (!pid || !cid) return []
  const safeLimit = Math.max(1, Math.min(100, Number(limit || 20)))
  try {
    const rows = await pgQuery<{
      id: string
      partner_id: string
      room_type_id: string
      room_id: string | null
      hold_id: string | null
      customer_name: string
      customer_phone: string | null
      checkin_at: unknown
      checkout_at: unknown
      total_amount: string | number
      paid_amount: string | number
      currency: string
      status: string
      created_at: unknown
    }>(
      `select id::text, partner_id::text, room_type_id::text, room_id::text, hold_id::text,
              customer_name, customer_phone, checkin_at, checkout_at, total_amount, paid_amount, currency, status, created_at
       from public.hospitality_bookings
       where partner_id = $1::uuid and conversation_id = $2::uuid
       order by created_at desc
       limit $3`,
      [pid, cid, safeLimit]
    )
    return rows.map((r) => ({
      id: r.id,
      partner_id: r.partner_id,
      room_type_id: r.room_type_id,
      room_id: r.room_id ? String(r.room_id) : null,
      hold_id: r.hold_id ? String(r.hold_id) : null,
      customer_name: String(r.customer_name ?? ''),
      customer_phone: r.customer_phone ? String(r.customer_phone) : null,
      checkin_at: asIso(r.checkin_at),
      checkout_at: asIso(r.checkout_at),
      total_amount: Number(r.total_amount ?? 0),
      paid_amount: Number(r.paid_amount ?? 0),
      currency: String(r.currency ?? 'VND'),
      status: String(r.status ?? 'pending'),
      created_at: asIso(r.created_at),
    }))
  } catch (e) {
    console.warn('[fetchHospitalityBookingsForConversationPg]', e)
    return []
  }
}

export async function updateHospitalityBookingStatusPg(params: {
  partner_id: string
  booking_id: string
  status: 'pending' | 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled' | 'no_show'
}): Promise<boolean> {
  if (!isPgConfigured()) return false
  const pid = safeUuid(params.partner_id)
  const bookingId = safeUuid(params.booking_id)
  if (!pid || !bookingId) return false
  try {
    const row = await pgQueryOne<{ id: string }>(
      `update public.hospitality_bookings
       set status = $3, updated_at = now()
       where id = $2::uuid and partner_id = $1::uuid
       returning id::text`,
      [pid, bookingId, params.status]
    )
    return Boolean(row?.id)
  } catch (e) {
    console.warn('[updateHospitalityBookingStatusPg]', e)
    return false
  }
}

export async function createHospitalityPaymentPg(params: {
  partner_id: string
  booking_id: string
  provider: string
  amount: number
  currency?: string
  status?: 'pending' | 'paid' | 'failed' | 'refunded'
  provider_txn_id?: string | null
  raw_payload?: Record<string, unknown> | null
}): Promise<boolean> {
  if (!isPgConfigured()) return false
  const pid = safeUuid(params.partner_id)
  const bookingId = safeUuid(params.booking_id)
  if (!pid || !bookingId) return false
  const status = params.status ?? 'paid'
  try {
    const row = await pgQueryOne<{ id: string }>(
      `with payment_ins as (
         insert into public.hospitality_payments
           (partner_id, booking_id, provider, provider_txn_id, amount, currency, status, paid_at, raw_payload)
         values
           ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, case when $7 = 'paid' then now() else null end, $8::jsonb)
         returning id
       )
       update public.hospitality_bookings
       set paid_amount = paid_amount + case when $7 = 'paid' then $5 else 0 end,
           status = case when $7 = 'paid' and status = 'pending' then 'confirmed' else status end,
           updated_at = now()
       where id = $2::uuid and partner_id = $1::uuid and exists (select 1 from payment_ins)
       returning id::text`,
      [
        pid,
        bookingId,
        String(params.provider ?? 'manual').trim() || 'manual',
        params.provider_txn_id ? String(params.provider_txn_id).trim() : null,
        Number(params.amount ?? 0),
        String(params.currency ?? 'VND').trim().toUpperCase() || 'VND',
        status,
        JSON.stringify(params.raw_payload ?? {}),
      ]
    )
    return Boolean(row?.id)
  } catch (e) {
    console.warn('[createHospitalityPaymentPg]', e)
    return false
  }
}

export async function fetchHospitalityOwnerReportPg(partnerId: string): Promise<{
  booking_count_30d: number
  confirmed_count_30d: number
  revenue_paid_30d: number
  pending_holds: number
}> {
  if (!isPgConfigured()) {
    return { booking_count_30d: 0, confirmed_count_30d: 0, revenue_paid_30d: 0, pending_holds: 0 }
  }
  const pid = safeUuid(partnerId)
  if (!pid) {
    return { booking_count_30d: 0, confirmed_count_30d: 0, revenue_paid_30d: 0, pending_holds: 0 }
  }
  try {
    const row = await pgQueryOne<{
      booking_count_30d: number
      confirmed_count_30d: number
      revenue_paid_30d: string | number
      pending_holds: number
    }>(
      `select
         (select count(*)::int
          from public.hospitality_bookings b
          where b.partner_id = $1::uuid and b.created_at >= now() - interval '30 days') as booking_count_30d,
         (select count(*)::int
          from public.hospitality_bookings b
          where b.partner_id = $1::uuid and b.status in ('confirmed','checked_in','checked_out')
            and b.created_at >= now() - interval '30 days') as confirmed_count_30d,
         (select coalesce(sum(case when p.status = 'paid' then p.amount else 0 end), 0)
          from public.hospitality_payments p
          where p.partner_id = $1::uuid and p.created_at >= now() - interval '30 days') as revenue_paid_30d,
         (select count(*)::int
          from public.hospitality_holds h
          where h.partner_id = $1::uuid and h.status = 'active' and h.expires_at > now()) as pending_holds`,
      [pid]
    )
    if (!row) return { booking_count_30d: 0, confirmed_count_30d: 0, revenue_paid_30d: 0, pending_holds: 0 }
    return {
      booking_count_30d: Number(row.booking_count_30d ?? 0),
      confirmed_count_30d: Number(row.confirmed_count_30d ?? 0),
      revenue_paid_30d: Number(row.revenue_paid_30d ?? 0),
      pending_holds: Number(row.pending_holds ?? 0),
    }
  } catch (e) {
    console.warn('[fetchHospitalityOwnerReportPg]', e)
    return { booking_count_30d: 0, confirmed_count_30d: 0, revenue_paid_30d: 0, pending_holds: 0 }
  }
}

export async function findHospitalityFaqMatchPg(partnerId: string, text: string): Promise<string | null> {
  if (!isPgConfigured()) return null
  const pid = safeUuid(partnerId)
  if (!pid) return null
  const normalized = String(text ?? '').trim().toLowerCase()
  if (!normalized) return null
  try {
    const row = await pgQueryOne<{ answer: string }>(
      `select answer
       from public.hospitality_faq
       where partner_id = $1::uuid
         and coalesce(is_active, true) = true
         and trigger_keywords <> ''
         and exists (
           select 1
           from unnest(string_to_array(lower(trigger_keywords), ',')) kw
           where position(trim(kw) in $2) > 0
         )
       order by updated_at desc
       limit 1`,
      [pid, normalized]
    )
    return row?.answer ? String(row.answer) : null
  } catch (e) {
    console.warn('[findHospitalityFaqMatchPg]', e)
    return null
  }
}

export async function fetchHospitalityConversationBookingAnchorPg(conversationId: string): Promise<{
  booking_id: string
  status: string
  checkin_at: string
  checkout_at: string
} | null> {
  if (!isPgConfigured()) return null
  const convId = safeUuid(conversationId)
  if (!convId) return null
  try {
    const row = await pgQueryOne<{
      booking_id: string
      status: string
      checkin_at: unknown
      checkout_at: unknown
    }>(
      `select id::text as booking_id, status, checkin_at, checkout_at
       from public.hospitality_bookings
       where conversation_id = $1::uuid
       order by created_at desc
       limit 1`,
      [convId]
    )
    if (!row) return null
    return {
      booking_id: row.booking_id,
      status: String(row.status ?? ''),
      checkin_at: asIso(row.checkin_at),
      checkout_at: asIso(row.checkout_at),
    }
  } catch (e) {
    console.warn('[fetchHospitalityConversationBookingAnchorPg]', e)
    return null
  }
}

export async function enqueueHospitalityPmsSyncJobPg(params: {
  partner_id: string
  connector_key: string
  direction: 'push' | 'pull'
  entity_type: string
  entity_id?: string | null
  payload?: Record<string, unknown>
}): Promise<boolean> {
  if (!isPgConfigured()) return false
  const pid = safeUuid(params.partner_id)
  if (!pid) return false
  try {
    const row = await pgQueryOne<{ id: string }>(
      `insert into public.hospitality_pms_sync_jobs
         (partner_id, connector_key, direction, entity_type, entity_id, payload, status)
       values
         ($1::uuid, $2, $3, $4, $5, $6::jsonb, 'pending')
       returning id::text`,
      [
        pid,
        String(params.connector_key ?? 'other').trim() || 'other',
        params.direction,
        String(params.entity_type ?? '').trim() || 'booking',
        params.entity_id ? String(params.entity_id).trim() : null,
        JSON.stringify(params.payload ?? {}),
      ]
    )
    return Boolean(row?.id)
  } catch (e) {
    console.warn('[enqueueHospitalityPmsSyncJobPg]', e)
    return false
  }
}

export async function fetchPendingHospitalityPmsSyncJobsPg(limit: number): Promise<
  Array<{
    id: string
    partner_id: string
    connector_key: string
    direction: 'push' | 'pull'
    entity_type: string
    entity_id: string | null
    payload: Record<string, unknown>
    attempt_count: number
  }>
> {
  if (!isPgConfigured()) return []
  const safeLimit = Math.max(1, Math.min(200, Number(limit || 20)))
  try {
    const rows = await pgQuery<{
      id: string
      partner_id: string
      connector_key: string
      direction: 'push' | 'pull'
      entity_type: string
      entity_id: string | null
      payload: Record<string, unknown> | null
      attempt_count: number
    }>(
      `select id::text, partner_id::text, connector_key, direction, entity_type, entity_id, payload, attempt_count
       from public.hospitality_pms_sync_jobs
       where status = 'pending' and (next_retry_at is null or next_retry_at <= now())
       order by created_at asc
       limit $1`,
      [safeLimit]
    )
    return rows.map((r) => ({
      id: r.id,
      partner_id: r.partner_id,
      connector_key: String(r.connector_key ?? 'other'),
      direction: r.direction,
      entity_type: String(r.entity_type ?? ''),
      entity_id: r.entity_id ? String(r.entity_id) : null,
      payload: r.payload ?? {},
      attempt_count: Number(r.attempt_count ?? 0),
    }))
  } catch (e) {
    console.warn('[fetchPendingHospitalityPmsSyncJobsPg]', e)
    return []
  }
}

export async function updateHospitalityPmsSyncJobStatusPg(params: {
  id: string
  status: 'processing' | 'done' | 'failed' | 'cancelled'
  last_error?: string | null
  bump_attempt?: boolean
}): Promise<boolean> {
  if (!isPgConfigured()) return false
  const id = safeUuid(params.id)
  if (!id) return false
  try {
    const row = await pgQueryOne<{ id: string }>(
      `update public.hospitality_pms_sync_jobs
       set status = $2,
           last_error = $3,
           attempt_count = attempt_count + case when $4 then 1 else 0 end,
           updated_at = now()
       where id = $1::uuid
       returning id::text`,
      [id, params.status, params.last_error ?? null, params.bump_attempt === true]
    )
    return Boolean(row?.id)
  } catch (e) {
    console.warn('[updateHospitalityPmsSyncJobStatusPg]', e)
    return false
  }
}

export async function fetchHospitalityAiSettingsPg(partnerId: string): Promise<{
  enabled: boolean
  tone_instructions: string
  policy_text: string
  default_locale: string
  auto_reply_enabled: boolean
} | null> {
  if (!isPgConfigured()) return null
  const pid = safeUuid(partnerId)
  if (!pid) return null
  try {
    const row = await pgQueryOne<{
      enabled: boolean | null
      tone_instructions: string | null
      policy_text: string | null
      default_locale: string | null
      auto_reply_enabled: boolean | null
    }>(
      `select enabled, tone_instructions, policy_text, default_locale, auto_reply_enabled
       from public.hospitality_ai_settings
       where partner_id = $1::uuid
       limit 1`,
      [pid]
    )
    if (!row) return null
    return {
      enabled: row.enabled !== false,
      tone_instructions: String(row.tone_instructions ?? ''),
      policy_text: String(row.policy_text ?? ''),
      default_locale: String(row.default_locale ?? 'vi'),
      auto_reply_enabled: row.auto_reply_enabled !== false,
    }
  } catch (e) {
    console.warn('[fetchHospitalityAiSettingsPg]', e)
    return null
  }
}

export async function upsertHospitalityAiSettingsPg(params: {
  partner_id: string
  enabled?: boolean
  tone_instructions?: string
  policy_text?: string
  default_locale?: string
  auto_reply_enabled?: boolean
}): Promise<boolean> {
  if (!isPgConfigured()) return false
  const pid = safeUuid(params.partner_id)
  if (!pid) return false
  try {
    const row = await pgQueryOne<{ partner_id: string }>(
      `insert into public.hospitality_ai_settings
         (partner_id, enabled, tone_instructions, policy_text, default_locale, auto_reply_enabled, updated_at)
       values
         ($1::uuid, $2, $3, $4, $5, $6, now())
       on conflict (partner_id) do update
       set enabled = excluded.enabled,
           tone_instructions = excluded.tone_instructions,
           policy_text = excluded.policy_text,
           default_locale = excluded.default_locale,
           auto_reply_enabled = excluded.auto_reply_enabled,
           updated_at = now()
       returning partner_id::text`,
      [
        pid,
        params.enabled !== false,
        String(params.tone_instructions ?? 'Lich su, nhanh, ro rang.'),
        String(params.policy_text ?? ''),
        String(params.default_locale ?? 'vi'),
        params.auto_reply_enabled !== false,
      ]
    )
    return Boolean(row?.partner_id)
  } catch (e) {
    console.warn('[upsertHospitalityAiSettingsPg]', e)
    return false
  }
}
