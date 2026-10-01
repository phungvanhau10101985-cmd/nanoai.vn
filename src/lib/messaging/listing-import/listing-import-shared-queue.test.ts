import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { listingImportRunIsSharedLive } from '@/lib/messaging/listing-import/listing-import-types'

describe('listingImportRunIsSharedLive', () => {
  it('shows a running or paused shop queue to every staff account', () => {
    assert.equal(listingImportRunIsSharedLive({ run_status: 'running', counts: { pending: 3, running: 1 } }), true)
    assert.equal(listingImportRunIsSharedLive({ run_status: 'paused', counts: { pending: 2, running: 0 } }), true)
    assert.equal(listingImportRunIsSharedLive({ run_status: 'idle', counts: { pending: 0, running: 0 } }), true)
  })

  it('hides stopped and finished queues from the shared live panel', () => {
    assert.equal(listingImportRunIsSharedLive({ run_status: 'stopped', counts: { pending: 1, running: 0 } }), false)
    assert.equal(
      listingImportRunIsSharedLive({ run_status: 'running', stop_requested: true, counts: { pending: 1, running: 1 } }),
      false,
    )
    assert.equal(listingImportRunIsSharedLive({ run_status: 'completed', counts: { pending: 0, running: 0 } }), false)
  })
})
