import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  formatBannerOnImageCopyForGeneration,
  parseBannerOnImageCopy,
  stripBannerCopyQuotes,
} from '@/lib/hub-chat/banner-on-image-copy'

test('parseBannerOnImageCopy strips HEADLINE SUBHEAD labels', () => {
  const parsed = parseBannerOnImageCopy(`HEADLINE: Thời Trang Nam Cao Cấp
SUBHEAD: Khám phá bộ sưu tập mới
CTA: Xem ngay
DOMAIN: 188.com.vn`)
  assert.equal(parsed.headline, 'Thời Trang Nam Cao Cấp')
  assert.equal(parsed.subhead, 'Khám phá bộ sưu tập mới')
  assert.equal(parsed.cta, 'Xem ngay')
  assert.equal(parsed.domain, '188.com.vn')
})

test('parseBannerOnImageCopy strips decorative quotes from values', () => {
  const parsed = parseBannerOnImageCopy(`HEADLINE: "Thời Trang Nam Đẳng Cấp"
CTA: "Khám phá ngay"`)
  assert.equal(parsed.headline, 'Thời Trang Nam Đẳng Cấp')
  assert.equal(parsed.cta, 'Khám phá ngay')
})

test('stripBannerCopyQuotes removes curly quotes', () => {
  assert.equal(stripBannerCopyQuotes('"Hello"'), 'Hello')
  assert.equal(stripBannerCopyQuotes('“Hello”'), 'Hello')
})

test('formatBannerOnImageCopyForGeneration omits domain when logo attached', () => {
  const parsed = parseBannerOnImageCopy('HEADLINE: Sale\nDOMAIN: 188.com.vn')
  const out = formatBannerOnImageCopyForGeneration(parsed, { omitDomain: true })
  assert.match(out, /Headline \(large, bold\): Sale/)
  assert.doesNotMatch(out, /188\.com\.vn/)
  assert.match(out, /logo image is attached/)
})
