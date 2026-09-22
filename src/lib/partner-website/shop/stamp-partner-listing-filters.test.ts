import assert from 'node:assert/strict'
import test from 'node:test'
import { stampPartnerListingFilterAttrsInHtml } from '@/lib/partner-website/shop/stamp-partner-listing-filters'

test('stamp listing filters adds data-pw-facet in size/style/color then min/max', () => {
  const html = `<html><body>
    <div data-pw-region="filters">
      <select><option value="">All sizes</option></select>
      <select><option value="">All styles</option></select>
      <select><option value="">All colors</option></select>
      <input type="number" />
      <input type="number" />
      <select data-pw-el="sort"><option value="random">Random</option></select>
    </div>
  </body></html>`
  const out = stampPartnerListingFilterAttrsInHtml(html)
  assert.match(out, /data-pw-facet="size"/)
  assert.match(out, /data-pw-facet="style"/)
  assert.match(out, /data-pw-facet="color"/)
  assert.match(out, /data-pw-facet="min_price"/)
  assert.match(out, /data-pw-facet="max_price"/)
  assert.match(out, /data-pw-el="sort"/)
})

test('stamp listing filters keeps existing data-pw-facet', () => {
  const html = `<div data-pw-region="filters"><select data-pw-facet="color"></select></div>`
  const out = stampPartnerListingFilterAttrsInHtml(html)
  assert.equal((out.match(/data-pw-facet="color"/g) || []).length, 1)
})
