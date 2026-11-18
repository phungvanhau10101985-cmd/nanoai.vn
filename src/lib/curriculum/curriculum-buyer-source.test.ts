import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  curriculumBuyerSourceForStorage,
  curriculumBuyerSourceView,
  parseCurriculumBuyerSourceField,
  recordedCurriculumBuyerSource,
} from './curriculum-buyer-source'

describe('recordedCurriculumBuyerSource', () => {
  it('keeps the ad channel stored in the browser, including the campaign', () => {
    assert.deepEqual(
      recordedCurriculumBuyerSource(
        JSON.stringify({
          search: '?fbclid=IwAR&utm_source=facebook&utm_medium=cpc&utm_campaign=gv',
          referrer: 'https://l.facebook.com/l.php',
          pageHost: 'nanoai.vn',
        }),
        'https://nanoai.vn/tao-giao-trinh',
      ),
      { source: 'facebook', detail: 'facebook · cpc · gv' },
    )
  })

  it('does not invent a channel when the browser sent nothing and the page has no query', () => {
    assert.deepEqual(recordedCurriculumBuyerSource(null, 'https://nanoai.vn/tao-giao-trinh'), {
      source: '',
      detail: '',
    })
  })

  it('reads an ad click that is still on the page address', () => {
    assert.deepEqual(
      recordedCurriculumBuyerSource(null, 'https://nanoai.vn/tao-giao-trinh?gclid=1&utm_source=google&utm_medium=cpc'),
      { source: 'google_ads', detail: 'google · cpc' },
    )
  })
})

describe('curriculumBuyerSourceForStorage', () => {
  it('drops an unknown channel and clips the detail', () => {
    assert.deepEqual(curriculumBuyerSourceForStorage({ source: 'nope', detail: 'x' }), { source: '', detail: '' })
    assert.deepEqual(curriculumBuyerSourceForStorage(null), { source: '', detail: '' })
    assert.equal(curriculumBuyerSourceForStorage({ source: 'other', detail: `${'z'.repeat(200)}` }).detail.length, 160)
  })
})

describe('parseCurriculumBuyerSourceField', () => {
  it('reads the form field and ignores a broken value', () => {
    assert.deepEqual(parseCurriculumBuyerSourceField('{"search":"?ttclid=1","referrer":"","pageHost":"nanoai.vn"}'), {
      search: '?ttclid=1',
      referrer: '',
      pageHost: 'nanoai.vn',
    })
    assert.equal(parseCurriculumBuyerSourceField('not-json'), null)
    assert.equal(parseCurriculumBuyerSourceField(''), null)
  })
})

describe('curriculumBuyerSourceView', () => {
  it('uses the same labels as invitation stats', () => {
    assert.deepEqual(curriculumBuyerSourceView('other', 'google.com'), { kind: 'other', text: 'Google', extra: '' })
    assert.deepEqual(curriculumBuyerSourceView('', ''), { kind: 'unknown', text: '', extra: '' })
  })
})
