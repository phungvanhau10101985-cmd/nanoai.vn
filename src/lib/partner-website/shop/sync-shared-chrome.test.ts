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

test('syncSharedChromeAcrossProjectFiles copies chrome to every page and device', () => {
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
  assert.match(aboutMobile, /HomeLogo/)
  assert.match(aboutMobile, /About mobile/)
  assert.match(aboutMobile, /pw-bottom-nav/)
  assert.equal(notFound.includes('HomeLogo'), false)
  assert.equal(next.files.find((f) => f.path === 'site.config.json')?.content, '{}')
})

test('cross-device chrome copy strips floated logo coordinates', () => {
  const desktop = `<!DOCTYPE html><html><body>
<header class="pw-header"><img class="pw-logo" data-pw-logo-float="1" style="left:40px;top:8px;width:80px" alt="L"/></header>
<main>Desk</main>
<footer class="pw-footer">F</footer>
</body></html>`
  const mobile = `<!DOCTYPE html><html><body>
<header class="pw-header"><span>old</span></header>
<main>Mob</main>
</body></html>`
  const project = {
    files: [
      { path: 'index.html', kind: 'html', content: desktop },
      { path: 'index.mobile.html', kind: 'html', content: mobile },
    ],
  }
  const next = syncSharedChromeAcrossProjectFiles(project, 'index.html', desktop)
  const out = next.files.find((f) => f.path === 'index.mobile.html')?.content || ''
  assert.match(out, /data-pw-logo-float="1"/)
  assert.equal(/left:\s*40px/i.test(out), false)
  assert.match(out, /<main>Mob<\/main>/)
})
