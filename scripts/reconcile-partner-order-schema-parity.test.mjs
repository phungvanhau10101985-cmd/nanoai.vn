import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  canonicalPaymentEventIds,
  legacyHoldConversionPlan,
  parseReconcileArgs,
  runReconcileMode,
} from './reconcile-partner-order-schema-parity.mjs'

test('reconcile defaults to dry-run', () => {
  assert.deepEqual(parseReconcileArgs([]), { apply: false })
})

test('reconcile mutates only with explicit apply', () => {
  assert.deepEqual(parseReconcileArgs(['--apply']), { apply: true })
  assert.throws(() => parseReconcileArgs(['--yes']), /Unknown argument/)
})

test('default reconcile mode is operationally read-only', async () => {
  let applyCalls = 0
  const result = await runReconcileMode({
    apply: false,
    auditFn: async () => ({ duplicate_rows: 2 }),
    applyFn: async () => { applyCalls += 1 },
  })
  assert.equal(applyCalls, 0)
  assert.deepEqual(result, {
    mode: 'dry-run',
    before: { duplicate_rows: 2 },
  })
})

test('payment event canonical selection is deterministic', () => {
  const rows = [
    { id: 'b', status: 'processing', created_at: '2026-01-01T00:00:00Z' },
    { id: 'c', status: 'completed', created_at: '2026-01-02T00:00:00Z' },
    { id: 'a', status: 'completed', created_at: '2026-01-02T00:00:00Z' },
  ]
  assert.deepEqual(canonicalPaymentEventIds(rows), ['a', 'c', 'b'])
  assert.deepEqual(canonicalPaymentEventIds(rows.reverse()), ['a', 'c', 'b'])
})

test('legacy hold conversion plan is deterministic', () => {
  const rows = [
    { partner_id: 'p2', inventory_id: 'i1', quantity: 0 },
    { partner_id: 'p1', inventory_id: 'i1', quantity: 2 },
    { partner_id: 'p1', inventory_id: 'i1', quantity: 3 },
  ]
  const expected = [
    { key: 'p1:i1', quantity: 5 },
    { key: 'p2:i1', quantity: 1 },
  ]
  assert.deepEqual(legacyHoldConversionPlan(rows), expected)
  assert.deepEqual(legacyHoldConversionPlan(rows.reverse()), expected)
})

test('staged parity migrations contain no historical data mutation', () => {
  for (const name of [
    '20260921170000_partner_checkout_stock_payment_parity.sql',
    '20260921180000_partner_order_schema_audit_parity.sql',
  ]) {
    const sql = readFileSync(join(
      dirname(fileURLToPath(import.meta.url)), '..', 'db', 'migrations', name,
    ), 'utf8')
    assert.doesNotMatch(sql, /^\s*(update|delete|insert)\b/im)
    assert.doesNotMatch(sql, /create\s+unique\s+index/i)
  }
})
