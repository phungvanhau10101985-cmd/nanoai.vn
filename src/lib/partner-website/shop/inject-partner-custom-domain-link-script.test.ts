import assert from 'node:assert/strict'
import test from 'node:test'
import {
  injectPartnerCustomDomainLinkRewriteScript,
  rewritePartnerCustomDomainHtml,
  rewritePartnerCustomDomainPublicHref,
} from '@/lib/partner-website/shop/inject-partner-custom-domain-link-script'

const HOSTS = ['nanoai.vn', 'www.nanoai.vn']

test('custom domain href rewrite strips /site/{slug} and NanoAI origin', () => {
  assert.equal(rewritePartnerCustomDomainPublicHref('/site/shop-1/products', 'shop-1', HOSTS), '/products')
  assert.equal(rewritePartnerCustomDomainPublicHref('/site/shop-1', 'shop-1', HOSTS), '/')
  assert.equal(
    rewritePartnerCustomDomainPublicHref('https://nanoai.vn/site/shop-1/c/ao-nam', 'shop-1', HOSTS),
    '/c/ao-nam'
  )
  assert.equal(
    rewritePartnerCustomDomainPublicHref('https://www.nanoai.vn/products/abc?x=1#y', 'shop-1', HOSTS),
    '/products/abc?x=1#y'
  )
  assert.equal(rewritePartnerCustomDomainPublicHref('https://cdn.example/img.jpg', 'shop-1', HOSTS), 'https://cdn.example/img.jpg')
  assert.equal(rewritePartnerCustomDomainPublicHref('mailto:a@b.com', 'shop-1', HOSTS), 'mailto:a@b.com')
  assert.equal(rewritePartnerCustomDomainPublicHref('#sale', 'shop-1', HOSTS), '#sale')
})

test('custom domain html rewrites platform <base> so inner pages stay on the shop host', () => {
  const html = `<!DOCTYPE html><html><head><base href="https://nanoai.vn/"></head><body>
<a href="https://nanoai.vn/site/shop-1/cart">Cart</a>
<a href="/site/shop-1/c/ao">Ao</a>
<img src="https://cdn.example/x.jpg" alt="">
</body></html>`
  const out = rewritePartnerCustomDomainHtml(html, 'shop-1', HOSTS)
  assert.match(out, /<base href="\/">/)
  assert.doesNotMatch(out, /https:\/\/nanoai\.vn\//)
  assert.match(out, /href="\/cart"/)
  assert.match(out, /href="\/c\/ao"/)
  assert.match(out, /src="https:\/\/cdn\.example\/x\.jpg"/)
})

test('custom domain inject keeps a click rewriter for dynamically added catalog links', () => {
  const html = '<!DOCTYPE html><html><body><a href="/site/shop-1/products">All</a></body></html>'
  const out = injectPartnerCustomDomainLinkRewriteScript(html, 'shop-1')
  assert.match(out, /data-pw-custom-domain-links/)
  assert.match(out, /href="\/products"/)
  assert.match(out, /window\.top\.location\.href/)
})
