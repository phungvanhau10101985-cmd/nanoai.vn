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
  assert.match(script, /__pwShopTapAckPress/)
  assert.match(script, /function swallow\(/)
  assert.match(script, /stopImmediatePropagation/)
  assert.match(script, /data-pw-chrome-btn=\\?"categories/)
  assert.match(script, /data-nanoai-open-chat/)
  assert.match(script, /function eventOrigin\(/)
  assert.match(script, /function isJsOnly\(/)
  assert.match(script, /function isCatToggle\(/)
  assert.match(script, /function favAtEvent\(/)
  assert.match(script, /elementsFromPoint/)
  assert.match(script, /\.pw-rec-fav/)
  assert.match(script, /data-pw-pdp-favorite/)
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

test('native nav does not open the product page when the listing heart is the tap origin', () => {
  const assigned: string[] = []
  const pushed: string[] = []
  const clickFns: Array<(event: object) => void> = []
  const pointerUpFns: Array<(event: object) => void> = []
  const pointerDownFns: Array<(event: object) => void> = []
  const windowMock = {
    location: {
      href: 'https://shop.test/',
      origin: 'https://shop.test',
      pathname: '/',
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
  const productLink = {
    isConnected: true,
    getAttribute(name: string) {
      if (name === 'href') return '/site/demo-shop/products/bag-1'
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
  const heart = {
    isConnected: true,
    closest(sel: string) {
      if (sel === 'input,textarea,select,option,[contenteditable="true"]') return null
      if (sel === 'a[href]') return productLink
      if (typeof sel === 'string' && (sel.includes('[data-pw-favorite]') || sel.includes('.pw-rec-fav'))) return this
      if (typeof sel === 'string' && sel.includes('[data-pw-chrome-btn="categories"]')) return null
      return null
    },
  }
  const run = new Function('window', buildPartnerSiteVisualNativeNavigationScript('demo-shop'))
  run(windowMock)
  pointerDownFns[0]({ button: 0, pointerId: 9, clientX: 80, clientY: 24, target: heart })
  pointerUpFns[0]({
    type: 'pointerup',
    button: 0,
    pointerId: 9,
    clientX: 81,
    clientY: 24,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    target: heart,
    preventDefault() {},
    stopPropagation() {},
    stopImmediatePropagation() {},
  })
  assert.equal(assigned.length, 0)
  assert.equal(pushed.length, 0)
  let clickPrevented = 0
  clickFns[0]({
    type: 'click',
    button: 0,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    target: heart,
    preventDefault() {
      clickPrevented += 1
    },
    stopPropagation() {},
    stopImmediatePropagation() {},
  })
  assert.equal(assigned.length, 0)
  assert.equal(pushed.length, 0)
  assert.equal(clickPrevented, 1)
})

test('native nav does not swallow mobile category taps so the sheet can open', () => {
  const assigned: string[] = []
  const clickFns: Array<(event: object) => void> = []
  const pointerUpFns: Array<(event: object) => void> = []
  const pointerDownFns: Array<(event: object) => void> = []
  const windowMock = {
    location: {
      href: 'https://shop.test/',
      origin: 'https://shop.test',
      pathname: '/',
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
  const catBtn = {
    isConnected: true,
    closest(sel: string) {
      if (sel === 'input,textarea,select,option,[contenteditable="true"]') return null
      if (sel === 'a[href]') return null
      if (typeof sel === 'string' && sel.includes('[data-pw-chrome-btn="categories"]')) return this
      if (typeof sel === 'string' && sel.includes('[data-pw-cat-toggle]')) return this
      return null
    },
  }
  const run = new Function('window', buildPartnerSiteVisualNativeNavigationScript('demo-shop'))
  run(windowMock)
  pointerDownFns[0]({ button: 0, pointerId: 3, clientX: 24, clientY: 88, target: catBtn })
  pointerUpFns[0]({
    type: 'pointerup',
    button: 0,
    pointerId: 3,
    clientX: 24,
    clientY: 88,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    target: catBtn,
    preventDefault() {},
    stopPropagation() {},
    stopImmediatePropagation() {},
  })
  let prevented = 0
  let stopped = 0
  let immediate = 0
  clickFns[0]({
    type: 'click',
    button: 0,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    target: catBtn,
    preventDefault() {
      prevented += 1
    },
    stopPropagation() {
      stopped += 1
    },
    stopImmediatePropagation() {
      immediate += 1
    },
  })
  assert.equal(assigned.length, 0)
  assert.equal(prevented, 1)
  assert.equal(stopped, 0)
  assert.equal(immediate, 0)
})

test('native nav does not swallow favorite taps so shop-actions can toggle', () => {
  const assigned: string[] = []
  const clickFns: Array<(event: object) => void> = []
  const pointerUpFns: Array<(event: object) => void> = []
  const pointerDownFns: Array<(event: object) => void> = []
  const windowMock = {
    location: {
      href: 'https://shop.test/products/ao-bbbbbbbb',
      origin: 'https://shop.test',
      pathname: '/products/ao-bbbbbbbb',
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
  const favBtn = {
    isConnected: true,
    closest(sel: string) {
      if (sel === 'input,textarea,select,option,[contenteditable="true"]') return null
      if (sel === 'a[href]') return null
      if (typeof sel === 'string' && sel.includes('[data-pw-favorite]')) return this
      if (typeof sel === 'string' && sel.includes('.pw-rec-fav')) return this
      if (typeof sel === 'string' && sel.includes('favorite-product')) return this
      return null
    },
  }
  const run = new Function('window', buildPartnerSiteVisualNativeNavigationScript('demo-shop'))
  run(windowMock)
  pointerDownFns[0]({ button: 0, pointerId: 4, clientX: 40, clientY: 120, target: favBtn })
  pointerUpFns[0]({
    type: 'pointerup',
    button: 0,
    pointerId: 4,
    clientX: 40,
    clientY: 120,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    target: favBtn,
    preventDefault() {},
    stopPropagation() {},
    stopImmediatePropagation() {},
  })
  let prevented = 0
  let stopped = 0
  let immediate = 0
  clickFns[0]({
    type: 'click',
    button: 0,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    target: favBtn,
    preventDefault() {
      prevented += 1
    },
    stopPropagation() {
      stopped += 1
    },
    stopImmediatePropagation() {
      immediate += 1
    },
  })
  assert.equal(assigned.length, 0)
  assert.equal(prevented, 1)
  assert.equal(stopped, 0)
  assert.equal(immediate, 0)
})

test('native nav does not open PDP when the card-hit overlay covers the heart', () => {
  const assigned: string[] = []
  const clickFns: Array<(event: object) => void> = []
  const pointerUpFns: Array<(event: object) => void> = []
  const pointerDownFns: Array<(event: object) => void> = []
  const favBtn = {
    isConnected: true,
    closest(sel: string) {
      if (sel === 'input,textarea,select,option,[contenteditable="true"]') return null
      if (sel === 'a[href]') return null
      if (typeof sel === 'string' && sel.includes('[data-pw-favorite]')) return this
      if (typeof sel === 'string' && sel.includes('.pw-rec-fav')) return this
      return null
    },
  }
  const overlay = {
    isConnected: true,
    closest(sel: string) {
      if (sel === 'input,textarea,select,option,[contenteditable="true"]') return null
      if (sel === 'a[href]') return this
      return null
    },
    getAttribute(name: string) {
      if (name === 'href') return '/products/ao-bbbbbbbb'
      if (name === 'target') return ''
      return null
    },
    hasAttribute(name: string) {
      return name === 'href'
    },
  }
  const windowMock = {
    location: {
      href: 'https://shop.test/',
      origin: 'https://shop.test',
      pathname: '/',
      search: '',
      assign(href: string) {
        assigned.push(href)
      },
    },
    document: {
      elementsFromPoint() {
        return [overlay, favBtn]
      },
      elementFromPoint() {
        return overlay
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
  const run = new Function('window', buildPartnerSiteVisualNativeNavigationScript('demo-shop'))
  run(windowMock)
  pointerDownFns[0]({ button: 0, pointerId: 9, clientX: 40, clientY: 120, target: overlay })
  pointerUpFns[0]({
    type: 'pointerup',
    button: 0,
    pointerId: 9,
    clientX: 40,
    clientY: 120,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    target: overlay,
    preventDefault() {},
    stopPropagation() {},
    stopImmediatePropagation() {},
  })
  let prevented = 0
  let stopped = 0
  clickFns[0]({
    type: 'click',
    button: 0,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    target: overlay,
    preventDefault() {
      prevented += 1
    },
    stopPropagation() {
      stopped += 1
    },
    stopImmediatePropagation() {
      stopped += 1
    },
  })
  assert.equal(assigned.length, 0)
  assert.equal(prevented, 1)
  assert.equal(stopped, 0)
})

test('native nav opens the product hit link when the tap lands on the photo', () => {
  const assigned: string[] = []
  const clickFns: Array<(event: object) => void> = []
  const pointerUpFns: Array<(event: object) => void> = []
  const pointerDownFns: Array<(event: object) => void> = []
  const hit = {
    isConnected: true,
    closest(sel: string) {
      if (sel === 'a[href]') return this
      return null
    },
    getAttribute(name: string) {
      if (name === 'href') return '/products/ao-bbbbbbbb'
      if (name === 'target') return ''
      return null
    },
    hasAttribute(name: string) {
      return name === 'href'
    },
  }
  const card = {
    querySelector(sel: string) {
      return sel === 'a.pw-product-card-hit[href]' ? hit : null
    },
  }
  const photo = {
    isConnected: true,
    closest(sel: string) {
      if (sel === 'input,textarea,select,option,[contenteditable="true"]') return null
      if (sel === 'a[href]') return null
      if (typeof sel === 'string' && sel.includes('.pw-product-card')) return card
      return null
    },
  }
  const windowMock = {
    location: {
      href: 'https://shop.test/',
      origin: 'https://shop.test',
      pathname: '/',
      search: '',
      assign(href: string) {
        assigned.push(href)
      },
    },
    document: {
      elementsFromPoint() {
        return [photo]
      },
      elementFromPoint() {
        return photo
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
  const run = new Function('window', buildPartnerSiteVisualNativeNavigationScript('demo-shop'))
  run(windowMock)
  const down = { button: 0, pointerId: 3, clientX: 80, clientY: 90, target: photo }
  for (const fn of pointerDownFns) fn(down)
  const up = {
    type: 'pointerup',
    button: 0,
    pointerId: 3,
    clientX: 80,
    clientY: 90,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    target: photo,
    preventDefault() {},
    stopPropagation() {},
    stopImmediatePropagation() {},
  }
  for (const fn of pointerUpFns) fn(up)
  assert.equal(assigned.length, 1)
  assert.match(assigned[0], /\/products\/ao-bbbbbbbb/)
})
