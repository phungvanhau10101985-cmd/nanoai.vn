import assert from 'node:assert/strict'
import test from 'node:test'
import { buildPartnerSiteCatalogBootstrapScript } from '@/lib/partner-website/shop/build-partner-site-catalog-bootstrap-script'

test('catalog bootstrap listing filters read URL, request facets, skip Sửa nhanh', () => {
  const s = buildPartnerSiteCatalogBootstrapScript({ siteSlug: 'demo-shop', locale: 'vi' })
  assert.match(s, /function listingParamsFromUrl/)
  assert.match(s, /style_tag/)
  assert.match(s, /facets=1/)
  assert.match(s, /history\.replaceState/)
  assert.match(s, /pwShopLiveUiOff\(\)/)
  assert.match(s, /data-pw-facet/)
  assert.match(s, /data-pw-filter-clear/)
  assert.match(s, /data-pw-listing-facet-modal/)
  assert.match(s, /data-pw-listing-facet-modal-close/)
  assert.match(s, /filterClose/)
  assert.match(s, /warehouse=1/)
  assert.match(s, /kho-sale/)
  assert.match(s, /if\(page==='home'\|\|page==='product'\|\|page==='cart'\|\|page==='account'\)return false/)
  assert.match(s, /pwShopTrack\('view_item_list'/)
  assert.match(s, /function catalogAlreadySeeded/)
  assert.match(s, /function refreshSeededCatalog/)
  assert.doesNotMatch(s, /price_asc/)
})
