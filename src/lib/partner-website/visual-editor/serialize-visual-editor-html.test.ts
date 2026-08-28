import assert from 'node:assert/strict'
import test from 'node:test'
import { parseHTML } from 'linkedom'
import { serializeVisualEditorHtml } from './serialize-visual-editor-html'

const fixture = `<!doctype html>
<html data-pw-edit-device="desktop">
  <head><meta charset="utf-8"><style>.box{color:red}</style></head>
  <body>
    <header class="pw-header" data-pw-region="header"><span>Header</span></header>
    <main>
      <div id="box" class="box nanoai-ve-selected" data-pw-added-text="1"
        data-pw-canvas-x="120" data-pw-canvas-y="240" data-pw-canvas-w="160"
        data-pw-canvas-h="48" style="position:absolute;left:120px;top:240px">Box</div>
      <button id="fixed" data-pw-added-btn="1" data-pw-stay-scroll="1"
        data-pw-stay-x="75" data-pw-stay-y="20" data-pw-stay-w="96"
        data-pw-stay-h="44" style="position:fixed;left:75%;top:20%">Fixed</button>
    </main>
    <footer class="pw-footer" data-pw-region="footer" data-pw-footer="full">Footer</footer>
    <script id="nanoai-visual-editor-script">window.editorOnly = true</script>
  </body>
</html>`

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

test('visual serializer is idempotent and keeps authored geometry canonical', () => {
  const first = serializeVisualEditorHtml(parseForSerializer(fixture), 'desktop')
  const second = serializeVisualEditorHtml(parseForSerializer(first), 'desktop')

  const diffAt = Array.from({ length: Math.max(first.length, second.length) }).findIndex(
    (_, index) => first[index] !== second[index]
  )
  assert.ok(
    second === first,
    `first byte diff at ${diffAt}: ${JSON.stringify(first.slice(diffAt - 80, diffAt + 120))} !== ${JSON.stringify(second.slice(diffAt - 80, diffAt + 120))}`
  )
  assert.match(first, /data-pw-coordinate-version="4"/)
  assert.match(first, /id="box"[^>]*data-pw-placement="scene-absolute"/)
  assert.match(first, /id="box"[^>]*data-pw-box-x="-520"/)
  assert.match(first, /id="fixed"[^>]*data-pw-placement="viewport-fixed"/)
  assert.doesNotMatch(first, /data-pw-(?:canvas|stay)-(?:x|y|w|h|xu|yu)=/)
  const persisted = parseHTML(first).document
  assert.equal(persisted.querySelector('.nanoai-ve-selected'), null)
  assert.equal(persisted.querySelector('#nanoai-visual-editor-script'), null)
})

test('visual serializer drops hydrated runtime CSS and canonicalizes floating chrome to body', () => {
  const html = `<!doctype html><html><head>
    <style id="pw-catalog-card-css">.runtime{color:red}</style>
    <style id="pw-related-css">.runtime{color:blue}</style>
    <style id="pw-outfit-css">.runtime{color:green}</style>
  </head><body><main>
    <button id="chat" data-pw-chrome-btn="chat" data-pw-chrome-float="1">Chat</button>
  </main></body></html>`
  const saved = serializeVisualEditorHtml(parseForSerializer(html), 'mobile')
  const persisted = parseHTML(saved).document

  assert.equal(persisted.querySelector('#pw-catalog-card-css'), null)
  assert.equal(persisted.querySelector('#pw-related-css'), null)
  assert.equal(persisted.querySelector('#pw-outfit-css'), null)
  assert.equal(persisted.querySelector('#chat')?.parentElement?.tagName, 'BODY')
})

test('visual serializer overwrites stale coordinates with the element current screen position', () => {
  const doc = parseForSerializer(`<!doctype html>
    <html data-pw-edit-device="desktop" data-pw-coordinate-version="4"><body>
      <main id="scene" data-pw-scene-root="1">
        <h1 id="moved" data-pw-el="title" data-pw-user-move="1"
          data-pw-placement="scene-absolute" data-pw-box-x="-500" data-pw-box-y="120"
          data-pw-box-w="100" data-pw-box-h="40"
          style="position:absolute;left:100px;top:100px;transform:translate(400px,200px)">Moved</h1>
      </main>
    </body></html>`)
  const scene = doc.querySelector('#scene') as HTMLElement
  const moved = doc.querySelector('#moved') as HTMLElement
  scene.getBoundingClientRect = () =>
    ({ left: 0, top: 72, width: 1440, height: 900, right: 1440, bottom: 972 }) as DOMRect
  moved.getBoundingClientRect = () =>
    ({ left: 500, top: 300, width: 100, height: 40, right: 600, bottom: 340 }) as DOMRect

  const saved = serializeVisualEditorHtml(doc, 'desktop')
  const tag = saved.match(/<h1\b[^>]*id="moved"[^>]*>/)?.[0] || ''
  assert.match(tag, /data-pw-box-x="-170"/)
  assert.match(tag, /data-pw-box-y="248"/)
  assert.match(tag, /data-pw-box-w="100"/)
  assert.match(tag, /data-pw-box-h="40"/)
  assert.match(tag, /data-pw-coordinate-root="scene"/)
  assert.doesNotMatch(tag, /translate\(/)
  assert.equal(doc.querySelector('#moved')?.parentElement, scene)
})

test('visual serializer keeps a header logo in the header even when zoomed image overflows', () => {
  const doc = parseForSerializer(`<!doctype html>
    <html data-pw-edit-device="desktop" data-pw-coordinate-version="4"><body>
      <header class="pw-header"><div class="pw-header-main">
        <div class="pw-brand-cluster">
          <a class="pw-brand" href="/"><span class="pw-wordmark">188.com.vn</span></a>
          <span id="logo" class="pw-logo-frame" data-pw-logo-frame="1" data-pw-logo-float="1" data-pw-user-move="1"
            style="position:absolute;left:16px;top:8px;width:120px;height:36px">
            <img class="pw-logo" src="https://cdn.example/logo.png" alt="logo" data-pw-user-move="1"
              data-pw-logo-zoom="3" data-pw-logo-pan-x="12" data-pw-logo-pan-y="-8"
              style="transform:translate(12px,-8px) scale(3)"/>
          </span>
        </div>
      </div></header>
      <main id="scene" data-pw-scene-root="1"></main>
    </body></html>`)
  const scene = doc.querySelector('#scene') as HTMLElement
  const logo = doc.querySelector('#logo') as HTMLElement
  const img = doc.querySelector('img.pw-logo') as HTMLElement
  const header = doc.querySelector('header') as HTMLElement
  scene.getBoundingClientRect = () =>
    ({ left: 0, top: 96, width: 1440, height: 900, right: 1440, bottom: 996 }) as DOMRect
  header.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: 1440, height: 96, right: 1440, bottom: 96 }) as DOMRect
  logo.getBoundingClientRect = () =>
    ({ left: 16, top: 8, width: 120, height: 36, right: 136, bottom: 44 }) as DOMRect
  img.getBoundingClientRect = () =>
    ({ left: -40, top: -40, width: 360, height: 108, right: 320, bottom: 68 }) as DOMRect

  const saved = serializeVisualEditorHtml(doc, 'desktop')
  const savedBody = saved.replace(/<style[\s\S]*?<\/style>/gi, '')
  assert.match(savedBody, /https:\/\/cdn\.example\/logo\.png/)
  assert.match(savedBody, /<a class="pw-brand"[^>]*>[\s\S]*pw-logo-frame/)
  assert.doesNotMatch(savedBody, /data-pw-placement="scene-absolute"/)
  assert.doesNotMatch(savedBody, /data-pw-logo-float="1"/)
  assert.equal(doc.querySelector('#logo')?.closest('header') != null, true)
  assert.equal(doc.querySelector('#logo')?.parentElement === scene, false)
})

test('visual serializer keeps stock header chrome that still overlaps the header', () => {
  const doc = parseForSerializer(`<!doctype html>
    <html data-pw-edit-device="desktop" data-pw-coordinate-version="4"><body>
      <header><div class="pw-header-main">
        <a id="account" data-pw-chrome-btn="account" data-pw-user-move="1"
          data-pw-placement="scene-absolute" data-pw-box-x="120" data-pw-box-y="48"
          data-pw-box-w="110" data-pw-box-h="30"
          style="position:absolute;left:calc(50% + 65px);top:33px">Account</a>
      </div></header>
      <main id="scene" data-pw-scene-root="1"></main>
    </body></html>`)
  const scene = doc.querySelector('#scene') as HTMLElement
  const account = doc.querySelector('#account') as HTMLElement
  const header = doc.querySelector('header') as HTMLElement
  const headerMain = doc.querySelector('.pw-header-main') as HTMLElement
  scene.getBoundingClientRect = () =>
    ({ left: 0, top: 120, width: 1440, height: 900, right: 1440, bottom: 1020 }) as DOMRect
  header.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: 1440, height: 120, right: 1440, bottom: 120 }) as DOMRect
  headerMain.getBoundingClientRect = () =>
    ({ left: 120, top: 30, width: 1200, height: 80, right: 1320, bottom: 110 }) as DOMRect
  account.getBoundingClientRect = () =>
    ({ left: 1010, top: 64, width: 110, height: 30, right: 1120, bottom: 94 }) as DOMRect

  const saved = serializeVisualEditorHtml(doc, 'desktop')
  const tag = saved.match(/<a\b[^>]*id="account"[^>]*>/)?.[0] || ''
  assert.match(tag, /data-pw-box-x="120"/)
  assert.match(tag, /data-pw-box-y="48"/)
  assert.match(tag, /data-pw-box-w="110"/)
  assert.equal(doc.querySelector('#account')?.parentElement, headerMain)
})

test('visual serializer measures body-level loose chrome from the scene root', () => {
  const doc = parseForSerializer(`<!doctype html>
    <html data-pw-edit-device="desktop" data-pw-coordinate-version="4"><body>
      <header style="height:100px"></header>
      <main id="scene" data-pw-scene-root="1"></main>
      <a id="account" data-pw-chrome-btn="account" data-pw-chrome-added="1"
        data-pw-user-move="1" data-pw-placement="scene-absolute"
        data-pw-box-x="0" data-pw-box-y="0" data-pw-box-w="100" data-pw-box-h="30">Account</a>
    </body></html>`)
  const scene = doc.querySelector('#scene') as HTMLElement
  const account = doc.querySelector('#account') as HTMLElement
  const body = doc.body as HTMLElement
  scene.getBoundingClientRect = () =>
    ({ left: 0, top: 100, width: 1440, height: 900, right: 1440, bottom: 1000 }) as DOMRect
  body.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: 1440, height: 1000, right: 1440, bottom: 1000 }) as DOMRect
  account.getBoundingClientRect = () =>
    ({ left: 900, top: 60, width: 100, height: 30, right: 1000, bottom: 90 }) as DOMRect

  const saved = serializeVisualEditorHtml(doc, 'desktop')
  const tag = saved.match(/<a\b[^>]*id="account"[^>]*>/)?.[0] || ''
  assert.match(tag, /data-pw-box-x="230"/)
  assert.match(tag, /data-pw-box-y="-25"/)
  assert.match(tag, /data-pw-coordinate-root="scene"/)
  assert.equal(doc.querySelector('#account')?.parentElement, scene)
})

test('visual serializer keeps a floating overlay on the scene root with its scene layer', () => {
  const doc = parseForSerializer(`<!doctype html>
    <html data-pw-edit-device="desktop" data-pw-coordinate-version="4"><body>
      <header class="pw-header"></header>
      <main id="scene" data-pw-scene-root="1">
        <div id="bg" data-pw-added-bg="1" data-pw-scene="1">
          <div id="float" data-pw-added-text="1" data-pw-scene="4" data-pw-user-move="1"
            data-pw-placement="scene-absolute" data-pw-box-x="0" data-pw-box-y="200"
            data-pw-box-w="160" data-pw-box-h="40">Nổi</div>
        </div>
      </main>
    </body></html>`)
  const scene = doc.querySelector('#scene') as HTMLElement
  const overlay = doc.querySelector('#float') as HTMLElement
  scene.getBoundingClientRect = () =>
    ({ left: 0, top: 80, width: 1440, height: 900, right: 1440, bottom: 980 }) as DOMRect
  overlay.getBoundingClientRect = () =>
    ({ left: 640, top: 260, width: 160, height: 40, right: 800, bottom: 300 }) as DOMRect

  const saved = serializeVisualEditorHtml(doc, 'desktop')
  const tag = saved.match(/<div\b[^>]*id="float"[^>]*>/)?.[0] || ''
  assert.match(tag, /data-pw-scene="4"/)
  assert.match(tag, /data-pw-coordinate-root="scene"/)
  assert.match(tag, /data-pw-box-x="0"/)
  assert.match(tag, /data-pw-box-y="200"/)
  assert.equal(doc.querySelector('#float')?.parentElement, scene)
})
