import assert from 'node:assert/strict'
import test from 'node:test'
import { parseHTML } from 'linkedom'
import {
  PARTNER_SHOP_HIDDEN_CSS,
  PARTNER_SHOP_STAY_SCROLL_CSS,
  PARTNER_SHOP_STAY_SCROLL_SCRIPT,
  PW_HIDDEN_ATTR,
  PW_STAY_SCROLL_ATTR,
  PW_STAY_SCROLL_LAYER_ATTR,
  PW_STAY_SCROLL_SCRIPT_ID,
  PW_STAY_SCROLL_X_ATTR,
  PW_STAY_SCROLL_Y_ATTR,
  prepareVisualDomForStore,
  rehomeInflowSceneChromeInDocument,
  restoreLiveChromePins,
  restoreStayScrollPins,
} from '@/lib/partner-website/shop/stay-scroll-elements'

test('stay-scroll keeps the element in place without floating overlay', () => {
  assert.equal(PW_STAY_SCROLL_ATTR, 'data-pw-stay-scroll')
  assert.equal(PW_STAY_SCROLL_X_ATTR, 'data-pw-stay-x')
  assert.equal(PW_STAY_SCROLL_Y_ATTR, 'data-pw-stay-y')
  assert.equal(PW_STAY_SCROLL_SCRIPT_ID, 'pw-shop-stay-scroll')
  assert.equal(PARTNER_SHOP_STAY_SCROLL_CSS.includes(PW_STAY_SCROLL_ATTR), true)
  assert.equal(PARTNER_SHOP_STAY_SCROLL_SCRIPT.includes('restackLayer'), false)
  assert.equal(PW_STAY_SCROLL_LAYER_ATTR, 'data-pw-stay-layer')
  assert.equal(PARTNER_SHOP_STAY_SCROLL_SCRIPT.includes('document.body.appendChild'), false)
  assert.equal(PARTNER_SHOP_STAY_SCROLL_SCRIPT.includes('document.documentElement.insertBefore'), false)
  assert.equal(PARTNER_SHOP_STAY_SCROLL_SCRIPT.includes('host.insertBefore(layer, visual)'), true)
  assert.equal(PARTNER_SHOP_STAY_SCROLL_SCRIPT.includes('data-pw-live-fixed-layer'), true)
  assert.equal(PARTNER_SHOP_STAY_SCROLL_SCRIPT.includes("PLACEMENT, 'viewport-fixed'"), true)
  assert.equal(PARTNER_SHOP_STAY_SCROLL_SCRIPT.includes('data-pw-fixed-x'), true)
  assert.equal(PARTNER_SHOP_STAY_SCROLL_SCRIPT.includes('data-pw-fixed-y'), true)
  assert.equal(PARTNER_SHOP_STAY_SCROLL_SCRIPT.includes("position', 'fixed'"), true)
  assert.equal(PARTNER_SHOP_STAY_SCROLL_SCRIPT.includes('addEventListener(\'scroll\''), false)
  assert.equal(PARTNER_SHOP_STAY_SCROLL_CSS.includes('position:fixed'), true)
  assert.equal(PARTNER_SHOP_STAY_SCROLL_CSS.includes(PW_STAY_SCROLL_LAYER_ATTR), true)
  assert.equal(PARTNER_SHOP_STAY_SCROLL_CSS.includes('display:contents'), true)
  assert.equal(PARTNER_SHOP_STAY_SCROLL_CSS.includes('z-index:210'), false)
  assert.equal(PARTNER_SHOP_STAY_SCROLL_CSS.includes('[data-pw-stay-scroll="1"][data-pw-scene="1"]{z-index:100!important}'), true)
  assert.equal(PARTNER_SHOP_STAY_SCROLL_CSS.includes('[data-pw-stay-layer="1"]>[data-pw-scene="4"]{z-index:400!important}'), true)
  assert.equal(PARTNER_SHOP_STAY_SCROLL_CSS.includes('pointer-events:none'), true)
  assert.equal(PARTNER_SHOP_STAY_SCROLL_CSS.includes('[data-pw-stay-scroll="1"][data-pw-added-bg="1"]{pointer-events:none!important}'), true)
  assert.equal(PARTNER_SHOP_STAY_SCROLL_SCRIPT.includes('scene *'), true)
  assert.equal(PARTNER_SHOP_STAY_SCROLL_SCRIPT.includes('rehomeInflowSceneChrome'), true)
  assert.equal(PARTNER_SHOP_STAY_SCROLL_SCRIPT.includes('escapeHigherScenes'), false)
  assert.equal(typeof rehomeInflowSceneChromeInDocument, 'function')
  assert.equal(typeof prepareVisualDomForStore, 'function')
  assert.equal(PARTNER_SHOP_STAY_SCROLL_CSS.includes('body:not(.nanoai-ve-active)'), false)
  assert.equal(PARTNER_SHOP_STAY_SCROLL_SCRIPT.includes('__pwStayScrollCapture'), true)
  assert.equal(PARTNER_SHOP_STAY_SCROLL_SCRIPT.includes('ensurePlaceholder'), true)
  assert.equal(PARTNER_SHOP_STAY_SCROLL_SCRIPT.includes('data-pw-stay-w'), true)
  assert.equal(PARTNER_SHOP_STAY_SCROLL_SCRIPT.includes('data-pw-stay-h'), true)
  assert.equal(PARTNER_SHOP_STAY_SCROLL_CSS.includes('data-pw-stay-ph-slot'), true)
  assert.equal(PW_HIDDEN_ATTR, 'data-pw-hidden')
  assert.equal(PARTNER_SHOP_HIDDEN_CSS.includes('[data-pw-hidden="1"]'), true)
  assert.equal(PARTNER_SHOP_HIDDEN_CSS.includes('{display:none!important}'), true)
  assert.equal(
    PARTNER_SHOP_HIDDEN_CSS.includes(
      '.pw-header-actions [data-pw-chrome-kit="1"][data-pw-chrome-style="icon-label-below"][data-pw-hidden="1"]'
    ),
    true
  )
  assert.equal(PARTNER_SHOP_STAY_SCROLL_SCRIPT.includes('--pw-scene-w'), true)
  assert.equal(PARTNER_SHOP_STAY_SCROLL_SCRIPT.includes('--pw-scene-zoom'), true)
  assert.equal(PARTNER_SHOP_STAY_SCROLL_SCRIPT.includes('data-pw-inline-visual-root'), true)
  assert.equal(PARTNER_SHOP_STAY_SCROLL_SCRIPT.includes("querySelector('[data-pw-inline-visual-root]')"), true)
  assert.equal(PARTNER_SHOP_STAY_SCROLL_SCRIPT.includes("if (document.querySelector('[data-pw-inline-visual-root]')) return"), false)
  assert.equal(PARTNER_SHOP_STAY_SCROLL_SCRIPT.includes("left', x + '%'"), false)
  assert.equal(typeof restoreStayScrollPins, 'function')
  assert.equal(typeof restoreLiveChromePins, 'function')
})

test('prepareVisualDomForStore clears auto search width but keeps user-sized search width', () => {
  const { document, window } = parseHTML(`<!doctype html><html><body>
    <header>
      <div class="pw-header-search" data-pw-el="search" data-pw-search-width="280" style="width:280px;flex:0 0 auto"></div>
      <div class="pw-header-search" data-pw-el="search" data-pw-search-width="260" data-pw-search-width-user="1" style="width:260px;flex:0 0 auto"></div>
    </header>
  </body></html>`)
  const prevDocumentCtor = (globalThis as { Document?: unknown }).Document
  ;(globalThis as { Document?: unknown }).Document = window.Document
  try {
    prepareVisualDomForStore(document)
  } finally {
    ;(globalThis as { Document?: unknown }).Document = prevDocumentCtor
  }
  const all = Array.from(document.querySelectorAll('.pw-header-search'))
  const autoSized = all[0] as HTMLElement
  const userSized = all[1] as HTMLElement

  assert.equal(autoSized.getAttribute('data-pw-search-width'), null)
  assert.equal(autoSized.getAttribute('data-pw-search-width-user'), null)
  assert.equal(autoSized.style.width, '')
  assert.equal(autoSized.style.flex, '')

  assert.equal(userSized.getAttribute('data-pw-search-width'), '260')
  assert.equal(userSized.getAttribute('data-pw-search-width-user'), '1')
})

test('prepareVisualDomForStore keeps an intentionally moved category at its new coordinates', () => {
  const { document, window } = parseHTML(`<!doctype html><html><body>
    <header><div class="pw-brand-cluster"></div></header>
    <main>
      <button id="moved-category" data-pw-chrome-btn="categories"
        data-pw-user-move="1" data-pw-placement="scene-absolute"
        data-pw-box-x="184" data-pw-box-y="260"
        style="position:absolute;left:calc(50% + 120px);top:240px">Danh mục</button>
    </main>
  </body></html>`)
  const prevDocumentCtor = (globalThis as { Document?: unknown }).Document
  ;(globalThis as { Document?: unknown }).Document = window.Document
  try {
    prepareVisualDomForStore(document)
  } finally {
    ;(globalThis as { Document?: unknown }).Document = prevDocumentCtor
  }

  const moved = document.querySelector('#moved-category') as HTMLElement
  assert.equal(moved.parentElement?.tagName, 'MAIN')
  assert.equal(moved.getAttribute('data-pw-user-move'), '1')
  assert.equal(moved.getAttribute('data-pw-placement'), 'scene-absolute')
  assert.equal(moved.getAttribute('data-pw-box-x'), '184')
  assert.equal(moved.style.top, '240px')
  assert.equal(PARTNER_SHOP_STAY_SCROLL_SCRIPT.includes("if (el.getAttribute(PLACEMENT)) continue"), true)
})

test('prepareVisualDomForStore puts escaped float icons back into the kit host', () => {
  const { document, window } = parseHTML(`<!doctype html><html><body>
    <aside data-pw-chrome-kit="float" data-pw-float-right="24" data-pw-float-size="32"></aside>
    <button id="chat" data-pw-chrome-btn="chat" data-pw-chrome-float="1" data-pw-chrome-kit="1"
      data-pw-btn-color="#111111" data-pw-placement="viewport-fixed" style="position:fixed;right:16px;--pw-btn-color:#111111">Chat</button>
  </body></html>`)
  const prevDocumentCtor = (globalThis as { Document?: unknown }).Document
  ;(globalThis as { Document?: unknown }).Document = window.Document
  try {
    prepareVisualDomForStore(document)
  } finally {
    ;(globalThis as { Document?: unknown }).Document = prevDocumentCtor
  }
  const chat = document.querySelector('#chat') as HTMLElement
  const kit = document.querySelector('[data-pw-chrome-kit="float"]')
  assert.equal(chat.parentElement, kit)
  assert.equal(chat.getAttribute('data-pw-btn-color'), '#111111')
  assert.equal(chat.style.getPropertyValue('--pw-btn-color'), '#111111')
  assert.equal(chat.getAttribute('data-pw-placement'), null)
  assert.equal(chat.style.position, '')
})
