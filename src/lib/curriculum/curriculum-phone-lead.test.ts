import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { getFeatureSeo } from '@/lib/feature-seo'
import { parseCurriculumMobileLead, curriculumMobileZaloHref } from './curriculum-mobile-lead'
import { isCurriculumPhoneLeadUserAgent } from './curriculum-phone-lead-ua'

const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
const ANDROID =
  'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36'
const FACEBOOK =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/470.0.0.0;FBDV/iPhone15,2]'
const DESKTOP =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
const IPAD =
  'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'

describe('curriculum phone lead', () => {
  it('opens the lead page on a phone and in the Facebook app', () => {
    assert.equal(isCurriculumPhoneLeadUserAgent(IPHONE), true)
    assert.equal(isCurriculumPhoneLeadUserAgent(ANDROID), true)
    assert.equal(isCurriculumPhoneLeadUserAgent(FACEBOOK), true)
    assert.equal(isCurriculumPhoneLeadUserAgent(DESKTOP), false)
    assert.equal(isCurriculumPhoneLeadUserAgent(IPAD), false)
    assert.equal(isCurriculumPhoneLeadUserAgent(''), false)
  })

  it('accepts a Zalo phone or an email and rejects an empty form', () => {
    const phone = parseCurriculumMobileLead({
      name: 'Nguyễn Văn A',
      contact: '0912 345 678',
      subject: 'Toán lớp 8',
    })
    assert.equal(phone.ok, true)
    if (phone.ok && !('ignored' in phone)) {
      assert.equal(phone.lead.contactKey, '0912345678')
      assert.equal(phone.lead.contactKind, 'phone')
    }
    const email = parseCurriculumMobileLead({
      name: 'Lan',
      contact: 'Lan@School.edu.vn',
      subject: 'Hóa 11',
    })
    assert.equal(email.ok, true)
    if (email.ok && !('ignored' in email)) assert.equal(email.lead.contact, 'lan@school.edu.vn')
    assert.deepEqual(parseCurriculumMobileLead({ name: 'A', contact: '123', subject: 'Toán' }), { ok: false })
    assert.deepEqual(
      parseCurriculumMobileLead({ name: 'An', contact: '0912345678', subject: 'Toán', company_website: 'spam' }),
      { ok: true, ignored: true }
    )
  })

  it('keeps the Zalo button on the form until an OA link is set', () => {
    assert.equal(curriculumMobileZaloHref(''), '#dang-ky')
    assert.equal(curriculumMobileZaloHref('https://zalo.me/123'), 'https://zalo.me/123')
    assert.equal(curriculumMobileZaloHref('https://evil.example/zalo'), '#dang-ky')
  })

  it('states two free curricula a day on the public page', () => {
    const seo = getFeatureSeo('tao-giao-trinh')
    assert.match(seo.pageDescription, /Hai bài mới mỗi ngày/)
    assert.doesNotMatch(seo.pageDescription, /Ba bài/)
    const credit = seo.faqs.find((item) => item.question === 'Khi nào trừ credit?')
    assert.match(credit?.answer ?? '', /Hai bài/)
    assert.match(credit?.answer ?? '', /Bài thứ ba/)
  })
})
