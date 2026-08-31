import assert from 'node:assert/strict'
import test from 'node:test'
import {
  classifyPartnerImageSearchError,
  looksLikeHttpUrl,
  shouldRetryPartnerImageSearchTransient,
} from '@/lib/partner-website/shop/partner-site-image-search-errors'

test('looksLikeHttpUrl matches 188 paste-link guard', () => {
  assert.equal(looksLikeHttpUrl('https://cdn.example/a.jpg'), true)
  assert.equal(looksLikeHttpUrl('http://x.test/a.png'), true)
  assert.equal(looksLikeHttpUrl('ftp://x/a.jpg'), false)
  assert.equal(looksLikeHttpUrl('cdn.example/a.jpg'), false)
})

test('gemini INTERNAL errors retry like 188', () => {
  assert.equal(shouldRetryPartnerImageSearchTransient('Gemini embed failed (500): INTERNAL'), true)
  assert.equal(classifyPartnerImageSearchError('<!DOCTYPE html><html>'), 'html')
  assert.equal(classifyPartnerImageSearchError('Gemini embed failed'), 'gemini')
  assert.equal(classifyPartnerImageSearchError('no matches'), 'raw')
})
