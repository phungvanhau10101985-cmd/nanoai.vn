import assert from 'node:assert/strict'
import test from 'node:test'
import { parseHTML } from 'linkedom'
import { hashShopCachePayload } from '@/lib/cache/partner-shop-cache'
import { renderPartnerVisualHtmlForPublic } from '@/lib/partner-website/shop/render-partner-visual-html'
import { DEFAULT_PARTNER_WEBSITE_THEME } from '@/lib/partner-website/template/partner-website-template-types'
import {
  finalizeVisualEditorSave,
  visualHomeHtmlSourceAfterSave,
} from './finalize-visual-editor-save'
import { serializeVisualEditorHtml } from './serialize-visual-editor-html'
import {
  applyVisualEditThemeFlag,
  visualEditorHtmlPath,
  type VisualDeviceVariant,
} from './visual-editor-pages'

const DEVICES: VisualDeviceVariant[] = ['desktop', 'laptop', 'tablet', 'mobile']

function fixture(device: VisualDeviceVariant): string {
  return `<!doctype html>
<html lang="vi" data-pw-edit-device="${device}">
<head><meta charset="utf-8"><style>#box{background:#2463a8;color:#fff}</style></head>
<body data-pw-page="home">
  <header class="pw-header" data-pw-region="header"><strong>${device}</strong></header>
  <main>
    <div id="box" data-pw-added-text="1" data-pw-user-move="1"
      data-pw-canvas-x="91" data-pw-canvas-y="173" data-pw-canvas-w="184"
      data-pw-canvas-h="56" style="position:absolute;left:91px;top:173px;width:184px;height:56px">Box</div>
    <button id="fixed" data-pw-added-btn="1" data-pw-stay-scroll="1"
      data-pw-stay-x="70" data-pw-stay-y="20" data-pw-stay-w="96"
      data-pw-stay-h="44" style="position:fixed;left:70%;top:20%;width:96px;height:44px">Fixed</button>
  </main>
  <footer class="pw-footer" data-pw-region="footer" data-pw-footer="full">Footer</footer>
</body>
</html>`
}

function parseForSerializer(html: string): Document {
  const parsed = parseHTML(html)
  const globals = globalThis as typeof globalThis & {
    window?: unknown
    document?: unknown
    Node?: unknown
    HTMLElement?: unknown
    HTMLInputElement?: unknown
  }
  globals.window = parsed.window
  globals.document = parsed.document
  globals.Node = parsed.window.Node
  globals.HTMLElement = parsed.window.HTMLElement
  globals.HTMLInputElement = parsed.window.HTMLInputElement
  return parsed.document as unknown as Document
}

test('the route save transition is byte-idempotent on every device and feeds public render', () => {
  for (const device of DEVICES) {
    const htmlPath = visualEditorHtmlPath('home', device)
    const source = fixture(device)
    const firstSerialized = serializeVisualEditorHtml(parseForSerializer(source), device)
    const first = finalizeVisualEditorSave({
      project: {
        entryPath: htmlPath,
        files: [{ path: htmlPath, kind: 'html', content: source }],
      },
      theme: applyVisualEditThemeFlag(DEFAULT_PARTNER_WEBSITE_THEME, {
        pageKey: 'home',
        variant: device,
      }),
      htmlPath,
      sourceHtml: firstSerialized,
      visualDevice: device,
    })
    const secondSerialized = serializeVisualEditorHtml(
      parseForSerializer(first.canonicalHtml),
      device
    )
    const second = finalizeVisualEditorSave({
      project: first.project,
      theme: first.theme,
      htmlPath,
      sourceHtml: secondSerialized,
      visualDevice: device,
    })

    assert.equal(second.canonicalHtml, first.canonicalHtml, `${device} canonical HTML drifted`)
    assert.deepEqual(second.project, first.project, `${device} project drifted on second save`)
    assert.equal(
      hashShopCachePayload(second.canonicalHtml),
      hashShopCachePayload(first.canonicalHtml),
      `${device} sourceHash drifted`
    )
    assert.match(first.canonicalHtml, /data-pw-coordinate-version="4"/)
    assert.match(first.canonicalHtml, /id="box"[^>]*data-pw-placement="scene-absolute"/)
    assert.match(first.canonicalHtml, /id="fixed"[^>]*data-pw-placement="viewport-fixed"/)
    assert.doesNotMatch(first.canonicalHtml, /data-pw-(?:canvas|stay)-(?:x|y|w|h|xu|yu)=/)

    const live = renderPartnerVisualHtmlForPublic(
      {
        siteSlug: `parity-${device}`,
        locale: 'vi',
        theme: second.theme,
        project: second.project,
        htmlSource: device === 'desktop' ? second.canonicalHtml : null,
      },
      { kind: 'page', pageKey: 'home' },
      { device }
    )
    assert.match(live, new RegExp(`data-pw-(?:edit-device|scene-lock)="${device}"`))
    assert.match(live, /id="box"/)
    assert.match(live, /id="fixed"/)
  }
})

test('saving another page or device keeps htmlSource mirrored to Desktop index', () => {
  const desktopHome = fixture('desktop').replace('>Box<', '>Desktop canonical home<')
  const mobileAbout = fixture('mobile')
    .replace('data-pw-page="home"', 'data-pw-page="info"')
    .replace('>Box<', '>Mobile about page<')
  const finalized = finalizeVisualEditorSave({
    project: {
      entryPath: 'index.html',
      files: [
        { path: 'index.html', kind: 'html', content: desktopHome },
        { path: 'about.mobile.html', kind: 'html', content: mobileAbout },
      ],
    },
    theme: applyVisualEditThemeFlag(DEFAULT_PARTNER_WEBSITE_THEME, {
      pageKey: 'about',
      variant: 'mobile',
    }),
    htmlPath: 'about.mobile.html',
    sourceHtml: mobileAbout,
    visualDevice: 'mobile',
  })

  const htmlSource = visualHomeHtmlSourceAfterSave(finalized, 'stale mirror')
  assert.match(htmlSource || '', /Desktop canonical home/)
  assert.doesNotMatch(htmlSource || '', /Mobile about page/)
})

test('saving mobile home keeps seeded desktop laptop and tablet files', () => {
  const desktop = fixture('desktop').replace('>Box<', '>DESKTOP-ORIGIN<')
  const laptop = fixture('laptop').replace('>Box<', '>LAPTOP-ORIGIN<')
  const tablet = fixture('tablet').replace('>Box<', '>TABLET-ORIGIN<')
  const mobileOrigin = fixture('mobile').replace('>Box<', '>MOBILE-ORIGIN<')
  const mobileEdited = fixture('mobile').replace('>Box<', '>MOBILE-EDITED<')
  const finalized = finalizeVisualEditorSave({
    project: {
      entryPath: 'index.html',
      files: [
        { path: 'index.html', kind: 'html', content: desktop },
        { path: 'index.laptop.html', kind: 'html', content: laptop },
        { path: 'index.tablet.html', kind: 'html', content: tablet },
        { path: 'index.mobile.html', kind: 'html', content: mobileOrigin },
      ],
    },
    theme: applyVisualEditThemeFlag(DEFAULT_PARTNER_WEBSITE_THEME, {
      pageKey: 'home',
      variant: 'mobile',
    }),
    htmlPath: 'index.mobile.html',
    sourceHtml: mobileEdited,
    visualDevice: 'mobile',
  })

  const file = (path: string) =>
    finalized.project.files.find((entry) => entry.path === path)?.content || ''
  assert.match(file('index.mobile.html'), /MOBILE-EDITED/)
  assert.match(file('index.html'), /DESKTOP-ORIGIN/)
  assert.match(file('index.laptop.html'), /LAPTOP-ORIGIN/)
  assert.match(file('index.tablet.html'), /TABLET-ORIGIN/)
  assert.doesNotMatch(file('index.html'), /MOBILE-EDITED/)
  assert.doesNotMatch(file('index.laptop.html'), /MOBILE-EDITED/)
  assert.doesNotMatch(file('index.tablet.html'), /MOBILE-EDITED/)
  const htmlSource = visualHomeHtmlSourceAfterSave(finalized, desktop)
  assert.match(htmlSource || '', /DESKTOP-ORIGIN/)
  assert.doesNotMatch(htmlSource || '', /MOBILE-EDITED/)
})

