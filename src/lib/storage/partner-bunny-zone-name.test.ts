import assert from 'node:assert/strict'
import test from 'node:test'
import { partnerBunnyZoneName } from './partner-bunny-zone-name'

test('zone name follows shop slug', () => {
  assert.equal(
    partnerBunnyZoneName({ slug: 'Gudo Fashion-ab12' }),
    'gudo-fashion-ab12'
  )
})

test('zone name avoids the platform storage zone', () => {
  assert.equal(
    partnerBunnyZoneName({ slug: 'nanoai-cdn', platformZoneName: 'nanoai-cdn' }),
    'nanoai-cdn-shop'
  )
})

test('retry appends a short partner suffix', () => {
  assert.equal(
    partnerBunnyZoneName({
      slug: 'gudo',
      attempt: 1,
      partnerId: 'ab12cd34-0000-4000-8000-000000000000',
    }),
    'gudo-ab12cd'
  )
})
