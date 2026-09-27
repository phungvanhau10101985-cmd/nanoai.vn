import assert from 'node:assert/strict'
import test from 'node:test'
import { chromium } from 'playwright'
import { PW_PDP_HERO_SWIPE_JS } from '@/lib/partner-website/shop/pdp-hero-swipe'

const html = `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>
.pw-pdp-hero{display:grid;width:390px;position:relative}
.pw-pdp-hero-img{width:100%;height:auto;display:block;touch-action:pan-y}
.pw-pdp-hero-count{position:absolute;top:8px;right:8px}
.pw-pdp-hero-dots{display:flex;gap:4px}
.pw-pdp-hero-dots span.is-active{width:16px}
.pw-pdp-hero-thumbs{display:flex;gap:8px}
.pw-pdp-hero-track{display:flex;width:100%;min-width:0;overflow-x:auto;overflow-y:hidden;scroll-snap-type:x mandatory;touch-action:pan-x pan-y;overscroll-behavior-x:contain}
.pw-pdp-hero-slide{flex:0 0 100%;width:100%;min-width:100%;scroll-snap-align:start;scroll-snap-stop:always}
.pw-pdp-hero-slide-img{width:100%;height:200px;display:block;touch-action:pan-x pan-y}
.pw-pdp-hero:has([data-pw-pdp-hero-track])>.pw-pdp-share-frame>img{display:none!important}
</style></head><body>
<div class="pw-pdp-hero" data-pw-region="gallery">
  <span class="pw-pdp-share-frame"><img class="pw-pdp-hero-img" data-pw-el="main-image" src="https://cdn.example/a.jpg" alt="a"></span>
  <span class="pw-pdp-hero-count">1/1</span>
  <div class="pw-pdp-hero-dots"><span class="is-active"></span></div>
  <nav class="pw-pdp-hero-thumbs">
    <button type="button" data-pw-el="thumb"><img src="https://cdn.example/a.jpg" data-pw-full-src="https://cdn.example/a.jpg" alt="a"></button>
    <button type="button" data-pw-el="thumb"><img src="https://cdn.example/b.jpg" data-pw-full-src="https://cdn.example/b.jpg" alt="b"></button>
    <button type="button" data-pw-el="thumb"><img src="https://cdn.example/c.jpg" data-pw-full-src="https://cdn.example/c.jpg" alt="c"></button>
  </nav>
  <button type="button" data-pw-chrome-btn="try-on" data-nanoai-try-on data-nanoai-image=""></button>
</div>
<script>
function galleryFaceVisible(){return true}
function shopPdpPageSrc(u){return String(u||'')}
function shopPdpOrigSrc(u){return String(u||'')}
function showPdpImage(img,page,full,alt){img.setAttribute('src',page);if(full)img.setAttribute('data-pw-full-src',full);if(alt)img.setAttribute('alt',alt)}
function hideBrokenPdpImgs(){}
${PW_PDP_HERO_SWIPE_JS}
mountPdpHeroSwipeAll();
document.querySelector('.pw-pdp-hero-thumbs').addEventListener('click',function(ev){
  var btn=ev.target.closest('[data-pw-el="thumb"]');
  if(btn)pwPdpHeroGo(btn);
});
</script>
</body></html>`

test('mobile PDP hero swipes between gallery photos', async () => {
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true })
    await page.setContent(html, { waitUntil: 'domcontentloaded' })
    const before = await page.evaluate(() => {
      const track = document.querySelector('[data-pw-pdp-hero-track]') as HTMLElement | null
      const style = track ? getComputedStyle(track) : null
      return {
        slides: track?.children.length ?? 0,
        snap: style?.scrollSnapType ?? '',
        touch: style?.touchAction ?? '',
        overflow: style?.overflowX ?? '',
        count: document.querySelector('.pw-pdp-hero-count')?.textContent ?? '',
        parkedHidden: getComputedStyle(document.querySelector('.pw-pdp-share-frame img') as Element).display,
      }
    })
    assert.equal(before.slides, 3)
    assert.match(before.snap, /x/)
    assert.match(before.touch, /pan-x/)
    assert.equal(before.overflow, 'auto')
    assert.equal(before.count, '1/3')
    assert.equal(before.parkedHidden, 'none')

    await page.evaluate(() => {
      const track = document.querySelector('[data-pw-pdp-hero-track]') as HTMLElement
      track.scrollLeft = track.clientWidth
      track.dispatchEvent(new Event('scroll'))
    })
    const mid = await page.evaluate(() => ({
      count: document.querySelector('.pw-pdp-hero-count')?.textContent,
      src: document.querySelector('[data-pw-pdp-hero-slide="1"] img')?.getAttribute('src'),
      active: document.querySelectorAll('.pw-pdp-hero-thumbs [data-pw-el="thumb"].is-active').length,
      tryOn: document.querySelector('[data-pw-chrome-btn="try-on"]')?.getAttribute('data-nanoai-image') ?? '',
    }))
    assert.equal(mid.count, '2/3')
    assert.equal(mid.src, 'https://cdn.example/b.jpg')
    assert.equal(mid.active, 1)
    assert.equal(mid.tryOn, 'https://cdn.example/b.jpg')

    await page.evaluate(() => {
      const btn = document.querySelectorAll('.pw-pdp-hero-thumbs [data-pw-el="thumb"]')[0] as HTMLButtonElement
      btn.click()
    })
    const back = await page.evaluate(() => document.querySelector('.pw-pdp-hero-count')?.textContent)
    assert.equal(back, '1/3')
  } finally {
    await browser.close()
  }
})

test('video slide does not stretch the mobile hero taller than the photo', async () => {
  const { buildPartnerSiteShopThemeCss } = await import('@/lib/partner-website/shop/build-shop-theme-css')
  const { DEFAULT_PARTNER_WEBSITE_THEME } = await import('@/lib/partner-website/template/partner-website-template-types')
  const css = buildPartnerSiteShopThemeCss(DEFAULT_PARTNER_WEBSITE_THEME)
  const svg =
    'data:image/svg+xml,' +
    encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="390" height="200"><rect width="390" height="200" fill="#ddd"/></svg>')
  const html = `<!DOCTYPE html><html data-pw-edit-device="mobile"><head><style>${css}</style></head><body>
<div class="pw-pdp-hero">
  <div class="pw-pdp-hero-track" data-pw-pdp-hero-track="1">
    <div class="pw-pdp-hero-slide" data-pw-pdp-hero-slide="0"><img class="pw-pdp-hero-slide-img" src="${svg}" alt=""></div>
    <div class="pw-pdp-hero-slide" data-pw-pdp-hero-slide="1" data-pw-hero-kind="video"><div class="pw-pdp-hero-video"><video></video></div></div>
  </div>
</div>
</body></html>`
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
    await page.setContent(html, { waitUntil: 'load' })
    const box = await page.evaluate(() => {
      const track = document.querySelector('.pw-pdp-hero-track') as HTMLElement
      const photo = document.querySelector('.pw-pdp-hero-slide-img') as HTMLElement
      const videoSlide = document.querySelector('[data-pw-hero-kind="video"]') as HTMLElement
      return {
        track: track.getBoundingClientRect().height,
        photo: photo.getBoundingClientRect().height,
        video: videoSlide.getBoundingClientRect().height,
      }
    })
    assert.ok(box.photo > 160 && box.photo < 240, `photo height ${box.photo}`)
    assert.ok(Math.abs(box.track - box.photo) < 4, `track ${box.track} vs photo ${box.photo}`)
    assert.ok(Math.abs(box.video - box.track) < 4, `video slide ${box.video} vs track ${box.track}`)
  } finally {
    await browser.close()
  }
})
