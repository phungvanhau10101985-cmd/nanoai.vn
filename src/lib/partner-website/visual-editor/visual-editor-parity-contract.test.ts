import assert from 'node:assert/strict'
import test from 'node:test'
import { preparePartnerVisualHtmlForEditor, preparePartnerVisualHtmlForPublic } from '../shop/render-partner-visual-html'
import { DEFAULT_PARTNER_WEBSITE_THEME } from '../template/partner-website-template-types'
import {
  ensureVisualHtmlLiveReady,
  isolateVisualHtmlForDevice,
  type VisualDeviceVariant,
} from './visual-editor-pages'

const DEVICES: VisualDeviceVariant[] = ['desktop', 'laptop', 'tablet', 'mobile']

function parityFixture(device: VisualDeviceVariant): string {
  return `<!DOCTYPE html>
<html lang="vi" data-pw-edit-device="${device}" data-pw-scene-lock="${device}">
<head><meta charset="utf-8"><style>.merchant-copy{letter-spacing:.01em}</style></head>
<body data-pw-page="home">
  <header class="pw-header" data-pw-region="header">
    <div class="pw-header-main">
      <img id="logo" class="pw-logo" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" alt="Logo" data-pw-logo-float="1" data-pw-user-move="1" style="position:absolute;left:42px;top:9px;width:88px;height:40px">
    </div>
  </header>
  <main id="pw-main" style="position:relative;min-height:900px">
    <div id="added-bg" data-pw-added-bg="1" data-pw-scene="1" data-pw-bg-index="2" data-pw-user-move="1" style="position:absolute;left:115px;top:230px;width:360px;height:180px;z-index:2"></div>
    <button id="added-button" data-pw-added-btn="1" data-pw-chrome-added="1" data-pw-device="${device}" data-pw-scene="3" data-pw-user-move="1" style="position:absolute;left:510px;top:275px;width:132px;height:44px;z-index:300">CTA</button>
    <button id="stay" data-pw-added-btn="1" data-pw-stay-scroll="1" data-pw-stay-x="72.5" data-pw-stay-y="64" data-pw-stay-w="54" data-pw-stay-h="54" data-pw-scene="4">Stay</button>
  </main>
  <footer class="pw-footer" data-pw-region="footer">Footer</footer>
</body>
</html>`
}

function openTag(html: string, id: string): string {
  const safe = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return html.match(new RegExp(`<[^>]+\\bid=["']${safe}["'][^>]*>`, 'i'))?.[0] || ''
}

function attr(tag: string, name: string): string {
  const safe = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return tag.match(new RegExp(`\\b${safe}=["']([^"']*)["']`, 'i'))?.[1] || ''
}

function styleGeometry(tag: string): Record<string, string> {
  const style = attr(tag, 'style')
  const wanted = new Set(['position', 'left', 'top', 'right', 'bottom', 'width', 'height', 'transform', 'z-index'])
  return Object.fromEntries(
    style
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const i = part.indexOf(':')
        return i < 0 ? ['', ''] : [part.slice(0, i).trim().toLowerCase(), part.slice(i + 1).trim()]
      })
      .filter(([key]) => wanted.has(key))
  )
}

function authoredGeometry(html: string, id: string) {
  const tag = openTag(html, id)
  assert.ok(tag, `missing #${id}`)
  return {
    style: styleGeometry(tag),
    scene: attr(tag, 'data-pw-scene'),
    device: attr(tag, 'data-pw-device'),
    userMove: attr(tag, 'data-pw-user-move'),
    stay: attr(tag, 'data-pw-stay-scroll'),
    stayX: attr(tag, 'data-pw-stay-x'),
    stayY: attr(tag, 'data-pw-stay-y'),
    stayW: attr(tag, 'data-pw-stay-w'),
    stayH: attr(tag, 'data-pw-stay-h'),
  }
}

test('editor and public preparation preserve authored geometry on every device', () => {
  for (const device of DEVICES) {
    const source = parityFixture(device)
    const editor = preparePartnerVisualHtmlForEditor(source, {
      variant: device,
      theme: DEFAULT_PARTNER_WEBSITE_THEME,
      siteSlug: 'parity-shop',
      locale: 'vi',
      pageKey: 'home',
    })
    const live = preparePartnerVisualHtmlForPublic(
      isolateVisualHtmlForDevice(source, device),
      {
        theme: DEFAULT_PARTNER_WEBSITE_THEME,
        siteSlug: 'parity-shop',
        locale: 'vi',
        pageKey: 'home',
      }
    )

    for (const id of ['added-bg', 'added-button', 'stay']) {
      assert.deepEqual(
        authoredGeometry(editor, id),
        authoredGeometry(live, id),
        `${device} #${id} geometry drifted between editor and public preparation`
      )
    }
  }
})

test('live-ready normalization is idempotent and retains authored placement', () => {
  for (const device of DEVICES) {
    const once = ensureVisualHtmlLiveReady(parityFixture(device), device)
    const twice = ensureVisualHtmlLiveReady(once, device)
    assert.equal(twice, once)
    for (const id of ['added-bg', 'added-button', 'stay']) {
      assert.deepEqual(authoredGeometry(twice, id), authoredGeometry(once, id))
    }
  }
})

test('device isolation never leaks a sibling visual document', () => {
  const composed = `<!DOCTYPE html><html><body>
    <div data-pw-visual-device="desktop"><main><div id="desk" style="left:140px"></div></main></div>
    <div data-pw-visual-device="mobile"><main><div id="mob" style="left:14px"></div></main></div>
  </body></html>`
  const desktop = isolateVisualHtmlForDevice(composed, 'desktop')
  const mobile = isolateVisualHtmlForDevice(composed, 'mobile')
  assert.match(desktop, /id="desk"/)
  assert.doesNotMatch(desktop, /id="mob"/)
  assert.match(mobile, /id="mob"/)
  assert.doesNotMatch(mobile, /id="desk"/)
})
