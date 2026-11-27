import assert from 'node:assert/strict'
import test from 'node:test'
import {
  replyMatchesShopVoice,
  rewriteForeignShopHosts,
  type ShopVoice,
} from './partner-review-shop-voice'

const gudo: ShopVoice = {
  ownLabel: 'gudo.vn',
  foreignLabels: ['188.com.vn', 'other.example'],
}

test('rewrites another shop host in the reply signature', () => {
  assert.equal(rewriteForeignShopHosts('188.com.vn', gudo), 'gudo.vn')
  assert.equal(
    rewriteForeignShopHosts('Dạ 188.com.vn cảm ơn chị đã chia sẻ ạ.', gudo),
    'Dạ gudo.vn cảm ơn chị đã chia sẻ ạ.'
  )
})

test('leaves the viewing shop host and unrelated names', () => {
  const own: ShopVoice = { ownLabel: '188.com.vn', foreignLabels: ['gudo.vn'] }
  assert.equal(rewriteForeignShopHosts('188.com.vn cảm ơn anh.', own), '188.com.vn cảm ơn anh.')
  assert.equal(rewriteForeignShopHosts('Nguyễn An', gudo), 'Nguyễn An')
  assert.equal(rewriteForeignShopHosts('https://cdn.188.com.vn/a.jpg', gudo), 'https://cdn.188.com.vn/a.jpg')
})

test('echo of the rewritten signature is not a real edit', () => {
  assert.equal(replyMatchesShopVoice('188.com.vn', 'gudo.vn', gudo), true)
  assert.equal(replyMatchesShopVoice('188.com.vn', 'Gudo Fashion', gudo), false)
})
