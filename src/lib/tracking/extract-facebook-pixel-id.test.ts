import assert from 'node:assert/strict'
import test from 'node:test'
import { extractFacebookPixelId } from '@/lib/tracking/extract-facebook-pixel-id'

test('extractFacebookPixelId keeps a numeric pixel id', () => {
  assert.equal(extractFacebookPixelId('123456789012345'), '123456789012345')
})

test('extractFacebookPixelId reads fbq init and noscript id', () => {
  assert.equal(
    extractFacebookPixelId(`fbq('init', '998877665544332');`),
    '998877665544332'
  )
  assert.equal(
    extractFacebookPixelId('https://www.facebook.com/tr?id=112233445566778&ev=PageView'),
    '112233445566778'
  )
})

test('extractFacebookPixelId rejects short or empty input', () => {
  assert.equal(extractFacebookPixelId(''), null)
  assert.equal(extractFacebookPixelId('   '), null)
  assert.equal(extractFacebookPixelId('12345'), null)
})
