import assert from 'node:assert/strict'
import test from 'node:test'
import {
  injectPartnerInfoPageAdvancedSeoInHtml,
  stripPartnerInfoPageSeoCoachFromHtml,
} from '@/lib/partner-website/pages/partner-info-page-advanced-seo'

const SAMPLE = `<!DOCTYPE html><html><head><title>Vận chuyển</title>
<meta name="description" content="Giao hàng nhanh">
</head>
<body data-pw-page="info">
<article data-pw-region="content" data-pw-info-article="1" data-pw-seo-notes="giọng chuyên nghiệp">
<aside data-pw-seo-coach="1" class="pw-seo-coach"><p>coach</p></aside>
<h1 data-pw-info-title="1">Vận chuyển</h1>
<div data-pw-info-body="1"><p>Giao hàng 2-4 ngày toàn quốc.</p></div>
</article>
</body></html>`

test('public inject strips SEO coach and adds Article + Breadcrumb JSON-LD', () => {
  const out = injectPartnerInfoPageAdvancedSeoInHtml(SAMPLE, {
    pageUrl: 'https://188.com.vn/shipping',
    homeUrl: 'https://188.com.vn/',
    siteName: '188.com.vn',
    logoUrl: 'https://cdn.example/logo.png',
    locale: 'vi',
    homeLabel: 'Trang chủ',
    datePublished: '2026-01-01T00:00:00.000Z',
    dateModified: '2026-08-20T00:00:00.000Z',
  })
  assert.doesNotMatch(out, /data-pw-seo-coach/)
  assert.match(out, /data-pw-seo-jsonld="article"/)
  assert.match(out, /"@type":"Article"/)
  assert.match(out, /data-pw-seo-jsonld="breadcrumb"/)
  assert.match(out, /"@type":"BreadcrumbList"/)
  assert.match(out, /property="og:type" content="article"/)
  assert.match(out, /rel="canonical" href="https:\/\/188\.com\.vn\/shipping"/)
  assert.match(out, /name="robots" content="index, follow/)
  assert.match(out, /data-pw-seo-notes="giọng chuyên nghiệp"/)
})

test('strip seo coach keeps article body', () => {
  const stripped = stripPartnerInfoPageSeoCoachFromHtml(SAMPLE)
  assert.doesNotMatch(stripped, /data-pw-seo-coach/)
  assert.match(stripped, /Giao hàng 2-4 ngày/)
})

test('public html drops info articles that leaked after footer', () => {
  const html = `<!DOCTYPE html><html><body>
<main><article data-pw-region="content" data-pw-info-article="1"><h1 data-pw-info-title="1">VẬN CHUYỂN</h1>
<div data-pw-info-body="1"><p>Đơn được xử lý sau khi shop xác nhận.</p></div></article></main>
<footer class="pw-footer" data-pw-region="footer">Chân trang</footer>
<article data-pw-info-article="1"><h1>Chính Sách Vận Chuyển</h1>
<div data-pw-info-body="1"><p>Tại 188.com.vn, chúng tôi luôn nỗ lực mang đến trải nghiệm mua sắm.</p></div></article>
</body></html>`
  const stripped = stripPartnerInfoPageSeoCoachFromHtml(html)
  assert.match(stripped, /VẬN CHUYỂN/)
  assert.match(stripped, /Đơn được xử lý sau khi shop xác nhận/)
  assert.doesNotMatch(stripped, /Chính Sách Vận Chuyển/)
  assert.doesNotMatch(stripped, /Tại 188\.com\.vn, chúng tôi luôn nỗ lực/)
})
