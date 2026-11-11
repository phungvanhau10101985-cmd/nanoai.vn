import assert from 'node:assert/strict'
import test from 'node:test'
import vm from 'node:vm'
import { PARTNER_SHOP_SCROLL_PIN_SCRIPT } from '@/lib/partner-website/shop/partner-site-scroll-pin'
import { PARTNER_SHOP_SCENE_CENTER_SCRIPT } from '@/lib/partner-website/visual-editor/pw-scene'

test('scroll pin script parses and ships inside the scene script', () => {
  assert.doesNotThrow(() => new Function(PARTNER_SHOP_SCROLL_PIN_SCRIPT))
  assert.match(PARTNER_SHOP_SCROLL_PIN_SCRIPT, /back_forward/)
  assert.match(PARTNER_SHOP_SCROLL_PIN_SCRIPT, /overflowAnchor/)
  assert.match(PARTNER_SHOP_SCROLL_PIN_SCRIPT, /nearBottom/)
  assert.match(PARTNER_SHOP_SCENE_CENTER_SCRIPT, /__pwPinScroll/)
  assert.match(PARTNER_SHOP_SCENE_CENTER_SCRIPT, /pw-shop-visual-ready/)
})

function bootPin(opts?: { scrollY?: number; nav?: string; hash?: string; editor?: boolean }) {
  const listeners: { type: string; fn: (e?: { key?: string }) => void }[] = []
  const html = {
    style: { overflowAnchor: '' },
    scrollHeight: 5000,
    classList: { contains: (name: string) => (opts?.editor ? name === 'nanoai-ve-active' : false) },
    scrollTop: 0,
  }
  const body = {
    scrollHeight: 5000,
    classList: { contains: () => false },
  }
  const window = {
    scrollY: opts?.scrollY ?? 0,
    innerHeight: 800,
    __pwScrollPin: 0,
    __pwScrollPinning: 0,
    __pwPinScroll: undefined as undefined | ((fn: () => void) => void),
    addEventListener(type: string, fn: (e?: { key?: string }) => void) {
      listeners.push({ type, fn })
    },
    scrollTo(_x: number, y: number) {
      window.scrollY = y
    },
    setTimeout(fn: () => void) {
      return fn
    },
  }
  const ctx = vm.createContext({
    window,
    document: { documentElement: html, body },
    performance: { getEntriesByType: () => [{ type: opts?.nav || 'navigate' }] },
    location: { hash: opts?.hash || '' },
    requestAnimationFrame(fn: () => void) {
      fn()
    },
    Date,
    Math,
  })
  vm.runInContext(PARTNER_SHOP_SCROLL_PIN_SCRIPT, ctx)
  return { window, html, listeners }
}

test('a jump to the bottom while the reader is still at the top is put back', () => {
  const env = bootPin()
  assert.equal(env.html.style.overflowAnchor, 'none')
  env.window.scrollY = 4600
  const onScroll = env.listeners.find((item) => item.type === 'scroll')
  assert.ok(onScroll)
  onScroll.fn()
  assert.equal(env.window.scrollY, 0)
})

test('a wheel toward the bottom is left alone', () => {
  const env = bootPin()
  const onWheel = env.listeners.find((item) => item.type === 'wheel')
  const onScroll = env.listeners.find((item) => item.type === 'scroll')
  assert.ok(onWheel && onScroll)
  onWheel.fn()
  env.window.scrollY = 4600
  onScroll.fn()
  assert.equal(env.window.scrollY, 4600)
})

test('back-forward does not arm the jump restore', () => {
  const env = bootPin({ nav: 'back_forward' })
  assert.equal(env.html.style.overflowAnchor, 'none')
  assert.equal(env.listeners.some((item) => item.type === 'scroll'), false)
})

test('Sửa nhanh does not hold the page', () => {
  const env = bootPin({ editor: true })
  assert.equal(env.html.style.overflowAnchor, '')
  assert.equal(env.listeners.length, 0)
  assert.equal(typeof env.window.__pwPinScroll, 'function')
})
