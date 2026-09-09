import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { mergeAllPlatformsBlockedOrError } from './evaluate'
import {
  classifyCssbuyAddToCartCta,
  coerceUrlForSourceStock,
  cssbuyHtmlShowsAddToCartButton,
  cssbuyHtmlSuggestsSecurityBlock,
  linkEligibleForSourceStockCheck,
  pandamallHtmlShowsCartOrBuyCta,
  pandamallHtmlSuggestsBlocked,
  resultIsConclusiveStock,
  resultShouldFallbackNextPlatform,
  vipomallHtmlShowsAddToCartCta,
  vipomallHtmlSuggestsBlocked,
} from './source-stock-urls'

describe('source stock urls + merge', () => {
  it('maps 1688 offer URL to CSSBuy item-1688', () => {
    const out = coerceUrlForSourceStock('https://detail.1688.com/offer/945111.html', 'cssbuy')
    assert.equal(out.error, null)
    assert.equal(out.url, 'https://www.cssbuy.com/item-1688-945111.html')
  })

  it('maps Taobao item id to CSSBuy item page', () => {
    const out = coerceUrlForSourceStock('https://item.taobao.com/item.htm?id=1234567890', 'cssbuy')
    assert.equal(out.error, null)
    assert.equal(out.url, 'https://www.cssbuy.com/item-1234567890.html')
  })

  it('maps 1688 offer to Vipomall platform 10 and PandaMall 1688', () => {
    const vm = coerceUrlForSourceStock('https://detail.1688.com/offer/945111.html', 'vipomall')
    const pd = coerceUrlForSourceStock('https://detail.1688.com/offer/945111.html', 'pandamall')
    assert.equal(vm.error, null)
    assert.equal(vm.url, 'https://vipomall.vn/san-pham/945111?platform_type=10')
    assert.equal(pd.error, null)
    assert.equal(pd.url, 'https://pandamall.vn/1688/detail/945111')
  })

  it('treats 1688/taobao/cssbuy/vipomall/pandamall as eligible', () => {
    assert.equal(linkEligibleForSourceStockCheck('https://detail.1688.com/offer/1.html'), true)
    assert.equal(linkEligibleForSourceStockCheck('https://item.taobao.com/item.htm?id=1'), true)
    assert.equal(linkEligibleForSourceStockCheck('https://www.cssbuy.com/item-1688-1.html'), true)
    assert.equal(linkEligibleForSourceStockCheck('https://vipomall.vn/san-pham/1'), true)
    assert.equal(linkEligibleForSourceStockCheck('https://pandamall.vn/1688/detail/1'), true)
    assert.equal(linkEligibleForSourceStockCheck('https://example.com/x'), false)
    assert.equal(linkEligibleForSourceStockCheck('short'), false)
  })

  it('classifies CSSBuy cart CTA as in_stock even conceptually disabled', () => {
    assert.equal(classifyCssbuyAddToCartCta(true), 'in_stock')
    assert.equal(classifyCssbuyAddToCartCta(true, true), 'in_stock')
    assert.equal(classifyCssbuyAddToCartCta(false), 'out_of_stock')
    assert.equal(cssbuyHtmlShowsAddToCartButton('<p class="button">Add to Cart</p>'), true)
    assert.equal(cssbuyHtmlShowsAddToCartButton('<div class="ty_button_btn6">Add to Cart</div>'), true)
    assert.equal(cssbuyHtmlShowsAddToCartButton('<html></html>'), false)
  })

  it('detects Vipomall/PandaMall cart/buy HTML and CF blocks', () => {
    assert.equal(vipomallHtmlShowsAddToCartCta('<button class="add-cart">Thêm giỏ hàng</button>'), true)
    assert.equal(vipomallHtmlShowsAddToCartCta('<html></html>'), false)
    assert.equal(pandamallHtmlShowsCartOrBuyCta('<a class="btn-addcart">Thêm vào giỏ</a>'), true)
    assert.equal(pandamallHtmlShowsCartOrBuyCta('<div>empty</div>'), false)
    assert.equal(cssbuyHtmlSuggestsSecurityBlock('<html>Just a moment</html>', 'Just a moment'), true)
    assert.equal(cssbuyHtmlSuggestsSecurityBlock('<button>Add to cart</button>', 'Goods'), false)
    assert.equal(vipomallHtmlSuggestsBlocked('Just a moment / cf-browser-verification'), true)
    assert.equal(pandamallHtmlSuggestsBlocked('', 'Just a moment'), true)
  })

  it('merges all-blocked platforms to blocked', () => {
    const blocked = { status: 'blocked', error: 'cf', checked_via: 'cssbuy' as const }
    const out = mergeAllPlatformsBlockedOrError(
      { ...blocked, checked_via: 'cssbuy' },
      { ...blocked, checked_via: 'vipomall' },
      { ...blocked, checked_via: 'pandamall' }
    )
    assert.equal(out.status, 'blocked')
    assert.equal(out.checked_via, 'cssbuy+vipomall+pandamall')
  })

  it('falls through blocked/error and treats in_stock/out_of_stock as conclusive', () => {
    assert.equal(resultIsConclusiveStock('in_stock'), true)
    assert.equal(resultIsConclusiveStock('out_of_stock'), true)
    assert.equal(resultIsConclusiveStock('blocked'), false)
    assert.equal(resultShouldFallbackNextPlatform('blocked'), true)
    assert.equal(resultShouldFallbackNextPlatform('error'), true)
    assert.equal(resultShouldFallbackNextPlatform('in_stock'), false)
  })
})

describe('source stock qty after check', () => {
  it('zeros on OOS and restores 500 when back in stock at qty 0', async () => {
    const { nextStockQtyAfterSourceCheck } = await import('./source-stock-config')
    assert.equal(nextStockQtyAfterSourceCheck({ status: 'out_of_stock', stockQty: 12 }), 0)
    assert.equal(nextStockQtyAfterSourceCheck({ status: 'in_stock', stockQty: 0 }), 500)
    assert.equal(nextStockQtyAfterSourceCheck({ status: 'in_stock', stockQty: 40 }), 40)
    assert.equal(nextStockQtyAfterSourceCheck({ status: 'blocked', stockQty: 0 }), 0)
  })
})
