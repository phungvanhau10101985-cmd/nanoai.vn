import assert from 'node:assert/strict'
import test from 'node:test'
import {
  applyInfoPageCmsToHtml,
  ensureAdsPlatformPolicyInHtml,
  extractInfoPageCmsFromHtml,
  stampPartnerSiteInfoPageSeoInHtml,
  visualEditSelectValueFromCmsSlug,
  visualInfoPageCmsSlug,
} from '@/lib/partner-website/pages/partner-info-page-visual'
import {
  contentHasAdsPlatformPolicy,
  ensureAdsPlatformPolicyParagraphs,
  getPartnerSiteInfoPage,
} from '@/lib/partner-website/shop/partner-site-shop-info-pages'

const SAMPLE = `<!DOCTYPE html><html><head><title></title></head>
<body data-pw-page="info">
<header data-pw-region="header"><h1>Logo shop</h1></header>
<main>
<article data-pw-region="content">
<h1>Vận chuyển</h1>
<p>Giao hàng 2-4 ngày toàn quốc.</p>
</article>
</main>
</body></html>`

test('stamp info page SEO hooks on content only, not header h1', () => {
  const stamped = stampPartnerSiteInfoPageSeoInHtml(SAMPLE, { title: 'Vận chuyển', pageKey: 'shipping' })
  assert.match(stamped, /data-pw-info-article/)
  assert.match(stamped, /data-pw-info-title/)
  assert.match(stamped, /data-pw-info-body/)
  assert.match(stamped, /data-pw-text-article="1"/)
  assert.match(stamped, /data-pw-article-kind="policy"/)
  assert.match(stamped, /<title>Vận chuyển<\/title>/)
  const headerH1 = stamped.match(/<header[\s\S]*?<h1[^>]*>Logo shop<\/h1>/i)?.[0] || ''
  assert.doesNotMatch(headerH1, /data-pw-info-title/)
})

test('extract / apply keep title and body in sync for CMS', () => {
  const stamped = stampPartnerSiteInfoPageSeoInHtml(SAMPLE)
  const extracted = extractInfoPageCmsFromHtml(stamped)
  assert.equal(extracted.title, 'Vận chuyển')
  assert.match(extracted.content, /Giao hàng 2-4 ngày/)
  const next = applyInfoPageCmsToHtml(stamped, {
    title: 'Chính sách giao hàng',
    content: 'Miễn phí đơn từ 500.000đ.\n\nNội thành 24 giờ.',
    seoTitle: 'Giao hàng | Shop',
    seoDescription: 'Miễn phí đơn từ 500.000đ, nội thành 24 giờ.',
  })
  const again = extractInfoPageCmsFromHtml(next)
  assert.equal(again.title, 'Chính sách giao hàng')
  assert.match(again.content, /Miễn phí đơn từ 500/)
  assert.match(again.content, /Nội thành 24 giờ/)
  assert.equal(again.seoTitle, 'Giao hàng | Shop')
  assert.match(next, /<meta[^>]*name=["']description["'][^>]*content=["']Miễn phí/)
  assert.doesNotMatch(next, /Giao hàng 2-4 ngày/)
})

test('cms slug maps to visual page select values', () => {
  assert.equal(visualInfoPageCmsSlug('shipping'), 'shipping')
  assert.equal(visualInfoPageCmsSlug('size_guide'), 'size-guide')
  assert.equal(visualEditSelectValueFromCmsSlug('shipping'), 'shipping')
  assert.equal(visualEditSelectValueFromCmsSlug('size-guide'), 'size_guide')
  assert.equal(visualEditSelectValueFromCmsSlug('huong-dan-mua'), 'cms:huong-dan-mua')
})

test('policy pages get Google Merchant / Facebook / TikTok ads paragraph once', () => {
  const stamped = stampPartnerSiteInfoPageSeoInHtml(SAMPLE, { title: 'Vận chuyển', pageKey: 'shipping' })
  const next = ensureAdsPlatformPolicyInHtml(stamped, 'vi', 'shipping')
  assert.match(next, /Google Merchant Center/)
  assert.match(next, /Facebook/)
  assert.match(next, /TikTok/)
  const twice = ensureAdsPlatformPolicyInHtml(next, 'vi', 'shipping')
  assert.equal((twice.match(/Google Merchant Center/g) || []).length, 1)
})

test('about pages do not get ads platform paragraph', () => {
  const about = SAMPLE.replace('Vận chuyển', 'Về chúng tôi')
  const next = ensureAdsPlatformPolicyInHtml(about, 'vi', 'about')
  assert.doesNotMatch(next, /Google Merchant Center/)
})

test('default privacy/terms copy already includes ads platform policy', () => {
  const privacy = getPartnerSiteInfoPage('privacy', 'vi')
  assert.ok(contentHasAdsPlatformPolicy(privacy.paragraphs.join('\n')))
  const terms = getPartnerSiteInfoPage('terms', 'vi')
  assert.ok(contentHasAdsPlatformPolicy(terms.paragraphs.join('\n')))
  const once = ensureAdsPlatformPolicyParagraphs(privacy.paragraphs, 'vi')
  assert.equal(once.length, privacy.paragraphs.length)
})
