import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { parseCookieText } from '@/lib/messaging/listing-import/listing-import-cookies'
import { listingImportColorNeedsTranslate } from '@/lib/messaging/listing-import/listing-import-color-translate'
import {
  inferQuestionGroupIdFromProductName,
  inferRatingGroupIdFromText,
  applyListingImportRatingGroups,
  RATING_GROUP_ID_UNASSIGNED,
} from '@/lib/messaging/listing-import/listing-import-rating-groups'

describe('listing import cookies', () => {
  it('parses Cookie-Editor JSON list', () => {
    const cookies = parseCookieText(
      JSON.stringify([
        { name: 'session', value: 'abc', domain: '.vipomall.vn', path: '/', sameSite: 'Lax' },
      ])
    )
    assert.equal(cookies.length, 1)
    assert.equal(cookies[0].name, 'session')
    assert.equal(cookies[0].domain, '.vipomall.vn')
    assert.equal(cookies[0].sameSite, 'Lax')
  })
})

describe('listing import rating groups', () => {
  it('maps túi xách nữ and áo thun nam', () => {
    assert.equal(inferRatingGroupIdFromText('túi xách nữ da bò'), 69)
    assert.equal(inferRatingGroupIdFromText('áo thun nam cotton'), 51)
  })
  it('maps question group from product name', () => {
    assert.equal(inferQuestionGroupIdFromProductName('Áo thun nam nữ'), 99)
    assert.equal(inferQuestionGroupIdFromProductName('Áo thun nam'), 100)
    assert.equal(inferQuestionGroupIdFromProductName('Váy đầm nữ'), 88)
  })
  it('assigns 888 when no keyword match', () => {
    const pd: Record<string, unknown> = { name: 'Widget lạ xyz' }
    const warnings: string[] = []
    applyListingImportRatingGroups(pd, warnings)
    assert.equal(pd.group_rating, RATING_GROUP_ID_UNASSIGNED)
    assert.equal(pd.group_question, 99)
  })
})

describe('listing import color translate', () => {
  it('detects CJK and English fashion colors', () => {
    assert.equal(listingImportColorNeedsTranslate('黑色'), true)
    assert.equal(listingImportColorNeedsTranslate('Black Suede'), true)
    assert.equal(listingImportColorNeedsTranslate('Đen nhám'), false)
    assert.equal(listingImportColorNeedsTranslate('XL'), false)
  })
})
