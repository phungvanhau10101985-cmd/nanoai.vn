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
  assert.match(first, /data-pw-coordinate-version="2"/)
  assert.match(first, /id="box"[^>]*data-pw-placement="scene-absolute"/)
  assert.match(first, /id="box"[^>]*data-pw-box-x="120"/)
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
