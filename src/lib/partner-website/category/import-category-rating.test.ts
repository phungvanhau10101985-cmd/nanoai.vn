import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { planImportCategoryRating } from '@/lib/partner-website/category/import-category-rating'
import { dedicatedRatingGroupId } from '@/lib/partner-website/category/partner-category-rating-group'

describe('dedicatedRatingGroupId', () => {
  it('bỏ mã trống và nhóm câu hỏi', () => {
    assert.equal(dedicatedRatingGroupId(0), 0)
    assert.equal(dedicatedRatingGroupId(888), 0)
    assert.equal(dedicatedRatingGroupId(1000), 0)
    assert.equal(dedicatedRatingGroupId(88), 0)
    assert.equal(dedicatedRatingGroupId(102), 102)
  })
})

describe('planImportCategoryRating', () => {
  const empty = new Set<number>()

  it('sản phẩm nhận nhóm đã gắn trên danh mục cấp 3', () => {
    const plan = planImportCategoryRating({
      fileGroupId: 14,
      categoryId: 'c3',
      categoryRatingGroupId: 205,
      groupsWithReviews: empty,
      ownerCategoryId: 'c3',
    })
    assert.deepEqual(plan, { kind: 'adopt', groupId: 205 })
  })

  it('danh mục chưa có nhóm thì nhận mã riêng trong file và sẽ sinh đánh giá', () => {
    const plan = planImportCategoryRating({
      fileGroupId: 102,
      categoryId: 'c3',
      categoryRatingGroupId: null,
      groupsWithReviews: empty,
      ownerCategoryId: null,
    })
    assert.deepEqual(plan, { kind: 'assign', groupId: 102 })
  })

  it('mã đã có đánh giá là nhóm dùng chung, không gắn vào danh mục', () => {
    const plan = planImportCategoryRating({
      fileGroupId: 24,
      categoryId: 'c3',
      categoryRatingGroupId: null,
      groupsWithReviews: new Set([24]),
      ownerCategoryId: null,
    })
    assert.deepEqual(plan, { kind: 'unchanged' })
  })

  it('888 không gắn vào danh mục', () => {
    const plan = planImportCategoryRating({
      fileGroupId: 888,
      categoryId: 'c3',
      categoryRatingGroupId: null,
      groupsWithReviews: empty,
      ownerCategoryId: null,
    })
    assert.deepEqual(plan, { kind: 'unchanged' })
  })

  it('mã đã thuộc danh mục khác thì không cướp, chỉ sinh đánh giá cho chủ', () => {
    const plan = planImportCategoryRating({
      fileGroupId: 102,
      categoryId: 'c3',
      categoryRatingGroupId: null,
      groupsWithReviews: empty,
      ownerCategoryId: 'other',
    })
    assert.deepEqual(plan, { kind: 'seed-owner', groupId: 102, ownerCategoryId: 'other' })
  })
})
