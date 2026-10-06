import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { nextSharedRatingGroupId } from '@/lib/partner-website/category/partner-category-rating-group'

describe('nextSharedRatingGroupId', () => {
  it('bắt đầu từ 101 khi chưa có nhóm', () => {
    assert.equal(nextSharedRatingGroupId([]), 101)
    assert.equal(nextSharedRatingGroupId([0, 88, 99, 100, 888, 1000]), 101)
  })

  it('lấy số lớn hơn mọi mã đã dùng, không lấp lỗ dưới 101', () => {
    assert.equal(nextSharedRatingGroupId([1, 2, 95, 102]), 103)
  })

  it('né 888 và 1000', () => {
    assert.equal(nextSharedRatingGroupId([887]), 889)
    assert.equal(nextSharedRatingGroupId([999]), 1001)
  })
})
