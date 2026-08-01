import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildSemanticLandingPageHtml,
  isCompleteLandingHtml,
  landingHtmlOrGenerate,
  parseLandingSectionCopy,
  resolveLandingTheme,
} from '@/lib/hub-chat/landing-page-html-builder'
import type { HubStudioSession } from '@/lib/hub-chat/hub-studio-types'

function minimalLandingSession(overrides: Partial<HubStudioSession> = {}): HubStudioSession {
  return {
    presetId: 'landing_page',
    currentStepKey: 'landing_full',
    discoveryComplete: true,
    briefNotes: {
      brand_name: 'Glow Lab',
      value_prop: 'Skincare that glows',
      target_audience: 'Women 25–40',
      color_palette: '#1e3a5f · #f97316',
      landing_full: 'Headline: Glow Lab · Sub: Premium skincare · CTA: Shop now · Fast delivery · Clean ingredients',
    },
    processSteps: [],
    referenceImages: [],
    landingPage: {},
    ...overrides,
  } as HubStudioSession
}

test('parseLandingSectionCopy extracts headline, sub, cta and bullets', () => {
  const parsed = parseLandingSectionCopy(
    'Headline: Glow Lab · Sub: Premium skincare · CTA: Shop now · Fast delivery · Clean ingredients'
  )
  assert.equal(parsed.headline, 'Glow Lab')
  assert.equal(parsed.subheadline, 'Premium skincare')
  assert.equal(parsed.cta, 'Shop now')
  assert.ok(parsed.bullets.includes('Fast delivery'))
  assert.ok(parsed.bullets.includes('Clean ingredients'))
})

test('resolveLandingTheme reads hex palette from brief', () => {
  const theme = resolveLandingTheme({ color_palette: 'Primary #112233 and accent #aabbcc' })
  assert.equal(theme.primary, '#112233')
  assert.equal(theme.accent, '#aabbcc')
})

test('buildSemanticLandingPageHtml produces complete semantic document', () => {
  const html = buildSemanticLandingPageHtml({
    session: minimalLandingSession(),
    locale: 'en',
    sections: [
      { key: 'landing_full', label: 'Full landing', url: 'https://example.com/full.png' },
    ],
  })
  assert.ok(isCompleteLandingHtml(html))
  assert.match(html, /<!DOCTYPE html>/)
  assert.match(html, /<html lang="en">/)
  assert.match(html, /<h1>Glow Lab<\/h1>/)
  assert.match(html, /id="mockup"/)
  assert.match(html, /https:\/\/example\.com\/full\.png/)
})

test('isCompleteLandingHtml accepts doctype and html root', () => {
  assert.equal(isCompleteLandingHtml('<!DOCTYPE html><html></html>'), true)
  assert.equal(isCompleteLandingHtml('<html><body></body></html>'), true)
  assert.equal(isCompleteLandingHtml('<div>fragment</div>'), false)
})

test('landingHtmlOrGenerate prefers saved html over generation', () => {
  const session = minimalLandingSession()
  const saved = '<!DOCTYPE html><html><body>Saved</body></html>'
  const out = landingHtmlOrGenerate({ session, locale: 'vi', htmlSource: saved })
  assert.equal(out, saved)
})

test('landingHtmlOrGenerate builds when saved html invalid', () => {
  const session = minimalLandingSession()
  const out = landingHtmlOrGenerate({ session, locale: 'vi', htmlSource: '<div>partial</div>' })
  assert.ok(isCompleteLandingHtml(out))
  assert.match(out, /Glow Lab/)
})
