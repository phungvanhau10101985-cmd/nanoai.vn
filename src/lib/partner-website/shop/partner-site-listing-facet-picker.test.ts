import assert from 'node:assert/strict'
import test from 'node:test'
import {
  PW_LISTING_FACET_MODAL_ATTR,
  PW_LISTING_FACET_PICKER_CLOSE_SVG,
  PW_LISTING_FACET_PICKER_CSS,
} from '@/lib/partner-website/shop/partner-site-listing-facet-picker'

test('listing facet picker CSS has close control and does not use native-only select', () => {
  assert.equal(PW_LISTING_FACET_MODAL_ATTR, 'data-pw-listing-facet-modal')
  assert.match(PW_LISTING_FACET_PICKER_CSS, /data-pw-listing-facet-modal-close/)
  assert.match(PW_LISTING_FACET_PICKER_CSS, /data-pw-listing-facet-modal-backdrop/)
  assert.match(PW_LISTING_FACET_PICKER_CLOSE_SVG, /M6 18L18 6/)
})
