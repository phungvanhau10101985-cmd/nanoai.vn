import assert from 'node:assert/strict'
import test from 'node:test'

import {
  isRevisionExpired,
  revisionDaysRemaining,
  shouldCoalesceRevisionSession,
} from '@/lib/partner-website/partner-website-revision-policy'

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

test('session coalesce keeps one snapshot for the same edit kind', () => {
  const t0 = Date.parse('2026-08-13T10:00:00.000Z')
  assert.equal(
    shouldCoalesceRevisionSession({
      lastChangeNote: 'update_theme_colors',
      lastCreatedAtIso: new Date(t0).toISOString(),
      nextChangeNote: 'update_theme_colors',
      nowMs: t0 + 10 * 60 * 1000,
    }),
    true
  )
  assert.equal(
    shouldCoalesceRevisionSession({
      lastChangeNote: 'update_theme_colors',
      lastCreatedAtIso: new Date(t0).toISOString(),
      nextChangeNote: 'update_brand',
      nowMs: t0 + 10 * 60 * 1000,
    }),
    false
  )
  assert.equal(
    shouldCoalesceRevisionSession({
      lastChangeNote: 'update_theme_colors',
      lastCreatedAtIso: new Date(t0).toISOString(),
      nextChangeNote: 'update_theme_colors',
      nowMs: t0 + 31 * 60 * 1000,
    }),
    false
  )
})

test('restore snapshots are never coalesced', () => {
  const t0 = Date.parse('2026-08-13T10:00:00.000Z')
  assert.equal(
    shouldCoalesceRevisionSession({
      lastChangeNote: 'before_restore',
      lastCreatedAtIso: new Date(t0).toISOString(),
      nextChangeNote: 'before_restore',
      nowMs: t0 + 60 * 1000,
    }),
    false
  )
})

test('revisions expire after 7 days if not restored', () => {
  const now = Date.parse('2026-08-13T10:00:00.000Z')
  const fresh = new Date(now - 2 * DAY).toISOString()
  const stale = new Date(now - 8 * DAY).toISOString()
  assert.equal(isRevisionExpired(fresh, now), false)
  assert.equal(isRevisionExpired(stale, now), true)
  assert.equal(revisionDaysRemaining(fresh, now), 5)
  assert.equal(revisionDaysRemaining(stale, now), 0)
})
