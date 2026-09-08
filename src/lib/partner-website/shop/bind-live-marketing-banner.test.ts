import assert from 'node:assert/strict'
import test from 'node:test'
import {
  bindLiveMarketingBannersToHtml,
  buildLiveMarketingBannerCarouselHtml,
} from '@/lib/partner-website/shop/bind-live-marketing-banner'
import type { PartnerMarketingBannerPublicItem } from '@/lib/partner-website/promotions/partner-marketing-banner'

const sale: PartnerMarketingBannerPublicItem = {
  id: 'sale-1',
  kind: 'sale',
  campaign_key: 'sale-09-09-p6',
  date_key: '09-09',
  discount_percent: 6,
  image_url: 'https://cdn.example/sale.png',
  aspect_ratio: '21:9',
  event_date: '2026-09-09',
  greeting: null,
  version: 1,
  href: '/site/demo-shop/products',
}

const seed =
  '<section class="pw-hero" data-pw-personalize-banner="promo" data-pw-slider="1">' +
  '<div data-pw-slides><div data-pw-slide="0" data-pw-promo-slot="sale">' +
  '<img data-pw-el="media" src="data:image/svg+xml,demo" data-pw-banner-placeholder="1"/>' +
  '<div data-pw-el="copy"><h1 data-pw-el="title">Bộ sưu tập mới</h1></div>' +
  '</div></div></section>'

test('buildLiveMarketingBannerCarouselHtml paints live slides not seed copy', () => {
  const html = buildLiveMarketingBannerCarouselHtml([sale], 'vi')
  assert.match(html, /data-pw-promo-carousel="1"/)
  assert.match(html, /https:\/\/cdn\.example\/sale\.png/)
  assert.match(html, /data-pw-kind="sale"/)
  assert.match(html, /loading="eager"/)
  assert.doesNotMatch(html, /Bộ sưu tập mới/)
  assert.doesNotMatch(html, /data-pw-el="media"/)
})

test('bindLiveMarketingBannersToHtml stamps live carousel on first host', () => {
  const out = bindLiveMarketingBannersToHtml(seed, [sale], 'vi')
  assert.match(out, /data-pw-banner-live="1"/)
  assert.match(out, /https:\/\/cdn\.example\/sale\.png/)
  assert.match(out, /data-pw-promo-carousel/)
  assert.match(out, /Bộ sưu tập mới/)
  assert.match(out, /data-pw-banner-placeholder/)
})

test('bindLiveMarketingBannersToHtml hides leftover hosts and empty lists', () => {
  const two = `${seed}<section data-pw-personalize-banner="promo">extra</section>`
  const off = bindLiveMarketingBannersToHtml(two, [], 'vi')
  assert.equal((off.match(/data-pw-banner-live="off"/g) || []).length, 2)
  assert.doesNotMatch(off, /data-pw-promo-carousel/)
  const one = bindLiveMarketingBannersToHtml(two, [sale], 'vi')
  assert.match(one, /data-pw-banner-live="1"/)
  assert.match(one, /data-pw-banner-live="off"/)
})

test('bindLiveMarketingBannersToHtml paints the visible host when the first is hidden', () => {
  const hidden =
    '<section data-pw-personalize-banner="promo" data-pw-hidden="1">hidden</section>' + seed
  const out = bindLiveMarketingBannersToHtml(hidden, [sale], 'vi')
  assert.match(out, /data-pw-hidden="1"[^>]*data-pw-banner-live="off"/)
  assert.match(out, /data-pw-banner-live="1"/)
  assert.match(out, /https:\/\/cdn\.example\/sale\.png/)
})

test('bindLiveMarketingBannersToHtml skips when items were not resolved', () => {
  const out = bindLiveMarketingBannersToHtml(seed, null, 'vi')
  assert.equal(out, seed)
})

test('bindLiveMarketingBannersToHtml inserts greeting after the host', () => {
  const birthday: PartnerMarketingBannerPublicItem = {
    ...sale,
    id: 'bday-1',
    kind: 'birthday',
    greeting: 'Món quà sinh nhật dành riêng cho An',
  }
  const out = bindLiveMarketingBannersToHtml(seed, [birthday], 'vi')
  assert.match(out, /<\/section><p data-pw-banner-greeting="1">Món quà sinh nhật dành riêng cho An<\/p>/)
})

test('live banner uses page-sized AliCDN src and defers inactive slides', () => {
  const raw = 'https://img.alicdn.com/img/ibank/O1CN01banner.jpg'
  const html = buildLiveMarketingBannerCarouselHtml(
    [
      { ...sale, image_url: raw },
      { ...sale, id: 'sale-2', image_url: 'https://cdn.example/two.png' },
    ],
    'vi'
  )
  assert.match(html, /img\.alicdn\.com\/img\/ibank\/O1CN01banner\.jpg_1200x1200\.jpg/)
  assert.match(html, /loading="eager"/)
  assert.match(html, /data-pw-src="https:\/\/cdn\.example\/two\.png"/)
  assert.match(html, /loading="lazy"/)
  assert.doesNotMatch(html, /<img src="https:\/\/cdn\.example\/two\.png"/)
})
