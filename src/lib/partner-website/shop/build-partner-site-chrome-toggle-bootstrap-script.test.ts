import assert from 'node:assert/strict'
import test from 'node:test'
import { buildPartnerSiteChromeToggleBootstrapScript } from './build-partner-site-chrome-toggle-bootstrap-script'

test('live category wrapper owns canonical placement instead of offsetting its child', () => {
  const html = buildPartnerSiteChromeToggleBootstrapScript({
    siteSlug: 'coordinate-parity',
    locale: 'vi',
  })

  assert.match(html, /var props=\['position','inset','left','top','right','bottom','z-index'\]/)
  assert.match(
    html,
    /var attrs=\['data-pw-placement','data-pw-coordinate-root','data-pw-box-x','data-pw-box-y','data-pw-box-w','data-pw-box-h'\]/
  )
  assert.match(html, /to\.setAttribute\(a,value\)/)
  assert.match(html, /from\.removeAttribute\(a\)/)
})
