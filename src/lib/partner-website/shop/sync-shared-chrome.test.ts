import assert from 'node:assert/strict'
import test from 'node:test'
import {
  applySharedChrome,
  dedupeSharedShopHeaders,
  extractSharedChrome,
  unwrapPersistedLiveChromeHtml,
  fillMissingSharedChromeFloats,
  hasSharedChrome,
  htmlHasShopHeader,
  hoistBodyLevelChromeFloats,
  hoistBodyLevelSceneOverlays,
  syncSharedChromeAcrossProjectFiles,
} from '@/lib/partner-website/shop/sync-shared-chrome'

const home = `<!DOCTYPE html><html><body>
<header class="pw-header" data-pw-region="header"><a class="pw-brand">HomeLogo</a></header>
<section class="pw-hero">Home hero</section>
<footer class="pw-footer" data-pw-region="footer">Home footer</footer>
<nav class="pw-bottom-nav"><a href="/">Home</a><a href="/products">Shop</a></nav>
</body></html>`

const about = `<!DOCTYPE html><html><body>
<header class="pw-header" data-pw-region="header"><a class="pw-brand">OldLogo</a></header>
<main><h1>About shop</h1></main>
<footer class="pw-footer" data-pw-region="footer">Old footer</footer>
<nav class="pw-bottom-nav"><a href="/about">About</a></nav>
</body></html>`

test('applySharedChrome drops leftover listing floats when home chrome lives in the header', () => {
  const homeHeaderChat = `<!DOCTYPE html><html><body>
<header class="pw-header" data-pw-region="header"><div class="pw-header-actions"><button type="button" class="pw-icon-btn pw-chrome-icon-only" data-pw-chrome-btn="chat" data-pw-chrome-size="36" style="--pw-chrome-size:36px" data-nanoai-open-chat>Tư vấn</button></div></header>
<main>Home</main>
<footer class="pw-footer" data-pw-region="footer">Home footer</footer>
<nav class="pw-bottom-nav"><a href="/">Home</a></nav>
</body></html>`
  const listingLeftovers = `<!DOCTYPE html><html><body>
<header class="pw-header" data-pw-region="header"><a class="pw-brand">OldLogo</a></header>
<main><h1>Products</h1></main>
<footer class="pw-footer" data-pw-region="footer">Old footer</footer>
<button type="button" data-pw-chrome-btn="topup" data-pw-chrome-float="1">Top</button>
<button type="button" data-pw-chrome-btn="topup" data-pw-chrome-float="1">Top2</button>
<a data-pw-chrome-btn="chat-zalo" data-pw-chrome-float="1" href="https://zalo.me/x">Zalo leftover</a>
<button class="pw-fab-chat" data-nanoai-chat-bubble="1">💬</button>
</body></html>`
  const next = applySharedChrome(listingLeftovers, extractSharedChrome(homeHeaderChat))
  assert.match(next, /<h1>Products<\/h1>/)
  assert.match(next, /data-pw-chrome-btn="chat"/)
  assert.match(next, /data-pw-chrome-size="36"/)
  assert.match(next, /--pw-chrome-size:36px/)
  assert.equal(next.includes('data-pw-chrome-btn="topup"'), false)
  assert.equal(next.includes('chat-zalo'), false)
  assert.equal(next.includes('pw-fab-chat'), false)
  assert.equal(next.includes('Zalo leftover'), false)
})

test('sync copies homepage topup onto other same-device pages', () => {
  const homeWithTopup = `<!DOCTYPE html><html><body>
<header class="pw-header" data-pw-region="header"><a class="pw-brand">HomeLogo</a></header>
<main>Home</main>
<footer class="pw-footer" data-pw-region="footer">Home footer</footer>
<nav class="pw-bottom-nav"><a href="/">Home</a></nav>
<button type="button" class="pw-icon-btn pw-chrome-icon-only" data-pw-chrome-btn="topup" data-pw-chrome-float="1" data-pw-chrome-added="1" data-pw-device="desktop" style="right:16px;bottom:256px">Top</button>
</body></html>`
  const shipping = `<!DOCTYPE html><html><body>
<header class="pw-header" data-pw-region="header"><a class="pw-brand">OldLogo</a></header>
<main><h1>Vận chuyển</h1></main>
<footer class="pw-footer" data-pw-region="footer">Old footer</footer>
</body></html>`
  const next = syncSharedChromeAcrossProjectFiles(
    {
      files: [
        { path: 'index.html', kind: 'html', content: homeWithTopup },
        { path: 'about.html', kind: 'html', content: about },
        { path: 'shipping.html', kind: 'html', content: shipping },
      ],
    },
    'index.html',
    homeWithTopup
  )
  const aboutHtml = next.files.find((f) => f.path === 'about.html')?.content || ''
  const shippingHtml = next.files.find((f) => f.path === 'shipping.html')?.content || ''
  assert.match(aboutHtml, /data-pw-chrome-btn="topup"/)
  assert.match(aboutHtml, /<h1>About shop<\/h1>/)
  assert.match(shippingHtml, /data-pw-chrome-btn="topup"/)
  assert.match(shippingHtml, /<h1>Vận chuyển<\/h1>/)
  assert.match(aboutHtml, /bottom:\s*256px/i)
})

test('fillMissingSharedChromeFloats adds topup when isolated chrome already has chat', () => {
  const isolated = `<!DOCTYPE html><html><body>
<header class="pw-header" data-pw-region="header">H</header>
<button type="button" data-pw-chrome-btn="chat" data-pw-chrome-float="1">Tư vấn</button>
</body></html>`
  const raw = `<!DOCTYPE html><html><body>
<div class="pw-visual-desktop" data-pw-visual-device="desktop">
<header class="pw-header" data-pw-region="header">H</header>
</div>
<button type="button" data-pw-chrome-btn="chat" data-pw-chrome-float="1">Tư vấn</button>
<button type="button" data-pw-chrome-btn="topup" data-pw-chrome-float="1">Top</button>
</body></html>`
  const next = fillMissingSharedChromeFloats(extractSharedChrome(isolated), raw)
  assert.match(next.floats, /data-pw-chrome-btn="chat"/)
  assert.match(next.floats, /data-pw-chrome-btn="topup"/)
})

test('hoistBodyLevelSceneOverlays recovers authored overlays dropped outside the device wrapper', () => {
  const raw = `<!DOCTYPE html><html><body>
<div class="pw-visual-desktop" data-pw-visual-device="desktop">
<header class="pw-header" data-pw-region="header">H</header>
<main>Home mid</main>
<footer class="pw-footer" data-pw-region="footer">F</footer>
</div>
<div id="float-copy" data-pw-added-text="1" data-pw-scene="4" data-pw-placement="scene-absolute">Nổi</div>
</body></html>`
  const isolated = `<!DOCTYPE html>
<html lang="vi">
<head>
</head>
<body>
<header class="pw-header" data-pw-region="header">H</header>
<main>Home mid</main>
<footer class="pw-footer" data-pw-region="footer">F</footer>
</body>
</html>`
  const next = hoistBodyLevelSceneOverlays(isolated, raw, 'desktop')
  assert.match(next, /id="float-copy"/)
  assert.match(next, /data-pw-scene="4"/)
  assert.match(next, /<main>Home mid[\s\S]*id="float-copy"[\s\S]*<\/main>/)
})

test('hoistBodyLevelChromeFloats pulls topup seated outside the device wrapper', () => {
  const raw = `<!DOCTYPE html><html><body>
<div class="pw-visual-desktop" data-pw-visual-device="desktop">
<header class="pw-header" data-pw-region="header">H</header>
<main>Home mid</main>
<footer class="pw-footer" data-pw-region="footer">F</footer>
</div>
<button type="button" data-pw-chrome-btn="topup" data-pw-chrome-float="1" data-pw-device="desktop">Top</button>
<button type="button" data-pw-chrome-btn="chat" data-pw-chrome-float="1" data-pw-device="desktop">Tư vấn</button>
</body></html>`
  const inner = `<header class="pw-header" data-pw-region="header">H</header>
<main>Home mid</main>
<footer class="pw-footer" data-pw-region="footer">F</footer>`
  const isolated = `<!DOCTYPE html>
<html lang="vi">
<head>
</head>
<body>
${inner}
</body>
</html>`
  const next = hoistBodyLevelChromeFloats(isolated, raw, 'desktop')
  assert.match(next, /Home mid/)
  assert.match(next, /data-pw-chrome-btn="topup"/)
  assert.match(next, /data-pw-chrome-btn="chat"/)
})

test('applySharedChrome copies body-level float icons to every same-device page', () => {
  const homeWithFloat = `<!DOCTYPE html><html><body>
<header class="pw-header" data-pw-region="header"><a class="pw-brand">HomeLogo</a></header>
<section class="pw-hero">Home hero</section>
<footer class="pw-footer" data-pw-region="footer">Home footer</footer>
<nav class="pw-bottom-nav"><a href="/">Home</a></nav>
<button type="button" class="pw-icon-btn pw-chrome-icon-only" data-pw-chrome-btn="chat" data-pw-chrome-float="1" data-nanoai-open-chat data-pw-user-move="1" style="left:92%;top:42%">Tư vấn</button>
<a data-pw-chrome-btn="chat-zalo" data-pw-chrome-float="1" href="https://zalo.me/x">Zalo</a>
</body></html>`
  const chrome = extractSharedChrome(homeWithFloat)
  assert.match(chrome.floats, /data-pw-chrome-btn="chat"/)
  assert.match(chrome.floats, /data-pw-chrome-btn="chat-zalo"/)
  assert.equal(chrome.header.includes('Tư vấn'), false)
  const next = applySharedChrome(about, chrome)
  assert.match(next, /<h1>About shop<\/h1>/)
  assert.match(next, /HomeLogo/)
  assert.match(next, /Tư vấn/)
  assert.match(next, /left:92%/)
  assert.match(next, /data-pw-chrome-btn="chat-zalo"/)
  assert.equal(next.includes('Home hero'), false)
})

test('applySharedChrome copies float size and replaces leftover extra kinds', () => {
  const homeSized = `<!DOCTYPE html><html><body>
<header class="pw-header" data-pw-region="header"><a class="pw-brand">HomeLogo</a></header>
<main>Home</main>
<footer class="pw-footer" data-pw-region="footer">F</footer>
<button type="button" class="pw-icon-btn pw-chrome-icon-only" data-pw-chrome-btn="chat" data-pw-chrome-float="1" data-pw-chrome-size="40" style="--pw-chrome-size:40px;left:92%;top:42%" data-nanoai-open-chat>Tư vấn</button>
</body></html>`
  const listing = `<!DOCTYPE html><html><body>
<header class="pw-header" data-pw-region="header"><a class="pw-brand">Old</a></header>
<main>Listing</main>
<footer class="pw-footer">OldF</footer>
<button type="button" data-pw-chrome-btn="topup" data-pw-chrome-float="1" data-pw-chrome-size="18">Top</button>
<button type="button" data-pw-chrome-btn="chat" data-pw-chrome-float="1" data-pw-chrome-size="22">Old chat</button>
</body></html>`
  const next = applySharedChrome(listing, extractSharedChrome(homeSized))
  assert.match(next, />Listing</)
  assert.match(next, /data-pw-chrome-size="40"/)
  assert.match(next, /--pw-chrome-size:40px/)
  assert.match(next, /left:92%/)
  assert.equal(next.includes('Old chat'), false)
  assert.equal(next.includes('data-pw-chrome-btn="topup"'), false)
  assert.equal((next.match(/data-pw-chrome-btn="chat"/g) || []).length, 1)
})

test('in-header chat is not double-copied as a body float', () => {
  const html = `<!DOCTYPE html><html><body>
<header class="pw-header"><div class="pw-header-actions"><button data-pw-chrome-btn="chat" data-pw-chrome-float="1">Tư vấn</button></div></header>
<main>Home</main>
<footer class="pw-footer">F</footer>
</body></html>`
  const chrome = extractSharedChrome(html)
  assert.equal(chrome.floats.trim(), '')
  assert.match(chrome.header, /Tư vấn/)
})

test('sync copies homepage floats onto other pages of the same device only', () => {
  const homeDesk = `<!DOCTYPE html><html><body>
<header class="pw-header">DeskHead</header>
<main>Desk home</main>
<footer class="pw-footer">DeskFoot</footer>
<button type="button" data-pw-chrome-btn="chat" data-pw-chrome-float="1" style="right:16px;bottom:88px">Tư vấn</button>
</body></html>`
  const aboutDesk = `<!DOCTYPE html><html><body>
<header class="pw-header">OldHead</header>
<main>About</main>
<footer class="pw-footer">OldFoot</footer>
</body></html>`
  const aboutMobile = `<!DOCTYPE html><html><body>
<header class="pw-header">MobHead</header>
<main>About mobile</main>
<footer class="pw-footer">MobFoot</footer>
</body></html>`
  const next = syncSharedChromeAcrossProjectFiles(
    {
      files: [
        { path: 'index.html', kind: 'html', content: homeDesk },
        { path: 'about.html', kind: 'html', content: aboutDesk },
        { path: 'about.mobile.html', kind: 'html', content: aboutMobile },
      ],
    },
    'index.html',
    homeDesk
  )
  const aboutHtml = next.files.find((f) => f.path === 'about.html')?.content || ''
  const aboutMob = next.files.find((f) => f.path === 'about.mobile.html')?.content || ''
  assert.match(aboutHtml, /Tư vấn/)
  assert.match(aboutHtml, />About</)
  assert.match(aboutHtml, /DeskHead/)
  assert.match(aboutHtml, /right:\s*16px/i)
  assert.match(aboutMob, /MobHead/)
  assert.match(aboutMob, /About mobile/)
  assert.equal(aboutMob.includes('Tư vấn'), false)
  assert.equal(aboutMob.includes('data-pw-chrome-btn="chat"'), false)
})

test('htmlHasShopHeader detects shared header chrome', () => {
  assert.equal(htmlHasShopHeader(home), true)
  assert.equal(htmlHasShopHeader('<!DOCTYPE html><html><body><main>No chrome</main></body></html>'), false)
})

test('applySharedChrome keeps page middle and replaces chrome', () => {
  const next = applySharedChrome(about, extractSharedChrome(home))
  assert.match(next, /HomeLogo/)
  assert.match(next, /Home footer/)
  assert.match(next, /href="\/products"/)
  assert.match(next, /<h1>About shop<\/h1>/)
  assert.equal(next.includes('OldLogo'), false)
  assert.equal(next.includes('Old footer'), false)
  assert.equal(next.includes('Home hero'), false)
})

test('applySharedChrome inserts missing bottom nav and footer', () => {
  const bare = '<!DOCTYPE html><html><body><main>Cart</main></body></html>'
  const next = applySharedChrome(bare, extractSharedChrome(home))
  assert.match(next, /<main>Cart<\/main>/)
  assert.match(next, /pw-header/)
  assert.match(next, /pw-footer/)
  assert.match(next, /pw-bottom-nav/)
})

test('applySharedChrome does not match pw-header-main as the header host', () => {
  const html = `<!DOCTYPE html><html><body>
<div class="pw-header-main">not header</div>
<header class="pw-header">real</header>
<main>mid</main>
</body></html>`
  const chrome = extractSharedChrome(html)
  assert.match(chrome.header, />real</)
  assert.equal(chrome.header.includes('not header'), false)
})

test('header footer bottom nav and floats sync on every device independently', () => {
  function page(device: string, where: string) {
    const suffix = device === 'desktop' ? '' : `.${device}`
    return {
      path: `${where === 'home' ? 'index' : where}${suffix}.html`,
      kind: 'html' as const,
      content: `<!DOCTYPE html><html><body>
<header class="pw-header">${device}-head-${where}</header>
<main>${device}-${where}-mid</main>
<footer class="pw-footer">${device}-foot-${where}</footer>
<nav class="pw-bottom-nav">${device}-nav-${where}</nav>
<button type="button" data-pw-chrome-btn="chat" data-pw-chrome-float="1">${device}-float-${where}</button>
</body></html>`,
    }
  }
  const project = {
    files: [
      page('desktop', 'home'),
      page('desktop', 'about'),
      page('laptop', 'home'),
      page('laptop', 'about'),
      page('tablet', 'home'),
      page('tablet', 'about'),
      page('mobile', 'home'),
      page('mobile', 'about'),
    ],
  }
  const deskHome = project.files[0].content
  const next = syncSharedChromeAcrossProjectFiles(project, 'index.html', deskHome)
  const deskAbout = next.files.find((f) => f.path === 'about.html')?.content || ''
  const lapAbout = next.files.find((f) => f.path === 'about.laptop.html')?.content || ''
  const tabAbout = next.files.find((f) => f.path === 'about.tablet.html')?.content || ''
  const mobAbout = next.files.find((f) => f.path === 'about.mobile.html')?.content || ''
  assert.match(deskAbout, /desktop-head-home/)
  assert.match(deskAbout, /desktop-foot-home/)
  assert.match(deskAbout, /desktop-nav-home/)
  assert.match(deskAbout, /desktop-float-home/)
  assert.match(deskAbout, /desktop-about-mid/)
  assert.match(lapAbout, /laptop-head-about/)
  assert.match(lapAbout, /laptop-about-mid/)
  assert.match(lapAbout, /laptop-foot-about/)
  assert.match(lapAbout, /laptop-nav-about/)
  assert.match(lapAbout, /laptop-float-about/)
  assert.equal(lapAbout.includes('desktop-head-home'), false)
  assert.equal(lapAbout.includes('desktop-foot-home'), false)
  assert.equal(lapAbout.includes('desktop-nav-home'), false)
  assert.match(tabAbout, /tablet-head-about/)
  assert.equal(tabAbout.includes('desktop-foot-home'), false)
  assert.match(mobAbout, /mobile-head-about/)
  assert.equal(mobAbout.includes('desktop-nav-home'), false)

  const mobileHome = next.files.find((f) => f.path === 'index.mobile.html')?.content || ''
  const afterMobile = syncSharedChromeAcrossProjectFiles(next, 'index.mobile.html', mobileHome)
  const mobAbout2 = afterMobile.files.find((f) => f.path === 'about.mobile.html')?.content || ''
  const deskAbout2 = afterMobile.files.find((f) => f.path === 'about.html')?.content || ''
  assert.match(mobAbout2, /mobile-head-home/)
  assert.match(mobAbout2, /mobile-foot-home/)
  assert.match(mobAbout2, /mobile-nav-home/)
  assert.match(mobAbout2, /mobile-float-home/)
  assert.match(mobAbout2, /mobile-about-mid/)
  assert.match(deskAbout2, /desktop-head-home/)
  assert.equal(deskAbout2.includes('mobile-head-home'), false)
})

test('syncSharedChromeAcrossProjectFiles copies chrome only within the same device', () => {
  const project = {
    files: [
      { path: 'index.html', kind: 'html', content: home },
      { path: 'about.html', kind: 'html', content: about },
      {
        path: 'about.mobile.html',
        kind: 'html',
        content:
          '<!DOCTYPE html><html><body><header class="pw-header">m</header><p>About mobile</p><footer class="pw-footer">mf</footer></body></html>',
      },
      { path: '404.html', kind: 'html', content: '<!DOCTYPE html><html><body>404</body></html>' },
      { path: 'site.config.json', kind: 'json', content: '{}' },
    ],
  }
  const next = syncSharedChromeAcrossProjectFiles(project, 'index.html', home)
  const aboutHtml = next.files.find((f) => f.path === 'about.html')?.content || ''
  const aboutMobile = next.files.find((f) => f.path === 'about.mobile.html')?.content || ''
  const notFound = next.files.find((f) => f.path === '404.html')?.content || ''
  assert.match(aboutHtml, /HomeLogo/)
  assert.match(aboutHtml, /<h1>About shop<\/h1>/)
  assert.match(aboutHtml, /Home footer/)
  assert.match(aboutMobile, />m</)
  assert.match(aboutMobile, /About mobile/)
  assert.equal(aboutMobile.includes('HomeLogo'), false)
  assert.equal(aboutMobile.includes('Home footer'), false)
  assert.equal(notFound.includes('HomeLogo'), false)
  assert.equal(next.files.find((f) => f.path === 'site.config.json')?.content, '{}')
})

test('same-device chrome copy keeps floated logo coordinates', () => {
  const desktop = `<!DOCTYPE html><html><body>
<header class="pw-header"><img class="pw-logo" data-pw-logo-float="1" style="left:40px;top:8px;width:80px" alt="L"/></header>
<main>Home</main>
<footer class="pw-footer">F</footer>
</body></html>`
  const aboutDesk = `<!DOCTYPE html><html><body>
<header class="pw-header"><span>old</span></header>
<main>About</main>
<footer class="pw-footer">oldf</footer>
</body></html>`
  const project = {
    files: [
      { path: 'index.html', kind: 'html', content: desktop },
      { path: 'about.html', kind: 'html', content: aboutDesk },
    ],
  }
  const next = syncSharedChromeAcrossProjectFiles(project, 'index.html', desktop)
  const out = next.files.find((f) => f.path === 'about.html')?.content || ''
  assert.match(out, /left:\s*40px/i)
  assert.match(out, /<main>About<\/main>/)
})

test('cross-device chrome keeps layout and does not copy buttons from another machine', () => {
  const desktop = `<!DOCTYPE html><html><body>
<header class="pw-header"><img class="pw-logo" data-pw-logo-float="1" style="left:40px;top:8px;width:80px" alt="DeskLogo"/><div class="pw-header-actions"><a data-pw-chrome-added="1" data-pw-chrome-btn="wallet" data-pw-device="desktop" style="transform:translate(120px,0)">$</a></div></header>
<main>Desk</main>
<footer class="pw-footer">DeskFoot</footer>
</body></html>`
  const mobile = `<!DOCTYPE html><html><body>
<header class="pw-header"><img class="pw-logo" data-pw-logo-float="1" style="left:12px;top:4px;width:48px" alt="MobLogo"/><div class="pw-header-actions"></div></header>
<main>Mob</main>
<footer class="pw-footer">MobFoot</footer>
</body></html>`
  const project = {
    files: [
      { path: 'index.html', kind: 'html', content: desktop },
      { path: 'index.mobile.html', kind: 'html', content: mobile },
    ],
  }
  const next = syncSharedChromeAcrossProjectFiles(project, 'index.html', desktop)
  const out = next.files.find((f) => f.path === 'index.mobile.html')?.content || ''
  assert.match(out, /alt="MobLogo"/)
  assert.match(out, /left:\s*12px/i)
  assert.equal(/alt="DeskLogo"/i.test(out), false)
  assert.equal(/left:\s*40px/i.test(out), false)
  assert.match(out, /MobFoot/)
  assert.equal(out.includes('DeskFoot'), false)
  assert.match(out, /<main>Mob<\/main>/)
  assert.equal(out.includes('data-pw-chrome-btn="wallet"'), false)
  assert.equal(/translate\(120px/i.test(out), false)
})

test('saving mobile chrome does not rewrite desktop logo layout', () => {
  const desktop = `<!DOCTYPE html><html><body>
<header class="pw-header"><img class="pw-logo" data-pw-logo-float="1" style="left:40px;top:8px" alt="DeskLogo"/></header>
<main>Desk</main>
<footer class="pw-footer">DeskFoot</footer>
</body></html>`
  const mobile = `<!DOCTYPE html><html><body>
<header class="pw-header"><img class="pw-logo" data-pw-logo-float="1" style="left:6px;top:2px" alt="MobLogo"/></header>
<main>Mob</main>
<footer class="pw-footer">MobFoot</footer>
<nav class="pw-bottom-nav"><a href="/m">M</a></nav>
</body></html>`
  const project = {
    files: [
      { path: 'index.html', kind: 'html', content: desktop },
      { path: 'index.mobile.html', kind: 'html', content: mobile },
    ],
  }
  const next = syncSharedChromeAcrossProjectFiles(project, 'index.mobile.html', mobile)
  const desk = next.files.find((f) => f.path === 'index.html')?.content || ''
  assert.match(desk, /alt="DeskLogo"/)
  assert.match(desk, /left:\s*40px/i)
  assert.match(desk, /DeskFoot/)
  assert.equal(desk.includes('MobLogo'), false)
  assert.equal(desk.includes('MobFoot'), false)
})

test('saving one mobile page copies added chrome icon position to all mobile pages only', () => {
  const desktop = `<!DOCTYPE html><html><body>
<header class="pw-header"><a class="pw-brand">DeskLogo</a><div class="pw-header-actions"></div></header>
<main>Desk home</main>
<footer class="pw-footer">DeskFoot</footer>
</body></html>`
  const mobileHome = `<!DOCTYPE html><html><body>
<header class="pw-header"><a class="pw-brand">MobLogo</a><div class="pw-header-actions"></div></header>
<main>Mob home</main>
<footer class="pw-footer">MobFoot</footer>
<nav class="pw-bottom-nav"><a href="/">Home</a></nav>
</body></html>`
  const mobileAboutEdited = `<!DOCTYPE html><html><body>
<header class="pw-header"><a class="pw-brand">MobLogo</a><div class="pw-header-actions"><button data-pw-chrome-added="1" data-pw-chrome-btn="chat" data-pw-device="mobile" style="--pw-chrome-size:30px;left:18px;top:6px" data-nanoai-open-chat>Chat</button></div></header>
<main>Mob about</main>
<footer class="pw-footer">MobFoot</footer>
<nav class="pw-bottom-nav"><a href="/">Home</a></nav>
</body></html>`
  const mobileProducts = `<!DOCTYPE html><html><body>
<header class="pw-header"><a class="pw-brand">OldMobLogo</a><div class="pw-header-actions"></div></header>
<main>Mob products</main>
<footer class="pw-footer">OldMobFoot</footer>
<nav class="pw-bottom-nav"><a href="/products">Products</a></nav>
</body></html>`
  const project = {
    files: [
      { path: 'index.html', kind: 'html', content: desktop },
      { path: 'index.mobile.html', kind: 'html', content: mobileHome },
      { path: 'about.mobile.html', kind: 'html', content: mobileProducts },
      { path: 'products.mobile.html', kind: 'html', content: mobileProducts },
    ],
  }
  const next = syncSharedChromeAcrossProjectFiles(project, 'about.mobile.html', mobileAboutEdited)
  const desk = next.files.find((f) => f.path === 'index.html')?.content || ''
  const mobHome = next.files.find((f) => f.path === 'index.mobile.html')?.content || ''
  const mobProducts = next.files.find((f) => f.path === 'products.mobile.html')?.content || ''
  assert.equal(desk.includes('data-pw-chrome-btn="chat"'), false)
  assert.match(mobHome, /data-pw-chrome-btn="chat"/)
  assert.match(mobHome, /left:\s*18px/i)
  assert.match(mobHome, /top:\s*6px/i)
  assert.match(mobHome, /<main>Mob home<\/main>/)
  assert.match(mobProducts, /data-pw-chrome-btn="chat"/)
  assert.match(mobProducts, /left:\s*18px/i)
  assert.match(mobProducts, /top:\s*6px/i)
  assert.match(mobProducts, /<main>Mob products<\/main>/)
})

test('saving a non-home page syncs that device chrome to every same-device page', () => {
  const project = {
    files: [
      { path: 'index.html', kind: 'html', content: home },
      { path: 'about.html', kind: 'html', content: about },
      {
        path: 'products.html',
        kind: 'html',
        content:
          '<!DOCTYPE html><html><body><header class="pw-header">ProductsHead</header><main>Products mid</main><footer class="pw-footer">ProductsFoot</footer></body></html>',
      },
    ],
  }
  const editedAbout = `<!DOCTYPE html><html><body>
<header class="pw-header">EditedAboutHead</header>
<main><h1>About shop</h1></main>
<footer class="pw-footer">EditedAboutFoot</footer>
<nav class="pw-bottom-nav"><a href="/about">About</a></nav>
</body></html>`
  const next = syncSharedChromeAcrossProjectFiles(project, 'about.html', editedAbout)
  const homeHtml = next.files.find((f) => f.path === 'index.html')?.content || ''
  const aboutHtml = next.files.find((f) => f.path === 'about.html')?.content || ''
  const productsHtml = next.files.find((f) => f.path === 'products.html')?.content || ''
  assert.match(homeHtml, /EditedAboutHead/)
  assert.match(homeHtml, /EditedAboutFoot/)
  assert.match(homeHtml, /Home hero/)
  assert.match(aboutHtml, /EditedAboutHead/)
  assert.match(aboutHtml, /EditedAboutFoot/)
  assert.match(aboutHtml, /<h1>About shop<\/h1>/)
  assert.match(productsHtml, /EditedAboutHead/)
  assert.match(productsHtml, /EditedAboutFoot/)
  assert.match(productsHtml, /Products mid/)
})

test('saving a non-home page keeps deleted chrome widgets deleted', () => {
  const homeWithWidget = `<!DOCTYPE html><html><body>
<header class="pw-header" data-pw-region="header">
  <a class="pw-brand">HomeLogo</a>
  <div class="pw-header-actions"><a data-pw-chrome-added="1" data-pw-chrome-btn="products" href="/products">Products</a></div>
</header>
<main>Home mid</main>
<footer class="pw-footer">Home footer</footer>
</body></html>`
  const aboutWithTombstone = `<!DOCTYPE html><html><body>
<header class="pw-header" data-pw-region="header"><a class="pw-brand">EditedAboutHead</a><div class="pw-header-actions"></div></header>
<main><h1>About shop</h1></main>
<span data-pw-deleted-chrome-feature="btn:products" data-pw-device="desktop" hidden></span>
<footer class="pw-footer">EditedAboutFoot</footer>
</body></html>`
  const project = {
    files: [
      { path: 'index.html', kind: 'html', content: homeWithWidget },
      { path: 'about.html', kind: 'html', content: about },
    ],
  }
  const next = syncSharedChromeAcrossProjectFiles(project, 'about.html', aboutWithTombstone)
  const homeHtml = next.files.find((f) => f.path === 'index.html')?.content || ''
  const aboutHtml = next.files.find((f) => f.path === 'about.html')?.content || ''
  assert.equal(homeHtml.includes('data-pw-chrome-btn="products"'), false)
  assert.match(aboutHtml, /EditedAboutHead/)
  assert.equal(aboutHtml.includes('data-pw-chrome-btn="products"'), false)
  assert.match(aboutHtml, /data-pw-deleted-chrome-feature="btn:products"/)
  assert.match(aboutHtml, /<h1>About shop<\/h1>/)
})

test('saving home copies chrome CSS onto other pages of the same device', () => {
  const styledHome = `<!DOCTYPE html><html><head>
<style>.pw-header{background:#c2410c}</style>
</head><body>
<header class="pw-header">HomeLogo</header>
<main>Home mid</main>
<footer class="pw-footer">Home footer</footer>
<nav class="pw-bottom-nav"><a href="/">Home</a></nav>
</body></html>`
  const aboutBare = `<!DOCTYPE html><html><head><title>About</title></head><body>
<header class="pw-header">Old</header>
<main>About mid</main>
<footer class="pw-footer">Oldf</footer>
</body></html>`
  const project = {
    files: [
      { path: 'index.html', kind: 'html', content: styledHome },
      { path: 'about.html', kind: 'html', content: aboutBare },
      {
        path: 'about.mobile.html',
        kind: 'html',
        content:
          '<!DOCTYPE html><html><body><header class="pw-header">m</header><main>About mobile</main><footer class="pw-footer">mf</footer></body></html>',
      },
    ],
  }
  const next = syncSharedChromeAcrossProjectFiles(project, 'index.html', styledHome)
  const aboutHtml = next.files.find((f) => f.path === 'about.html')?.content || ''
  const aboutMobile = next.files.find((f) => f.path === 'about.mobile.html')?.content || ''
  assert.match(aboutHtml, /HomeLogo/)
  assert.match(aboutHtml, /About mid/)
  assert.match(aboutHtml, /pw-header\{background:#c2410c\}/)
  assert.match(aboutHtml, /data-pw-home-chrome-css/)
  assert.equal(aboutMobile.includes('HomeLogo'), false)
  assert.equal(aboutMobile.includes('pw-header{background:#c2410c}'), false)
})

test('shared chrome does not copy homepage bottom nav onto PDP', () => {
  const pdp = `<!DOCTYPE html><html><body data-pw-page="product">
<header class="pw-header">PdpHead</header>
<main>PDP mid</main>
<nav class="pw-bottom-nav" data-pw-pdp-bottom="1"><a data-pw-chrome-btn="home">Home</a><button data-pw-chrome-btn="buy-now">Mua</button></nav>
</body></html>`
  const next = applySharedChrome(pdp, extractSharedChrome(home))
  assert.match(next, /HomeLogo/)
  assert.match(next, /PDP mid/)
  assert.match(next, /data-pw-pdp-bottom="1"/)
  assert.match(next, /data-pw-chrome-btn="buy-now"/)
  assert.equal(next.includes('href="/products"'), false)
})

test('shared chrome does not copy PDP bottom nav onto other pages', () => {
  const pdp = `<!DOCTYPE html><html><body data-pw-page="product">
<header class="pw-header">PdpHead</header>
<main>PDP</main>
<footer class="pw-footer">PdpFoot</footer>
<nav class="pw-bottom-nav" data-pw-pdp-bottom="1"><button data-pw-chrome-btn="buy-now">Mua hàng</button></nav>
</body></html>`
  const next = applySharedChrome(about, extractSharedChrome(pdp))
  assert.match(next, /PdpHead/)
  assert.match(next, /About shop/)
  assert.match(next, /href="\/about"/)
  assert.equal(next.includes('data-pw-pdp-bottom'), false)
  assert.equal(next.includes('Mua hàng'), false)
})

test('kit dock from homepage copies onto PDP of the same device', () => {
  const homeKit = `<!DOCTYPE html><html><body>
<header class="pw-header">KitHead</header>
<main>Home</main>
<nav class="pw-bottom-nav" data-pw-chrome-kit="dock"><a data-pw-chrome-btn="home" data-pw-dock-show="both">Home</a><a data-pw-chrome-btn="products" data-pw-dock-show="shop">SP</a><button data-pw-chrome-btn="try-on" data-pw-dock-show="pdp">Thử</button></nav>
</body></html>`
  const pdp = `<!DOCTYPE html><html><body data-pw-page="product">
<header class="pw-header">OldPdp</header>
<main>PDP mid</main>
<nav class="pw-bottom-nav" data-pw-pdp-bottom="1"><button data-pw-chrome-btn="buy-now">Mua cũ</button></nav>
</body></html>`
  const next = applySharedChrome(pdp, extractSharedChrome(homeKit))
  assert.match(next, /KitHead/)
  assert.match(next, /PDP mid/)
  assert.match(next, /data-pw-chrome-kit="dock"/)
  assert.match(next, /data-pw-chrome-btn="try-on"/)
  assert.equal(next.includes('Mua cũ'), false)
})

test('saving desktop home does not copy header onto laptop home', () => {
  const desk = `<!DOCTYPE html><html><body>
<header class="pw-header">DeskHead</header>
<main>Desk mid</main>
<nav class="pw-bottom-nav" data-pw-chrome-kit="dock"><a data-pw-chrome-btn="home">H</a></nav>
</body></html>`
  const lap = `<!DOCTYPE html><html><body>
<header class="pw-header">LapHead</header>
<main>Lap mid</main>
<nav class="pw-bottom-nav">LapNav</nav>
</body></html>`
  const next = syncSharedChromeAcrossProjectFiles(
    {
      files: [
        { path: 'index.html', kind: 'html', content: desk },
        { path: 'index.laptop.html', kind: 'html', content: lap },
      ],
    },
    'index.html',
    desk
  )
  const laptop = next.files.find((f) => f.path === 'index.laptop.html')?.content || ''
  assert.match(laptop, /LapHead/)
  assert.match(laptop, /Lap mid/)
  assert.match(laptop, /LapNav/)
  assert.equal(laptop.includes('DeskHead'), false)
})

test('saving mobile home does not copy kit dock onto tablet home', () => {
  const mob = `<!DOCTYPE html><html><body>
<header class="pw-header">MobHead</header>
<main>Mob mid</main>
<nav class="pw-bottom-nav" data-pw-chrome-kit="dock"><a data-pw-chrome-btn="home">Chủ</a><a data-pw-chrome-btn="cart">Giỏ kit</a></nav>
</body></html>`
  const tab = `<!DOCTYPE html><html><body>
<header class="pw-header">TabHead</header>
<main>Tab mid</main>
<nav class="pw-bottom-nav">TabNav</nav>
</body></html>`
  const next = syncSharedChromeAcrossProjectFiles(
    {
      files: [
        { path: 'index.mobile.html', kind: 'html', content: mob },
        { path: 'index.tablet.html', kind: 'html', content: tab },
      ],
    },
    'index.mobile.html',
    mob
  )
  const tablet = next.files.find((f) => f.path === 'index.tablet.html')?.content || ''
  assert.match(tablet, /TabHead/)
  assert.match(tablet, /Tab mid/)
  assert.match(tablet, /TabNav/)
  assert.equal(tablet.includes('Giỏ kit'), false)
})

test('sync keeps mobile PDP bar when homepage nav is saved', () => {
  const homeMob = `<!DOCTYPE html><html><body>
<header class="pw-header">MobHead</header>
<main>Home</main>
<nav class="pw-bottom-nav"><a href="/">Trang chủ</a><a href="/products">Sản phẩm</a></nav>
</body></html>`
  const pdpMob = `<!DOCTYPE html><html><body data-pw-page="product">
<header class="pw-header">OldPdpHead</header>
<main>PDP mid</main>
<nav class="pw-bottom-nav" data-pw-pdp-bottom="1"><a data-pw-chrome-btn="home">Home</a><button data-pw-chrome-btn="try-on">Thử đồ</button></nav>
</body></html>`
  const next = syncSharedChromeAcrossProjectFiles(
    {
      files: [
        { path: 'index.mobile.html', kind: 'html', content: homeMob },
        { path: 'product-detail.mobile.html', kind: 'html', content: pdpMob },
      ],
    },
    'index.mobile.html',
    homeMob
  )
  const pdp = next.files.find((f) => f.path === 'product-detail.mobile.html')?.content || ''
  assert.match(pdp, /MobHead/)
  assert.match(pdp, /PDP mid/)
  assert.match(pdp, /data-pw-pdp-bottom="1"/)
  assert.match(pdp, /data-pw-chrome-btn="try-on"/)
  assert.equal(pdp.includes('href="/products"'), false)
})

test('extractSharedChrome merges escaped floats into an empty kit host', () => {
  const html = `<!DOCTYPE html><html><body>
<header class="pw-header" data-pw-region="header"><a class="pw-brand">HomeLogo</a></header>
<main>Home</main>
<footer class="pw-footer" data-pw-region="footer">F</footer>
<aside data-pw-chrome-kit="float" data-pw-float-right="24" data-pw-float-size="32"></aside>
<button type="button" data-pw-chrome-btn="chat" data-pw-chrome-float="1" data-pw-chrome-kit="1" data-pw-btn-color="#111111">Chat</button>
</body></html>`
  const chrome = extractSharedChrome(html)
  assert.match(chrome.floats, /data-pw-chrome-kit=["']float["']/)
  assert.match(chrome.floats, /data-pw-btn-color="#111111"/)
  assert.match(chrome.floats, /data-pw-chrome-btn="chat"/)
})

test('applySharedChrome unwraps persisted live-chrome and drops a second header', () => {
  const chrome = extractSharedChrome(home)
  const duplicated = `<!DOCTYPE html><html><body>
<div data-pw-live-chrome="1"><div data-pw-live-chrome-scale="1"><header class="pw-header" data-pw-region="header">Hoisted</header></div></div>
<header class="pw-header" data-pw-region="header">ExtraHead</header>
<main>PDP</main>
</body></html>`
  assert.equal((unwrapPersistedLiveChromeHtml(duplicated).match(/<header /g) || []).length, 2)
  const next = applySharedChrome(duplicated, chrome)
  assert.equal((next.match(/<header /g) || []).length, 1)
  assert.match(next, /HomeLogo/)
  assert.doesNotMatch(next, /ExtraHead/)
  assert.doesNotMatch(next, /data-pw-live-chrome/)
  assert.equal(dedupeSharedShopHeaders(duplicated).includes('ExtraHead'), false)
})

