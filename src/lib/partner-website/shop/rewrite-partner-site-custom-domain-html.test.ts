import test from 'node:test'
import assert from 'node:assert/strict'
import { rewritePartnerSiteCustomDomainHtmlPaths } from './rewrite-partner-site-custom-domain-html'
import { buildPartnerSiteVisualNativeNavigationScript } from './partner-site-account-native-navigation'

test('rewrites saved visual chrome links before custom-domain hydration', () => {
  const html = [
    '<a href="/site/demo-shop/account">Account</a>',
    '<a data-pw-account-fallback-href="/site/demo-shop/login?redirect=%2Fsite%2Fdemo-shop%2Faccount">Login</a>',
    '<form action="/site/demo-shop/search"></form>',
    '<a href="/api/site/demo-shop/cart">API</a>',
  ].join('')
  const result = rewritePartnerSiteCustomDomainHtmlPaths(html, 'demo-shop', true)

  assert.match(result, /href="\/account"/)
  assert.match(result, /data-pw-account-fallback-href="\/login\?redirect=/)
  assert.match(result, /action="\/search"/)
  assert.match(result, /href="\/api\/site\/demo-shop\/cart"/)
})

test('keeps platform paths unchanged outside custom domains', () => {
  const html = '<a href="/site/demo-shop/account">Account</a>'
  assert.equal(rewritePartnerSiteCustomDomainHtmlPaths(html, 'demo-shop', false), html)
})

test('inline visual native navigation strips the internal site prefix before navigation', () => {
  const script = buildPartnerSiteVisualNativeNavigationScript('demo-shop')
  assert.match(script, /var PREFIX="\/site\/demo-shop"/)
  assert.match(script, /function onPlatform\(/)
  assert.match(script, /function stripPrefix\(/)
  assert.match(script, /window\.addEventListener\('click'/)
  assert.match(script, /window\.addEventListener\('pointerup'/)
  assert.match(script, /window\.addEventListener\('pointerdown',onPointerDown/)
  assert.doesNotMatch(script, /function onPointerDown\(event\)\{[\s\S]*location\.assign/)
  assert.match(script, /window\.location\.assign\(href\)/)
  assert.match(script, /__pwShopSoftNav/)
  assert.match(script, /function swallow\(/)
  assert.match(script, /stopImmediatePropagation/)
  assert.match(script, /data-pw-chrome-btn=\\?"categories/)
  assert.match(script, /data-nanoai-open-chat/)
  assert.doesNotMatch(script, /if\(event\.defaultPrevented/)
  assert.doesNotMatch(script, /__pwNativeNavGoing/)
})

test('native nav hard-assigns the first click and strips /site prefix on a custom domain', () => {
  const assigned: string[] = []
  const clickFns: Array<(event: object) => void> = []
  const pointerUpFns: Array<(event: object) => void> = []
  const pointerDownFns: Array<(event: object) => void> = []
  const windowMock = {
    location: {
      href: 'https://shop.test/orders',
      origin: 'https://shop.test',
      pathname: '/orders',
      search: '',
      assign(href: string) {
        assigned.push(href)
      },
    },
    addEventListener(type: string, fn: (event: object) => void) {
      if (type === 'click') clickFns.push(fn)
      if (type === 'pointerup') pointerUpFns.push(fn)
      if (type === 'pointerdown') pointerDownFns.push(fn)
    },
    setTimeout() {
      return 0
    },
  }
  const link = {
    getAttribute(name: string) {
      if (name === 'href') return '/site/demo-shop/cart'
      if (name === 'target') return ''
      return null
    },
    setAttribute() {},
    hasAttribute() {
      return false
    },
    closest(sel: string) {
      if (sel === 'a[href]') return this
      return null
    },
  }
  const run = new Function('window', buildPartnerSiteVisualNativeNavigationScript('demo-shop'))
  run(windowMock)
  assert.equal(clickFns.length, 1)
  assert.equal(pointerUpFns.length, 1)
  assert.equal(pointerDownFns.length, 1)
  let clickSwallowed = 0
  pointerDownFns[0]({ button: 0, pointerId: 1, clientX: 10, clientY: 10 })
  pointerUpFns[0]({
    type: 'pointerup',
    button: 0,
    pointerId: 1,
    clientX: 12,
    clientY: 10,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    target: link,
    preventDefault() {},
    stopPropagation() {},
    stopImmediatePropagation() {},
  })
  assert.equal(assigned.length, 1)
  assert.equal(assigned[0], 'https://shop.test/cart')
  clickFns[0]({
    type: 'click',
    button: 0,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    target: link,
    preventDefault() {
      clickSwallowed += 1
    },
    stopPropagation() {},
    stopImmediatePropagation() {},
  })
  assert.equal(assigned.length, 1)
  assert.equal(clickSwallowed, 1)
})

test('native nav still assigns when hydration detaches the pointer target', () => {
  const assigned: string[] = []
  const pointerUpFns: Array<(event: object) => void> = []
  const pointerDownFns: Array<(event: object) => void> = []
  const windowMock = {
    location: {
      href: 'https://shop.test/orders',
      origin: 'https://shop.test',
      pathname: '/orders',
      search: '',
      assign(href: string) {
        assigned.push(href)
      },
    },
    addEventListener(type: string, fn: (event: object) => void) {
      if (type === 'pointerup') pointerUpFns.push(fn)
      if (type === 'pointerdown') pointerDownFns.push(fn)
    },
    setTimeout() {
      return 0
    },
  }
  const link = {
    isConnected: true,
    getAttribute(name: string) {
      if (name === 'href') return '/site/demo-shop/account'
      if (name === 'target') return ''
      return null
    },
    setAttribute() {},
    hasAttribute() {
      return false
    },
    closest(sel: string) {
      if (sel === 'a[href]') return this
      return null
    },
  }
  const glyph = {
    isConnected: true,
    closest(sel: string) {
      if (sel === 'input,textarea,select,option,[contenteditable="true"]') return null
      if (sel === 'a[href]') return link
      return null
    },
  }
  const detached = {
    isConnected: false,
    closest() {
      return null
    },
  }
  const run = new Function('window', buildPartnerSiteVisualNativeNavigationScript('demo-shop'))
  run(windowMock)
  pointerDownFns[0]({ button: 0, pointerId: 3, clientX: 40, clientY: 12, target: glyph })
  pointerUpFns[0]({
    type: 'pointerup',
    button: 0,
    pointerId: 3,
    clientX: 41,
    clientY: 12,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    target: detached,
    preventDefault() {},
    stopPropagation() {},
    stopImmediatePropagation() {},
  })
  assert.equal(assigned.length, 1)
  assert.equal(assigned[0], 'https://shop.test/account')
})

test('native nav uses hydrated App Router push instead of a full document reload', () => {
  const assigned: string[] = []
  const pushed: string[] = []
  const clickFns: Array<(event: object) => void> = []
  const pointerUpFns: Array<(event: object) => void> = []
  const pointerDownFns: Array<(event: object) => void> = []
  const windowMock = {
    __pwShopSoftNav(href: string) {
      pushed.push(href)
    },
    location: {
      href: 'https://shop.test/orders',
      origin: 'https://shop.test',
      pathname: '/orders',
      search: '',
      assign(href: string) {
        assigned.push(href)
      },
    },
    addEventListener(type: string, fn: (event: object) => void) {
      if (type === 'click') clickFns.push(fn)
      if (type === 'pointerup') pointerUpFns.push(fn)
      if (type === 'pointerdown') pointerDownFns.push(fn)
    },
    setTimeout() {
      return 0
    },
  }
  const link = {
    isConnected: true,
    getAttribute(name: string) {
      if (name === 'href') return '/site/demo-shop/cart'
      if (name === 'target') return ''
      return null
    },
    setAttribute() {},
    hasAttribute() {
      return false
    },
    closest(sel: string) {
      if (sel === 'a[href]') return this
      return null
    },
  }
  const run = new Function('window', buildPartnerSiteVisualNativeNavigationScript('demo-shop'))
  run(windowMock)
  pointerDownFns[0]({ button: 0, pointerId: 4, clientX: 20, clientY: 10, target: link })
  pointerUpFns[0]({
    type: 'pointerup',
    button: 0,
    pointerId: 4,
    clientX: 21,
    clientY: 10,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    target: link,
    preventDefault() {},
    stopPropagation() {},
    stopImmediatePropagation() {},
  })
  assert.equal(assigned.length, 0)
  assert.equal(pushed.length, 1)
  assert.equal(pushed[0], 'https://shop.test/cart')
  let clickSwallowed = 0
  clickFns[0]({
    type: 'click',
    button: 0,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    target: link,
    preventDefault() {
      clickSwallowed += 1
    },
    stopPropagation() {},
    stopImmediatePropagation() {},
  })
  assert.equal(pushed.length, 1)
  assert.equal(assigned.length, 0)
  assert.equal(clickSwallowed, 1)
})
