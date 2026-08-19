import assert from 'node:assert/strict'
import test from 'node:test'
import { extractPathSlugFromLoginNext } from '../auth/signup-source'
import {
  buildPartnerStaffInviteAdminUrl,
  buildPartnerStaffInviteEmailContent,
  partnerStaffAdminPath,
} from './partner-staff-invite-email'

test('partnerStaffAdminPath points to shop admin with partner id', () => {
  assert.equal(
    partnerStaffAdminPath('11111111-1111-4111-8111-111111111111'),
    '/dashboard/messaging/settings?partner=11111111-1111-4111-8111-111111111111'
  )
})

test('partnerStaffAdminPath uses hospitality settings for hotel workspaces', () => {
  assert.equal(
    partnerStaffAdminPath('11111111-1111-4111-8111-111111111111', 'hotel'),
    '/dashboard/hospitality/settings?partner=11111111-1111-4111-8111-111111111111'
  )
})

test('buildPartnerStaffInviteAdminUrl is an absolute shop admin link', () => {
  const url = buildPartnerStaffInviteAdminUrl({
    origin: 'https://nanoai.vn/',
    partnerId: '11111111-1111-4111-8111-111111111111',
  })
  assert.equal(
    url,
    'https://nanoai.vn/dashboard/messaging/settings?partner=11111111-1111-4111-8111-111111111111'
  )
})

test('invite email includes shop admin CTA and escapes HTML', () => {
  const mail = buildPartnerStaffInviteEmailContent({
    locale: 'vi',
    shopName: '188.com.vn <fashion>',
    inviterEmail: 'owner@example.com',
    adminUrl: 'https://nanoai.vn/dashboard/messaging/settings?partner=abc',
  })
  assert.match(mail.subject, /188\.com\.vn/)
  assert.match(mail.text, /Vào trang quản trị shop/)
  assert.match(mail.text, /https:\/\/nanoai\.vn\/dashboard\/messaging\/settings\?partner=abc/)
  assert.match(mail.html, /href="https:\/\/nanoai\.vn\/dashboard\/messaging\/settings\?partner=abc"/)
  assert.match(mail.html, /188\.com\.vn &lt;fashion&gt;/)
  assert.doesNotMatch(mail.html, /188\.com\.vn <fashion>/)
})

test('Google return from shop account page resolves site slug', () => {
  const parsed = extractPathSlugFromLoginNext('/site/188-com-vn-u560/account')
  assert.deepEqual(parsed, { kind: 'site', slug: '188-com-vn-u560' })
})

test('invite email has translations for all web locales', () => {
  for (const locale of ['vi', 'en', 'zh', 'ja', 'ko'] as const) {
    const mail = buildPartnerStaffInviteEmailContent({
      locale,
      shopName: 'Demo Shop',
      inviterEmail: 'owner@example.com',
      adminUrl: 'https://example.com/admin',
    })
    assert.ok(mail.subject.includes('Demo Shop'), locale)
    assert.ok(mail.html.includes('https://example.com/admin'), locale)
    assert.ok(mail.title.includes('Demo Shop'), locale)
  }
})
