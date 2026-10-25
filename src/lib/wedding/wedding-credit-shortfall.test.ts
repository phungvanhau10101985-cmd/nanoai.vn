import assert from 'node:assert/strict'
import test from 'node:test'
import { isWeddingInsufficientCredit } from './wedding-credit-shortfall'

test('thiếu credit nhận mã và câu lỗi cũ', () => {
  assert.equal(isWeddingInsufficientCredit({ error: 'Không đủ credit. Cần 2 credit để tạo ảnh AI.', code: 'INSUFFICIENT_CREDITS' }), true)
  assert.equal(isWeddingInsufficientCredit({ error: 'Tạo khung thất bại, credit chưa bị trừ: Không đủ credit để hoàn tất.' }), true)
  assert.equal(isWeddingInsufficientCredit({ error: 'Không đủ credit. Mỗi lần Tối ưu AI tốn 0,1 credit.' }), true)
  assert.equal(isWeddingInsufficientCredit({ error: 'AI không trả về ảnh hợp lệ.' }), false)
  assert.equal(isWeddingInsufficientCredit(null), false)
})
