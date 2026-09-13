import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

test('storefront order/personalization thread lookup does not finalize Google auth on every GET', () => {
  const dir = dirname(fileURLToPath(import.meta.url))
  const src = readFileSync(join(dir, 'resolve-widget-order-thread.ts'), 'utf8')
  assert.doesNotMatch(src, /upsertGuestAccountForGoogleIdentity/)
  assert.doesNotMatch(src, /completeGuestEmailAuth/)
  assert.match(src, /findGuestAccountIdByEmailPg/)
  assert.match(src, /readGuestAccountIdFromRequest/)

  const ordersSrc = readFileSync(
    join(dir, '../../app/api/messaging/guest/[slug]/orders/route.ts'),
    'utf8'
  )
  assert.doesNotMatch(ordersSrc, /upsertGuestAccountForGoogleIdentity/)
  assert.match(ordersSrc, /findGuestAccountIdByEmailPg/)
})
