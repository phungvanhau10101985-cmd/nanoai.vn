import assert from 'node:assert/strict'
import test from 'node:test'
import { PW_FEATURED_MARQUEE_JS } from '@/lib/partner-website/shop/featured-category-marquee-js'

test('featured marquee runtime matches 188 vertical loop', () => {
  assert.match(PW_FEATURED_MARQUEE_JS, /function ensureFeaturedMarquee/)
  assert.match(PW_FEATURED_MARQUEE_JS, /function pwEnsureFeaturedMarquees/)
  assert.match(PW_FEATURED_MARQUEE_JS, /data-pw-featured-clone/)
  assert.match(PW_FEATURED_MARQUEE_JS, /is-paused/)
  assert.match(PW_FEATURED_MARQUEE_JS, /\.pw-featured-cat\[data-pw-featured-categories="1"\]/)
  assert.match(PW_FEATURED_MARQUEE_JS, /el\.querySelectorAll\('\[data-pw-featured-clone\]'\)/)
  assert.match(PW_FEATURED_MARQUEE_JS, /function syncFeaturedMarqueeClone/)
  assert.match(PW_FEATURED_MARQUEE_JS, /forceSync/)
  assert.match(PW_FEATURED_MARQUEE_JS, /data-pw-featured-marquee-on/)
  assert.doesNotMatch(PW_FEATURED_MARQUEE_JS, /getAttribute\('data-pw-el'\)==='card-name'/)
  assert.doesNotMatch(PW_FEATURED_MARQUEE_JS, /touchstart/)
  assert.doesNotMatch(PW_FEATURED_MARQUEE_JS, /el\.classList\.add\('pw-featured-cat'\)/)
  assert.doesNotMatch(PW_FEATURED_MARQUEE_JS, /\$\{/)
})
