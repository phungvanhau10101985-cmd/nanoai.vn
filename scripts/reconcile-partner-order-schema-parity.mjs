#!/usr/bin/env node
/**
 * Audit/reconcile order schema parity. Read-only unless --apply is explicit.
 *
 *   node scripts/reconcile-partner-order-schema-parity.mjs
 *   node scripts/reconcile-partner-order-schema-parity.mjs --apply
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { Pool } from 'pg'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

export function parseReconcileArgs(argv) {
  const unknown = argv.filter((arg) => arg !== '--apply')
  if (unknown.length) throw new Error(`Unknown argument(s): ${unknown.join(', ')}`)
  return { apply: argv.includes('--apply') }
}

export function canonicalPaymentEventIds(rows) {
  return [...rows]
    .sort((a, b) => {
      const statusRank = (row) => row.status === 'completed' ? 0 : 1
      return statusRank(a) - statusRank(b)
        || String(a.created_at || '').localeCompare(String(b.created_at || ''))
        || String(a.id).localeCompare(String(b.id))
    })
    .map((row) => row.id)
}

export function legacyHoldConversionPlan(rows) {
  const totals = new Map()
  for (const row of rows) {
    const key = `${row.partner_id}:${row.inventory_id}`
    totals.set(key, (totals.get(key) || 0) + Math.max(1, Number(row.quantity) || 1))
  }
  return [...totals.entries()]
    .map(([key, quantity]) => ({ key, quantity }))
    .sort((a, b) => a.key.localeCompare(b.key))
}

export async function runReconcileMode({ apply, auditFn, applyFn }) {
  const before = await auditFn()
  if (!apply) return { mode: 'dry-run', before }
  await applyFn()
  return { mode: 'apply', before, after: await auditFn() }
}

function loadEnv(name) {
  const path = join(root, name)
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const value = line.trim()
    if (!value || value.startsWith('#')) continue
    const at = value.indexOf('=')
    if (at < 1) continue
    const key = value.slice(0, at).trim()
    let raw = value.slice(at + 1).trim()
    if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) raw = raw.slice(1, -1)
    if (!process.env[key]) process.env[key] = raw
  }
}

async function scalar(client, sql) {
  const result = await client.query(sql)
  return Number(result.rows[0]?.count || 0)
}

async function schemaColumns(client) {
  const result = await client.query(`
    select table_name, column_name from information_schema.columns
    where table_schema = 'public'
      and table_name = any($1::text[])`, [[
    'messaging_partner_inventory',
    'messaging_partner_orders',
    'messaging_partner_order_lines',
    'messaging_partner_order_shipment_events',
    'messaging_partner_payment_webhook_events',
    'messaging_partner_payment_webhook_effects',
    'messaging_partner_parity_reconcile_archive',
  ]])
  const out = new Map()
  for (const row of result.rows) {
    const values = out.get(row.table_name) || new Set()
    values.add(row.column_name)
    out.set(row.table_name, values)
  }
  return out
}

async function audit(client, schema) {
  const lineColumns = schema.get('messaging_partner_order_lines') || new Set()
  const warehouseReady = schema.get('messaging_partner_inventory')?.has('warehouse_reserved')
    && ['warehouse_stock_restored_at', 'warehouse_stock_additive']
      .every((name) => lineColumns.has(name))
  const timelineReady = schema.get('messaging_partner_orders')?.has('timeline_schema_version')
  const eventColumns = schema.get('messaging_partner_order_shipment_events') || new Set()
  const shipmentReady = ['actor_type', 'actor_id', 'idempotency_key'].every((name) => eventColumns.has(name))
  const webhookReady = schema.has('messaging_partner_payment_webhook_events')
    && schema.has('messaging_partner_payment_webhook_effects')
  const archiveReady = schema.has('messaging_partner_parity_reconcile_archive')
  return {
    warehouse_reserved: {
      schema_missing: !warehouseReady,
      negative_products: !warehouseReady ? null : await scalar(client, `
        select count(*) from public.messaging_partner_inventory
        where warehouse_reserved < 0`),
      legacy_hold_lines: !warehouseReady ? null : await scalar(client, `
        select count(*) from public.messaging_partner_order_lines
        where fulfillment_source = 'vietnam'
          and product_inventory_id is not null
          and warehouse_stock_reserved_at is not null
          and warehouse_stock_deducted_at is null
          and warehouse_stock_restored_at is null
          and warehouse_stock_additive = false`),
      legacy_hold_quantity: !warehouseReady ? null : await scalar(client, `
        select coalesce(sum(greatest(1, coalesce(quantity, 1))), 0) count
        from public.messaging_partner_order_lines
        where fulfillment_source = 'vietnam'
          and product_inventory_id is not null
          and warehouse_stock_reserved_at is not null
          and warehouse_stock_deducted_at is null
          and warehouse_stock_restored_at is null
          and warehouse_stock_additive = false`),
      mismatched_products: !warehouseReady ? null : await scalar(client, `
        with expected as (
          select l.product_inventory_id inventory_id,
                 sum(greatest(1, coalesce(l.quantity, 1)))::int quantity
          from public.messaging_partner_order_lines l
          where l.fulfillment_source = 'vietnam'
            and l.product_inventory_id is not null
            and l.warehouse_stock_reserved_at is not null
            and l.warehouse_stock_deducted_at is null
            and l.warehouse_stock_restored_at is null
          group by l.product_inventory_id
        )
        select count(*) from public.messaging_partner_inventory i
        left join expected e on e.inventory_id = i.id
        where coalesce(i.warehouse_reserved, 0) <> coalesce(e.quantity, 0)`),
    },
    timeline_schema_version: {
      schema_missing: !timelineReady,
      orders_not_v1: !timelineReady ? null : await scalar(client, `
        select count(*) from public.messaging_partner_orders
        where coalesce(timeline_schema_version, 0) <> 1`),
    },
    shipment_event_actor_idempotency: {
      schema_missing: !shipmentReady,
      missing_actor_type: !shipmentReady ? null : await scalar(client, `
        select count(*) from public.messaging_partner_order_shipment_events
        where nullif(trim(actor_type), '') is null`),
      actor_rows_to_reconcile: !shipmentReady ? null : await scalar(client, `
        select count(*) from public.messaging_partner_order_shipment_events
        where actor_type is distinct from case
          when lower(updated_by) = 'cron' then 'cron'
          when lower(updated_by) = 'ems' then 'ems'
          when lower(updated_by) = 'customer' then 'customer'
          when lower(updated_by) in ('staff', 'admin') then 'admin'
          when nullif(trim(updated_by), '') is not null and lower(updated_by) <> 'system' then 'admin'
          else 'system' end`),
      missing_idempotency_key: !shipmentReady ? null : await scalar(client, `
        select count(*) from public.messaging_partner_order_shipment_events
        where nullif(trim(idempotency_key), '') is null`),
      duplicate_keys: !shipmentReady ? null : await scalar(client, `
        select count(*) from (
          select order_id, idempotency_key
          from public.messaging_partner_order_shipment_events
          where nullif(trim(idempotency_key), '') is not null
          group by order_id, idempotency_key having count(*) > 1
        ) d`),
      duplicate_rows: !shipmentReady ? null : await scalar(client, `
        select coalesce(sum(n - 1), 0) count from (
          select count(*) n
          from public.messaging_partner_order_shipment_events
          where nullif(trim(idempotency_key), '') is not null
          group by order_id, idempotency_key having count(*) > 1
        ) d`),
    },
    payment_webhook_event_duplicates: {
      schema_missing: !webhookReady || !archiveReady,
      duplicate_keys: !webhookReady ? null : await scalar(client, `
        select count(*) from (
          select partner_id, provider, provider_event_id
          from public.messaging_partner_payment_webhook_events
          group by partner_id, provider, provider_event_id having count(*) > 1
        ) d`),
      duplicate_rows: !webhookReady ? null : await scalar(client, `
        select coalesce(sum(n - 1), 0) count from (
          select count(*) n
          from public.messaging_partner_payment_webhook_events
          group by partner_id, provider, provider_event_id having count(*) > 1
        ) d`),
    },
  }
}

export async function reconcile(client) {
  await client.query(`
    with legacy_holds as (
      select o.partner_id, l.product_inventory_id inventory_id,
             sum(greatest(1, coalesce(l.quantity, 1)))::int quantity
      from public.messaging_partner_order_lines l
      join public.messaging_partner_orders o on o.id = l.order_id
      where l.fulfillment_source = 'vietnam'
        and l.product_inventory_id is not null
        and l.warehouse_stock_reserved_at is not null
        and l.warehouse_stock_deducted_at is null
        and l.warehouse_stock_restored_at is null
        and l.warehouse_stock_additive = false
      group by o.partner_id, l.product_inventory_id
    )
    update public.messaging_partner_inventory i
    set stock_qty = coalesce(i.stock_qty, 0) + h.quantity,
        updated_at = now()
    from legacy_holds h
    where i.id = h.inventory_id and i.partner_id = h.partner_id`)
  await client.query(`
    update public.messaging_partner_order_lines l
    set warehouse_stock_additive = true, updated_at = now()
    from public.messaging_partner_orders o, public.messaging_partner_inventory i
    where o.id = l.order_id
      and i.id = l.product_inventory_id and i.partner_id = o.partner_id
      and l.fulfillment_source = 'vietnam'
      and l.warehouse_stock_reserved_at is not null
      and l.warehouse_stock_deducted_at is null
      and l.warehouse_stock_restored_at is null
      and l.warehouse_stock_additive = false`)
  await client.query(`
    with expected as (
      select l.product_inventory_id inventory_id,
             sum(greatest(1, coalesce(l.quantity, 1)))::int quantity
      from public.messaging_partner_order_lines l
      where l.fulfillment_source = 'vietnam'
        and l.product_inventory_id is not null
        and l.warehouse_stock_reserved_at is not null
        and l.warehouse_stock_deducted_at is null
        and l.warehouse_stock_restored_at is null
      group by l.product_inventory_id
    )
    update public.messaging_partner_inventory i
    set warehouse_reserved = coalesce(e.quantity, 0), updated_at = now()
    from (select i2.id, e2.quantity from public.messaging_partner_inventory i2
          left join expected e2 on e2.inventory_id = i2.id) e
    where i.id = e.id and coalesce(i.warehouse_reserved, 0) <> coalesce(e.quantity, 0)`)
  await client.query(`update public.messaging_partner_orders set timeline_schema_version = 1 where coalesce(timeline_schema_version, 0) <> 1`)
  await client.query(`
    update public.messaging_partner_order_shipment_events
    set actor_type = case
          when lower(updated_by) = 'cron' then 'cron'
          when lower(updated_by) = 'ems' then 'ems'
          when lower(updated_by) = 'customer' then 'customer'
          when lower(updated_by) in ('staff', 'admin') then 'admin'
          when nullif(trim(updated_by), '') is not null and lower(updated_by) <> 'system' then 'admin'
          else 'system'
        end,
        actor_id = case when lower(updated_by) not in ('', 'system', 'cron', 'ems', 'customer', 'staff', 'admin')
                        then updated_by else actor_id end,
        idempotency_key = coalesce(nullif(trim(idempotency_key), ''), 'legacy:event:' || id::text),
        updated_at = now()
    where actor_type is distinct from case
            when lower(updated_by) = 'cron' then 'cron'
            when lower(updated_by) = 'ems' then 'ems'
            when lower(updated_by) = 'customer' then 'customer'
            when lower(updated_by) in ('staff', 'admin') then 'admin'
            when nullif(trim(updated_by), '') is not null and lower(updated_by) <> 'system' then 'admin'
            else 'system' end
       or nullif(trim(actor_type), '') is null
       or nullif(trim(idempotency_key), '') is null`)
  await client.query(`
    with ranked as (
      select e.*, first_value(id) over (
        partition by partner_id, provider, provider_event_id
        order by case when status = 'completed' then 0 else 1 end,
                 created_at nulls last, id
      ) canonical_id,
      row_number() over (
        partition by partner_id, provider, provider_event_id
        order by case when status = 'completed' then 0 else 1 end,
                 created_at nulls last, id
      ) rn
      from public.messaging_partner_payment_webhook_events e
    )
    insert into public.messaging_partner_parity_reconcile_archive (
      entity_type, original_id, canonical_id, dedupe_key, payload
    )
    select 'payment_webhook_event', r.id::text, r.canonical_id::text,
           concat_ws(':', r.partner_id, r.provider, r.provider_event_id),
           jsonb_build_object(
             'event', to_jsonb(r) - 'canonical_id' - 'rn',
             'effects', coalesce((
               select jsonb_agg(to_jsonb(f) order by f.effect_key)
               from public.messaging_partner_payment_webhook_effects f
               where f.event_id = r.id
             ), '[]'::jsonb)
           )
    from ranked r where r.rn > 1
    on conflict (entity_type, original_id) do nothing`)
  await client.query(`
    with ranked as (
      select id, row_number() over (
        partition by partner_id, provider, provider_event_id
        order by case when status = 'completed' then 0 else 1 end,
                 created_at nulls last, id
      ) rn
      from public.messaging_partner_payment_webhook_events
    )
    delete from public.messaging_partner_payment_webhook_events e
    using ranked r
    where e.id = r.id and r.rn > 1`)
  await client.query(`
    with ranked as (
      select id, row_number() over (
        partition by order_id, idempotency_key order by created_at nulls last, id
      ) rn
      from public.messaging_partner_order_shipment_events
      where nullif(trim(idempotency_key), '') is not null
    )
    update public.messaging_partner_order_shipment_events e
    set idempotency_key = 'legacy:event:' || e.id::text,
        updated_at = now()
    from ranked r where e.id = r.id and r.rn > 1`)
  await client.query(`
    create unique index if not exists uq_mp_order_shipment_event_idempotency
    on public.messaging_partner_order_shipment_events (order_id, idempotency_key)
    where idempotency_key is not null and trim(idempotency_key) <> ''`)
  await client.query(`
    create unique index if not exists uq_mp_payment_webhook_event_provider
    on public.messaging_partner_payment_webhook_events
      (partner_id, provider, provider_event_id)`)
  await client.query(`
    alter table public.messaging_partner_inventory
    validate constraint messaging_partner_inventory_warehouse_reserved_nonnegative`)
  await client.query(`
    alter table public.messaging_partner_order_shipment_events
    validate constraint messaging_partner_order_shipment_events_actor_type_check`)
}

export async function main(argv = process.argv.slice(2)) {
  const { apply } = parseReconcileArgs(argv)
  loadEnv('.env.local')
  loadEnv('.env')
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required')
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 })
  const client = await pool.connect()
  try {
    const schema = await schemaColumns(client)
    const result = await runReconcileMode({
      apply,
      auditFn: () => audit(client, schema),
      applyFn: async () => {
        const readiness = await audit(client, schema)
        if (Object.values(readiness).some((section) => section.schema_missing)) {
          throw new Error('Apply db/migrations/20260921170000 and 20260921180000 before --apply')
        }
        await client.query('begin')
        try {
          await reconcile(client)
          await client.query('commit')
        } catch (error) {
          await client.query('rollback')
          throw error
        }
      },
    })
    console.log(JSON.stringify(result, null, 2))
  } finally {
    client.release()
    await pool.end()
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
}
