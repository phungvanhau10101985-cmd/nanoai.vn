import assert from 'node:assert/strict'
import test from 'node:test'
import { chromium } from 'playwright'
import { PARTNER_SHOP_LISTING_HEAD_SCRIPT, PW_LISTING_HEAD_CSS } from '@/lib/partner-website/shop/listing-head'

test('listing filter slot waits for visual-ready then sticks under the compact head', async () => {
  const html = `<!DOCTYPE html><html><head><style>
${PW_LISTING_HEAD_CSS}
[data-pw-live-chrome]{position:sticky;top:0;z-index:500;background:#fff}
body{margin:0;height:2400px}
</style></head><body>
<div data-pw-live-chrome="1"><div data-pw-live-chrome-scale="1">
<header class="pw-header" data-pw-region="header" style="height:54px">search</header>
</div></div>
<div data-pw-inline-visual-root="1" data-pw-page="listing" data-pw-listing-category="1">
<div class="pw-page-filters" data-pw-region="filters" style="height:40px">filters</div>
<section data-pw-catalog data-category-id="abc"><div data-pw-grid style="height:800px">cards</div></section>
</div>
<script>${PARTNER_SHOP_LISTING_HEAD_SCRIPT}</script>
</body></html>`
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 700 } })
    await page.setContent(html)
    const before = await page.evaluate(() => {
      const bar = document.querySelector('[data-pw-region="filters"]')
      const slot = document.querySelector('[data-pw-listing-filter-slot]')
      return {
        slotInChrome: !!(slot && slot.closest('[data-pw-live-chrome]')),
        barInRoot: !!(bar && bar.closest('[data-pw-inline-visual-root]')),
        gridVisibility: getComputedStyle(document.querySelector('[data-pw-grid]')!).visibility,
      }
    })
    assert.equal(before.barInRoot, true)
    assert.equal(before.slotInChrome, false)
    assert.equal(before.gridVisibility, 'hidden')
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-pw-visual-ready', '1')
      document.dispatchEvent(new Event('pw-shop-visual-ready'))
    })
    await page.evaluate(() => window.scrollTo(0, 600))
    const after = await page.evaluate(() => {
      const bar = document.querySelector('[data-pw-region="filters"]')!
      const header = document.querySelector('header')!
      const br = bar.getBoundingClientRect()
      const hr = header.getBoundingClientRect()
      return {
        slotInChrome: !!bar.closest('[data-pw-live-chrome]'),
        barInRoot: !!bar.closest('[data-pw-inline-visual-root]'),
        headerTop: Math.round(hr.top),
        headerBottom: Math.round(hr.bottom),
        barTop: Math.round(br.top),
      }
    })
    assert.equal(after.slotInChrome, true)
    assert.equal(after.barInRoot, false)
    assert.equal(after.headerTop, 0)
    assert.equal(after.barTop, after.headerBottom)
  } finally {
    await browser.close()
  }
})
