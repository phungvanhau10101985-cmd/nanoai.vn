import assert from 'node:assert/strict'
import test from 'node:test'
import {
  applySharedChrome,
  extractSharedChrome,
  hasSharedChrome,
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

test('extractSharedChrome reads header footer and bottom nav', () => {
  const chrome = extractSharedChrome(home)
  assert.equal(hasSharedChrome(chrome), true)
  assert.match(chrome.header, /HomeLogo/)
  assert.match(chrome.footer, /Home footer/)
  assert.match(chrome.bottomNav, /pw-bottom-nav/)
  assert.equal(chrome.header.includes('Home hero'), false)
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

test('cross-device chrome keeps layout and copies missing feature buttons without coords', () => {
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
  assert.match(out, /data-pw-chrome-btn="wallet"/)
  assert.match(out, /data-pw-device="mobile"/)
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

test('saving a non-home page stamps that page from home and does not rewrite home', () => {
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
  assert.match(homeHtml, /HomeLogo/)
  assert.match(homeHtml, /Home footer/)
  assert.equal(homeHtml.includes('EditedAboutHead'), false)
  assert.match(aboutHtml, /HomeLogo/)
  assert.match(aboutHtml, /Home footer/)
  assert.match(aboutHtml, /<h1>About shop<\/h1>/)
  assert.equal(aboutHtml.includes('EditedAboutHead'), false)
  assert.match(productsHtml, /ProductsHead/)
  assert.match(productsHtml, /Products mid/)
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

