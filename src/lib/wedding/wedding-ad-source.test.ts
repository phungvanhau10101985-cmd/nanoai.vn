import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { classifyWeddingAdSource, isWeddingTrafficBotUserAgent, weddingAdVisitShouldIgnore } from './wedding-ad-source'

describe('classifyWeddingAdSource', () => {
  it('reads Facebook, Instagram, and TikTok click ids and referrers', () => {
    assert.equal(classifyWeddingAdSource('?fbclid=IwAR123', ''), 'facebook')
    assert.equal(classifyWeddingAdSource('utm_source=Facebook', ''), 'facebook')
    assert.equal(classifyWeddingAdSource('', 'https://l.facebook.com/l.php'), 'facebook')
    assert.equal(classifyWeddingAdSource('', 'https://www.instagram.com/reel/abc'), 'facebook')
    assert.equal(classifyWeddingAdSource('?ttclid=E.C.P.abc', ''), 'tiktok')
    assert.equal(classifyWeddingAdSource('utm_source=tiktok', ''), 'tiktok')
    assert.equal(classifyWeddingAdSource('', 'https://www.tiktok.com/@shop'), 'tiktok')
  })

  it('counts Google Ads click ids and paid utm, and skips organic Google', () => {
    assert.equal(classifyWeddingAdSource('?gclid=EAIa', ''), 'google_ads')
    assert.equal(classifyWeddingAdSource('?gbraid=1', ''), 'google_ads')
    assert.equal(classifyWeddingAdSource('?wbraid=1', ''), 'google_ads')
    assert.equal(classifyWeddingAdSource('?gad_source=1', ''), 'google_ads')
    assert.equal(classifyWeddingAdSource('?utm_source=google&utm_medium=cpc', ''), 'google_ads')
    assert.equal(classifyWeddingAdSource('?utm_source=googleads', ''), 'google_ads')
    assert.equal(classifyWeddingAdSource('?utm_source=google&utm_medium=organic', ''), null)
    assert.equal(classifyWeddingAdSource('', 'https://www.google.com/search?q=thiep'), null)
  })

  it('does not treat a lookalike host or another app as an ad source', () => {
    assert.equal(classifyWeddingAdSource('', 'https://notfacebook.com/'), null)
    assert.equal(classifyWeddingAdSource('', 'https://nottiktok.com/'), null)
    assert.equal(classifyWeddingAdSource('?utm_source=zalo', ''), null)
    assert.equal(classifyWeddingAdSource('', ''), null)
  })

  it('ignores editor and sample preview query strings', () => {
    assert.equal(weddingAdVisitShouldIgnore('?demo=1&fbclid=1'), true)
    assert.equal(weddingAdVisitShouldIgnore('?layout=full'), true)
    assert.equal(weddingAdVisitShouldIgnore('?look=mau-1'), true)
    assert.equal(weddingAdVisitShouldIgnore('?sheet=1'), true)
    assert.equal(weddingAdVisitShouldIgnore('?fbclid=1'), false)
  })

  it('flags crawler user agents', () => {
    assert.equal(isWeddingTrafficBotUserAgent(''), true)
    assert.equal(isWeddingTrafficBotUserAgent('facebookexternalhit/1.1'), true)
    assert.equal(
      isWeddingTrafficBotUserAgent(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
      ),
      false,
    )
  })
})
