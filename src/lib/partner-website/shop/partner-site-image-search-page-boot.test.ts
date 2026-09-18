import assert from 'node:assert/strict'
import test from 'node:test'
import vm from 'node:vm'
import {
  buildPartnerSiteImageSearchPageBootScript,
  PW_IMAGE_SEARCH_BOOT_EVENT,
  PW_IMAGE_SEARCH_BOOT_KEY,
  PW_IMAGE_SEARCH_BOOT_RUN,
  PW_IMAGE_SEARCH_BOOT_SCRIPT_ID,
  PW_IMAGE_SEARCH_EAGER_ID,
} from '@/lib/partner-website/shop/partner-site-image-search-page-boot'
import { PW_PENDING_IMAGE_EVENT, PW_PENDING_IMAGE_KEY } from '@/lib/partner-website/shop/partner-site-pending-image'

const TINY_JPEG =
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAGfAD//2Q=='

function runBootScript(pathname: string) {
  const store: Record<string, string> = { [PW_PENDING_IMAGE_KEY]: TINY_JPEG }
  const fetches: string[] = []
  const events: string[] = []
  const host: { id: string; hidden: boolean; innerHTML: string } = {
    id: PW_IMAGE_SEARCH_EAGER_ID,
    hidden: true,
    innerHTML: '',
  }
  const context: Record<string, unknown> = {
    location: { pathname, href: `https://gudo.vn${pathname}` },
    sessionStorage: {
      getItem: (key: string) => store[key] ?? '',
      removeItem: (key: string) => {
        delete store[key]
      },
    },
    FormData: class {
      append() {}
    },
    Blob,
    Uint8Array,
    atob,
    Event,
    URL,
    Promise,
    document: {
      readyState: 'complete',
      getElementById: (id: string) => (id === PW_IMAGE_SEARCH_EAGER_ID ? host : null),
      querySelector: () => null,
      createElement: () => host,
      addEventListener() {},
    },
    fetch: (url: string) => {
      fetches.push(url)
      return Promise.resolve({
        json: () => ({ products: [{ id: '1', name: 'Áo', imageUrl: '/a.jpg', detailPath: '/p/1' }] }),
      })
    },
    addEventListener() {},
    dispatchEvent: (ev: Event) => {
      events.push(ev.type)
      return true
    },
  }
  context.window = context
  vm.runInNewContext(buildPartnerSiteImageSearchPageBootScript('188-shop'), context)
  return {
    store,
    fetches,
    events,
    host,
    boot: context[PW_IMAGE_SEARCH_BOOT_KEY],
    run: context[PW_IMAGE_SEARCH_BOOT_RUN],
  }
}

test('image search boot script consumes pending storage and POSTs before React', () => {
  const src = buildPartnerSiteImageSearchPageBootScript('188-shop')
  assert.equal(PW_IMAGE_SEARCH_BOOT_SCRIPT_ID, 'pw-image-search-boot')
  assert.equal(PW_IMAGE_SEARCH_EAGER_ID, 'pw-image-search-eager')
  assert.match(src, new RegExp(PW_PENDING_IMAGE_KEY))
  assert.match(src, new RegExp(PW_IMAGE_SEARCH_BOOT_KEY))
  assert.match(src, new RegExp(PW_IMAGE_SEARCH_BOOT_EVENT))
  assert.match(src, new RegExp(PW_PENDING_IMAGE_EVENT))
  assert.match(src, new RegExp(PW_IMAGE_SEARCH_EAGER_ID))
  assert.match(src, /DOMContentLoaded/)
  assert.match(src, /pageshow/)
  assert.match(src, /innerHTML/)
  assert.match(src, /\/api\/site\/188-shop\/search\/image/)
  assert.match(src, /sessionStorage\.getItem/)
  assert.match(src, /sessionStorage\.removeItem/)
  assert.match(src, /FormData/)
  assert.match(src, /fd\.append\('image'/)
  assert.match(src, /credentials:'same-origin'/)
  assert.match(src, /location\.pathname/)
  assert.match(src, /tim-theo-anh/)
  assert.match(src, /pw-product-card/)
  assert.match(src, /pw-rec-fav/)
  assert.match(src, /pw-rec-stats/)
  assert.match(src, /pw-product-card-hit/)
  assert.match(src, /insertBefore\(host,react\)/)
  assert.match(src, /MutationObserver/)
  assert.match(src, /compareDocumentPosition/)
  assert.doesNotMatch(src, /main\.insertBefore\(host,main\.firstChild/)
  assert.doesNotMatch(src, /useEffect/)
})

test('boot script searches on /tim-theo-anh without waiting for a tap, and ignores other paths', () => {
  const onPage = runBootScript('/site/188-shop/tim-theo-anh')
  assert.equal(onPage.store[PW_PENDING_IMAGE_KEY], undefined)
  assert.equal(onPage.fetches[0], '/api/site/188-shop/search/image')
  assert.equal((onPage.boot as { started?: boolean; loading?: boolean })?.started, true)
  assert.ok(onPage.events.includes(PW_IMAGE_SEARCH_BOOT_EVENT))
  assert.equal(typeof onPage.run, 'function')
  assert.ok(onPage.host.innerHTML.includes('pw-shop-grid'))

  const compose = runBootScript('/site/188-shop/tim-kiem')
  assert.equal(compose.store[PW_PENDING_IMAGE_KEY], TINY_JPEG)
  assert.equal(compose.fetches.length, 0)
  assert.equal(compose.boot, undefined)
})

test('boot script paints listing cards when fetch resolves, without a tap', async () => {
  const onPage = runBootScript('/site/188-shop/tim-theo-anh')
  for (let i = 0; i < 8; i += 1) await Promise.resolve()
  assert.match(onPage.host.innerHTML, /Áo/)
  assert.match(onPage.host.innerHTML, /\/p\/1/)
  assert.match(onPage.host.innerHTML, /pw-product-card/)
  assert.match(onPage.host.innerHTML, /pw-rec-fav/)
  assert.match(onPage.host.innerHTML, /pw-rec-stats/)
  assert.match(onPage.host.innerHTML, /pw-product-card-hit/)
  assert.equal(onPage.host.hidden, false)
})

test('loading paint is idempotent so MutationObserver cannot starve DOMContentLoaded', () => {
  const observerCallbacks: Array<() => void> = []
  let innerHtmlWrites = 0
  let eagerState = ''
  let innerHtml = ''
  const parent = { insertBefore() {} }
  const react = {
    hidden: false,
    parentNode: parent,
    getAttribute: () => '',
  }
  const host = {
    id: PW_IMAGE_SEARCH_EAGER_ID,
    hidden: true,
    parentNode: parent,
    nextSibling: react,
    getAttribute: (name: string) =>
      name === 'data-pw-image-search-eager-state' ? eagerState : '',
    setAttribute: (name: string, value: string) => {
      if (name === 'data-pw-image-search-eager-state') eagerState = value
    },
    compareDocumentPosition: () => 0,
    get innerHTML() {
      return innerHtml
    },
    set innerHTML(value: string) {
      innerHtml = value
      innerHtmlWrites += 1
    },
  }
  const store = { [PW_PENDING_IMAGE_KEY]: TINY_JPEG }
  const context: Record<string, unknown> = {
    location: {
      pathname: '/site/188-shop/tim-theo-anh',
      href: 'https://gudo.vn/site/188-shop/tim-theo-anh',
    },
    sessionStorage: {
      getItem: (key: string) => store[key as keyof typeof store] ?? '',
      removeItem: (key: string) => {
        delete (store as Record<string, string>)[key]
      },
    },
    FormData: class {
      append() {}
    },
    MutationObserver: class {
      constructor(callback: () => void) {
        observerCallbacks.push(callback)
      }
      observe() {}
    },
    Blob,
    Uint8Array,
    atob,
    Event,
    URL,
    Promise,
    Date,
    Math,
    document: {
      readyState: 'loading',
      documentElement: { lang: 'vi' },
      body: {},
      getElementById: (id: string) => (id === PW_IMAGE_SEARCH_EAGER_ID ? host : null),
      querySelector: (sel: string) =>
        String(sel).includes('data-pw-image-search-react') ? react : null,
      createElement: () => host,
      addEventListener() {},
    },
    fetch: () => new Promise(() => {}),
    addEventListener() {},
    dispatchEvent: () => true,
  }
  context.window = context
  vm.runInNewContext(buildPartnerSiteImageSearchPageBootScript('188-shop'), context)
  assert.equal(innerHtmlWrites, 1)
  assert.match(eagerState, /^loading:/)
  for (let i = 0; i < 8; i += 1) observerCallbacks[0]?.()
  assert.equal(innerHtmlWrites, 1)
})

test('boot script relocates a leftover eager host next to the React catalog', () => {
  const children: Array<[unknown, unknown]> = []
  const host: {
    id: string
    hidden: boolean
    innerHTML: string
    nextSibling: { getAttribute?: (name: string) => string } | null
  } = {
    id: PW_IMAGE_SEARCH_EAGER_ID,
    hidden: true,
    innerHTML: '',
    nextSibling: null,
  }
  const react: {
    hidden: boolean
    getAttribute: (name: string) => string
    parentNode?: { insertBefore: (node: unknown, before: unknown) => void }
  } = {
    hidden: false,
    getAttribute: (name: string) => (name === 'data-pw-image-search-react' ? '1' : ''),
  }
  const parent = {
    insertBefore: (node: unknown, before: unknown) => {
      children.push([node, before])
      host.nextSibling = before as typeof host.nextSibling
    },
  }
  const context: Record<string, unknown> = {
    location: { pathname: '/site/188-shop/tim-theo-anh', href: 'https://gudo.vn/site/188-shop/tim-theo-anh' },
    sessionStorage: {
      getItem: (key: string) => (key === PW_PENDING_IMAGE_KEY ? TINY_JPEG : ''),
      removeItem() {},
    },
    FormData: class {
      append() {}
    },
    Blob,
    Uint8Array,
    atob,
    Event,
    URL,
    Promise,
    document: {
      readyState: 'complete',
      documentElement: { lang: 'vi' },
      getElementById: (id: string) => (id === PW_IMAGE_SEARCH_EAGER_ID ? host : null),
      querySelector: (sel: string) => (String(sel).includes('data-pw-image-search-react') ? react : null),
      createElement: () => host,
      addEventListener() {},
    },
    fetch: () => Promise.resolve({ json: () => ({ products: [] }) }),
    addEventListener() {},
    dispatchEvent: () => true,
  }
  react.parentNode = parent
  context.window = context
  vm.runInNewContext(buildPartnerSiteImageSearchPageBootScript('188-shop'), context)
  const run = context[PW_IMAGE_SEARCH_BOOT_RUN] as () => void
  run()
  assert.equal(children.length, 1)
  assert.equal(children[0]?.[0], host)
  assert.equal(children[0]?.[1], react)
})

test('boot script hides a leftover host parked on document.body until the catalog exists', async () => {
  const body = { name: 'body' }
  const host: {
    id: string
    hidden: boolean
    innerHTML: string
    parentNode: typeof body
    nextSibling: null
    compareDocumentPosition: () => number
  } = {
    id: PW_IMAGE_SEARCH_EAGER_ID,
    hidden: false,
    innerHTML: 'parked-above-header',
    parentNode: body,
    nextSibling: null,
    compareDocumentPosition: () => 4,
  }
  const context: Record<string, unknown> = {
    location: { pathname: '/site/188-shop/tim-theo-anh', href: 'https://gudo.vn/site/188-shop/tim-theo-anh' },
    sessionStorage: {
      getItem: (key: string) => (key === PW_PENDING_IMAGE_KEY ? TINY_JPEG : ''),
      removeItem() {},
    },
    FormData: class {
      append() {}
    },
    Blob,
    Uint8Array,
    atob,
    Event,
    URL,
    Promise,
    document: {
      readyState: 'complete',
      documentElement: { lang: 'vi' },
      body,
      getElementById: (id: string) => (id === PW_IMAGE_SEARCH_EAGER_ID ? host : null),
      querySelector: () => null,
      createElement: () => host,
      addEventListener() {},
    },
    fetch: () =>
      Promise.resolve({
        json: () => ({ products: [{ id: '1', name: 'Áo', imageUrl: '/a.jpg', detailPath: '/p/1' }] }),
      }),
    addEventListener() {},
    dispatchEvent: () => true,
  }
  context.window = context
  vm.runInNewContext(buildPartnerSiteImageSearchPageBootScript('188-shop'), context)
  const run = context[PW_IMAGE_SEARCH_BOOT_RUN] as () => void
  run()
  for (let i = 0; i < 8; i += 1) await Promise.resolve()
  assert.equal(host.hidden, true)
  assert.equal(host.innerHTML, 'parked-above-header')
})
