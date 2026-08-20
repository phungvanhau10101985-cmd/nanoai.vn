import assert from 'node:assert/strict'
import test from 'node:test'
import {
  htmlLooksLikePartnerCommerceShell,
  htmlLooksLikePartnerTextArticle,
  isPartnerTextArticlePage,
  isPartnerTextArticlePageKey,
  resolvePartnerTextArticleKind,
  stampPartnerTextArticleMarkersInHtml,
} from '@/lib/partner-website/pages/partner-text-article-page'

test('pageKey shipping/returns/faq are text articles; sale/home are not', () => {
  assert.equal(isPartnerTextArticlePageKey('shipping'), true)
  assert.equal(isPartnerTextArticlePageKey('returns'), true)
  assert.equal(isPartnerTextArticlePageKey('faq'), true)
  assert.equal(isPartnerTextArticlePageKey('about'), true)
  assert.equal(isPartnerTextArticlePageKey('sale'), false)
  assert.equal(isPartnerTextArticlePageKey('lookbook'), false)
  assert.equal(isPartnerTextArticlePageKey('home'), false)
  assert.equal(isPartnerTextArticlePage({ pageKey: 'returns' }), true)
  assert.equal(isPartnerTextArticlePage({ pageKey: 'sale' }), false)
  assert.equal(isPartnerTextArticlePage({ pageKey: 'home' }), false)
})

test('custom cms slug is text article unless commerce shell without article markers', () => {
  assert.equal(isPartnerTextArticlePage({ cmsSlug: 'huong-dan-mua' }), true)
  assert.equal(
    isPartnerTextArticlePage({
      cmsSlug: 'huong-dan-mua',
      html: '<body data-pw-page="home"><div data-pw-catalog class="pw-product-grid"></div></body>',
    }),
    false
  )
})

test('html markers identify text article without pageKey', () => {
  const shippingHtml = `<!DOCTYPE html><html><body data-pw-page="info" data-pw-text-article="1">
<article data-pw-region="content" data-pw-info-article="1"><h1 data-pw-info-title="1">Đổi trả</h1>
<div data-pw-info-body="1"><p>Giữ hóa đơn.</p></div></article></body></html>`
  assert.equal(htmlLooksLikePartnerTextArticle(shippingHtml), true)
  assert.equal(isPartnerTextArticlePage({ html: shippingHtml }), true)
  assert.equal(htmlLooksLikePartnerCommerceShell('<body data-pw-page="home" data-pw-catalog>'), true)
})

test('stamp adds stable recognition attrs for returns', () => {
  const raw = `<!DOCTYPE html><html><body data-pw-page="info">
<article data-pw-region="content"><h1>Đổi trả</h1><p>Nội dung</p></article></body></html>`
  const stamped = stampPartnerTextArticleMarkersInHtml(raw, { pageKey: 'returns' })
  assert.match(stamped, /data-pw-text-article="1"/)
  assert.match(stamped, /data-pw-article-kind="policy"/)
  assert.equal(resolvePartnerTextArticleKind({ pageKey: 'returns' }), 'policy')
  assert.equal(resolvePartnerTextArticleKind({ pageKey: 'blog' }), 'blog')
  assert.equal(resolvePartnerTextArticleKind({ cmsSlug: 'huong-dan' }), 'cms')
})
