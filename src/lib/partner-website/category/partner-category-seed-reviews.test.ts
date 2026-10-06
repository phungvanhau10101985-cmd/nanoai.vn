import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  SEED_REVIEW_COUNT,
  buildSeedReviewDrafts,
  productNoun,
  reviewAudience,
  reviewerNameGender,
  spokenReviewNoun,
} from '@/lib/partner-website/category/partner-category-seed-reviews'

function word(text: string, token: string): boolean {
  const re = new RegExp(`(^|\\s)${token}([\\s,.]|$)`, 'i')
  return re.test(text)
}

describe('seed reviews for a new level-3 rating group', () => {
  it('writes 100 reviews that match a pet product and mix genders', () => {
    const drafts = buildSeedReviewDrafts({
      groupId: 101,
      cat1: 'Thú cưng',
      cat2: 'Vòng cổ',
      cat3: 'Vòng cổ chó da',
      shopName: 'Nano Shop',
    })
    assert.equal(drafts.length, SEED_REVIEW_COUNT)
    assert.equal(reviewAudience('Thú cưng', 'Vòng cổ', 'Vòng cổ chó da'), 'unisex')
    assert.equal(productNoun('Vòng cổ chó da'), 'Vòng cổ chó da')
    assert.equal(spokenReviewNoun('Vòng cổ chó da'), 'vòng cổ')
    const contents = new Set(drafts.map((d) => d.content))
    assert.equal(contents.size, SEED_REVIEW_COUNT)
    const stars = new Set(drafts.map((d) => d.rating))
    assert.deepEqual([...stars].sort(), [4, 5])
    let female = 0
    let male = 0
    for (const draft of drafts) {
      assert.equal(draft.importGroup, 101)
      assert.equal(draft.imageUrls.length, 0)
      assert.equal(draft.merchantReplyBy, 'Nano Shop')
      assert.match(draft.content.toLowerCase(), /vòng cổ/)
      assert.doesNotMatch(draft.content.toLowerCase(), /vòng cổ chó da/)
      assert.doesNotMatch(draft.content.toLowerCase(), /váy|giày/)
      const gender = reviewerNameGender(draft.reviewerName)
      if (gender === 'female') {
        female += 1
        assert.equal(word(draft.merchantReply, 'chị'), true)
        assert.equal(word(draft.merchantReply, 'anh'), false)
      } else {
        male += 1
        assert.equal(gender, 'male')
        assert.equal(word(draft.merchantReply, 'anh'), true)
        assert.equal(word(draft.merchantReply, 'chị'), false)
      }
    }
    assert.equal(female, 50)
    assert.equal(male, 50)
  })

  it('uses only female names for a women product and only male names for a men product', () => {
    const women = buildSeedReviewDrafts({
      groupId: 110,
      cat1: 'Giày dép Nữ',
      cat2: 'Sandal nữ',
      cat3: 'Dép quai ngang nữ',
      shopName: 'Shop',
    })
    assert.equal(reviewAudience('Giày dép Nữ', 'Sandal nữ', 'Dép quai ngang nữ'), 'female')
    assert.equal(productNoun('Dép quai ngang nữ'), 'Dép quai ngang')
    assert.equal(spokenReviewNoun('Dép quai ngang nữ'), 'dép')
    for (const draft of women) {
      assert.equal(reviewerNameGender(draft.reviewerName), 'female')
      assert.equal(word(draft.merchantReply, 'chị'), true)
      assert.equal(word(draft.merchantReply, 'anh'), false)
      assert.match(draft.content.toLowerCase(), /dép/)
      assert.doesNotMatch(draft.content.toLowerCase(), /quai ngang/)
    }

    const men = buildSeedReviewDrafts({
      groupId: 111,
      cat1: 'Giày dép Nam',
      cat2: 'Sneaker nam',
      cat3: 'Giày chạy bộ nam',
      shopName: 'Shop',
    })
    assert.equal(reviewAudience('Giày dép Nam', 'Sneaker nam', 'Giày chạy bộ nam'), 'male')
    for (const draft of men) {
      assert.equal(reviewerNameGender(draft.reviewerName), 'male')
      assert.equal(word(draft.merchantReply, 'anh'), true)
      assert.equal(word(draft.merchantReply, 'chị'), false)
      assert.match(draft.content.toLowerCase(), /giày/)
      assert.doesNotMatch(draft.content.toLowerCase(), /chạy bộ/)
    }
  })
})
