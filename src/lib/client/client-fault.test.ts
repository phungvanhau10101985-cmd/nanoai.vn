import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { isClientNetworkFault, isClientNetworkFaultMessage } from './client-network-fault'
import { isChunkLoadError } from './recover-chunk-load'

describe('client network fault', () => {
  it('recognizes Safari Load failed and other browser fetch failures', () => {
    assert.equal(isClientNetworkFaultMessage('Load failed'), true)
    assert.equal(isClientNetworkFault(new TypeError('Load failed')), true)
    assert.equal(isClientNetworkFaultMessage('Failed to fetch'), true)
    assert.equal(isClientNetworkFaultMessage('NetworkError when attempting to fetch resource.'), true)
    assert.equal(isClientNetworkFaultMessage('Xóa vật thể thất bại: AI không trả về ảnh hợp lệ.'), false)
  })
})

describe('chunk load error', () => {
  it('detects webpack ChunkLoadError text', () => {
    assert.equal(
      isChunkLoadError({
        name: 'ChunkLoadError',
        message:
          'Loading chunk 2595 failed.\n(error: https://tiemanhai.vn/_next/static/chunks/2595-834bc7d62686281b.js)',
      }),
      true
    )
    assert.equal(isChunkLoadError({ name: 'TypeError', message: 'Load failed' }), false)
  })
})
