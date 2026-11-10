import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { languageLandingCopy } from './hoc-ngoai-ngu/landing-copy'
import { japaneseLandingCopy } from './hoc-ngoai-ngu/japanese-landing-copy'
import { koreanLandingCopy } from './hoc-ngoai-ngu/korean-landing-copy'
import { chineseLandingCopy } from './hoc-ngoai-ngu/chinese-landing-copy'
import { vietnameseLandingCopy } from './hoc-ngoai-ngu/vietnamese-landing-copy'
import {
  FREE_LIVE_LESSON_LIMIT,
  freeLiveChoiceLabel,
  nextLiveStartKind,
} from './english-coach-free-lessons'
import { getFeatureSeo } from './feature-seo'

describe('free live lessons', () => {
  it('gives the first two live starts away and charges the third', () => {
    assert.equal(FREE_LIVE_LESSON_LIMIT, 2)
    assert.equal(nextLiveStartKind({ alreadyStarted: false, freeUsed: 0 }), 'free')
    assert.equal(nextLiveStartKind({ alreadyStarted: false, freeUsed: 1 }), 'free')
    assert.equal(nextLiveStartKind({ alreadyStarted: false, freeUsed: 2 }), 'paid')
    assert.equal(nextLiveStartKind({ alreadyStarted: true, freeUsed: 0 }), 'already')
  })

  it('names the free offer in the room and on every language landing', () => {
    assert.match(freeLiveChoiceLabel('vi', 2, false), /Miễn phí, còn 2 buổi/)
    assert.match(freeLiveChoiceLabel('en', 1, false), /Free, 1 left/)
    assert.match(freeLiveChoiceLabel('zh', 2, true), /登录/)
    assert.match(freeLiveChoiceLabel('ja', 0, false, 3.5), /3\.5/)
    assert.match(freeLiveChoiceLabel('ko', 2, false), /무료/)

    const pages = [
      languageLandingCopy('vi', '3,5 credit · 21.000đ', '2 credit · 12.000đ'),
      languageLandingCopy('en', '3.5 credits · 21,000 VND', '2 credits · 12,000 VND'),
      languageLandingCopy('zh', '3.5 积分', '2 积分'),
      languageLandingCopy('ja', '3.5 クレジット', '2 クレジット'),
      languageLandingCopy('ko', '3.5 크레딧', '2 크레딧'),
      japaneseLandingCopy('vi', '3,5 credit · 21.000đ', '2 credit · 12.000đ'),
      koreanLandingCopy('ja', '3.5 クレジット', '2 クレジット'),
      chineseLandingCopy('zh', '3.5 积分', '2 积分'),
      vietnameseLandingCopy('ko', '3.5 크레딧', '2 크레딧'),
    ]
    for (const copy of pages) {
      assert.match(copy.lead, /2|两|두/)
      assert.equal(copy.modes.find((mode) => mode.id === 'live')?.price.includes('21'), false)
      assert.equal(copy.cta, copy.modes.find((mode) => mode.id === 'live')?.price)
      const priceFaq = copy.faqs.find((item) => /giá bao nhiêu|how much|多少钱|いくら|얼마/i.test(item.question))
      assert.match(priceFaq?.answer ?? '', /2|两|두/)
    }
    const vi = languageLandingCopy('vi', '3,5 credit · 21.000đ', '2 credit · 12.000đ')
    assert.equal(vi.cta, 'Học thử miễn phí 2 bài live')
    assert.match(vi.lead, /Học thử miễn phí 2 bài live/)
  })

  it('keeps the public price pages honest about the free lessons', () => {
    for (const key of ['hoc-tieng-anh-ai', 'hoc-tieng-viet', 'hoc-tieng-trung', 'hoc-tieng-nhat', 'hoc-tieng-han']) {
      const seo = getFeatureSeo(key)
      assert.match(seo.pageDescription, /miễn phí/i)
      assert.ok(seo.pageDescription.length <= 160, `${key} description ${seo.pageDescription.length}`)
      const priceFaq = seo.faqs.find((item) => item.question.includes('giá bao nhiêu'))
      assert.match(priceFaq?.answer ?? '', /Học thử miễn phí 2 bài live/)
      assert.match(seo.pageDescription, /Học thử miễn phí 2 bài live/)
    }
  })
})
