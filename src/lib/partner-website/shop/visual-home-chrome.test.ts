import assert from 'node:assert/strict'
import test from 'node:test'
import { DEFAULT_PARTNER_WEBSITE_THEME } from '@/lib/partner-website/template/partner-website-template-types'
import {
  VISUAL_HOME_CHROME_SPLIT_CSS,
  hasVisualHomeChrome,
  pickVisualHomeChrome,
  visualChromeAfterMain,
  visualChromeBeforeMain,
  visualHomeChromeByDevice,
  visualHomeChromeForDevice,
} from '@/lib/partner-website/shop/visual-home-chrome'

const deskHome = `<!DOCTYPE html><html><body>
<div class="pw-shop-topbar" data-pw-region="topbar">DeskTop</div>
<header class="pw-shop-header" data-pw-region="header">DeskHead</header>
<section>Home mid</section>
<footer class="pw-shop-footer" data-pw-region="footer">DeskFoot</footer>
<nav class="pw-shop-bottom-nav">DeskNav</nav>
</body></html>`

const mobHome = `<!DOCTYPE html><html><body>
<header class="pw-shop-header">MobHead</header>
<section>Mob mid</section>
<footer class="pw-shop-footer">MobFoot</footer>
<nav class="pw-shop-bottom-nav">MobNav</nav>
</body></html>`

test('visualHomeChromeForDevice reads homepage chrome of that device', () => {
  const website = {
    theme: {
      ...DEFAULT_PARTNER_WEBSITE_THEME,
      useVisualHtml: true,
      useVisualMobileHtml: true,
    },
    htmlSource: deskHome,
    project: {
      entryPath: 'index.html',
      files: [
        { path: 'index.html', kind: 'html' as const, content: deskHome },
        { path: 'index.mobile.html', kind: 'html' as const, content: mobHome },
      ],
    },
  }
  const desk = visualHomeChromeForDevice(website, 'desktop')
  assert.ok(desk)
  assert.match(desk.header, /DeskHead/)
  assert.match(desk.footer, /DeskFoot/)
  assert.match(desk.topbar, /DeskTop/)
  assert.equal(desk.header.includes('Home mid'), false)
  const mob = visualHomeChromeForDevice(website, 'mobile')
  assert.ok(mob)
  assert.match(mob.header, /MobHead/)
  assert.equal(mob.header.includes('DeskHead'), false)
})

test('visualHomeChromeByDevice is empty without visual homepage', () => {
  const byDevice = visualHomeChromeByDevice({
    theme: DEFAULT_PARTNER_WEBSITE_THEME,
    htmlSource: '',
    project: { entryPath: 'index.html', files: [] },
  })
  assert.equal(hasVisualHomeChrome(byDevice), false)
  assert.equal(byDevice.desktop, null)
  assert.equal(byDevice.laptop, null)
})

test('visualHomeChromeByDevice copies homepage CSS for other pages', () => {
  const styledHome = `<!DOCTYPE html><html><head>
<style>.pw-header{background:#c2410c}.pw-topbar{color:#fff}</style>
</head><body>
<header class="pw-header">DeskHead</header>
<footer class="pw-footer">DeskFoot</footer>
</body></html>`
  const byDevice = visualHomeChromeByDevice({
    theme: { ...DEFAULT_PARTNER_WEBSITE_THEME, useVisualHtml: true },
    htmlSource: styledHome,
    project: {
      entryPath: 'index.html',
      files: [{ path: 'index.html', kind: 'html' as const, content: styledHome }],
    },
  })
  assert.match(byDevice.desktopStyles, /pw-header\{background:#c2410c\}/)
  assert.match(byDevice.desktopStyles, /data-pw-home-chrome-css/)
})

test('VISUAL_HOME_CHROME_SPLIT_CSS uses display:contents so sticky header pins to the page', () => {
  assert.match(VISUAL_HOME_CHROME_SPLIT_CSS, /\.pw-visual-mobile\{display:contents!important\}/)
  assert.match(VISUAL_HOME_CHROME_SPLIT_CSS, /\.pw-visual-tablet\{display:contents!important\}/)
  assert.match(VISUAL_HOME_CHROME_SPLIT_CSS, /\.pw-visual-laptop\{display:contents!important\}/)
  assert.match(VISUAL_HOME_CHROME_SPLIT_CSS, /\.pw-visual-desktop\{display:contents!important\}/)
  assert.equal(VISUAL_HOME_CHROME_SPLIT_CSS.includes('{display:block!important}'), false)
  assert.match(VISUAL_HOME_CHROME_SPLIT_CSS, /\.pw-visual-desktop,.pw-visual-laptop,.pw-visual-tablet,.pw-visual-mobile\{display:none!important\}/)
})

test('pickVisualHomeChrome falls back to desktop when tablet is missing', () => {
  const byDevice = visualHomeChromeByDevice({
    theme: { ...DEFAULT_PARTNER_WEBSITE_THEME, useVisualHtml: true },
    htmlSource: deskHome,
    project: {
      entryPath: 'index.html',
      files: [{ path: 'index.html', kind: 'html' as const, content: deskHome }],
    },
  })
  const tablet = pickVisualHomeChrome(byDevice, 'tablet')
  assert.ok(tablet)
  assert.match(tablet.header, /DeskHead/)
  assert.match(visualChromeBeforeMain(tablet), /DeskTop/)
  assert.match(visualChromeAfterMain(tablet), /DeskFoot/)
})
