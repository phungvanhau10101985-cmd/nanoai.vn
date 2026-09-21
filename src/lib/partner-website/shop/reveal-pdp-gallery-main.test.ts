import assert from 'node:assert/strict'
import test from 'node:test'
import {
  pdpGalleryIsMobileFace,
  pickPdpGalleryMainEl,
  revealPdpGalleryMainImage,
  PW_REVEAL_PDP_GALLERY_MAIN_JS,
} from '@/lib/partner-website/shop/reveal-pdp-gallery-main'

function el(init: {
  tag?: string
  attrs?: Record<string, string>
  hidden?: boolean
  className?: string
  rect?: { top: number; bottom: number; height: number }
  display?: string
  closestHero?: boolean
}): HTMLElement {
  const attrs = { ...(init.attrs || {}) }
  const node = {
    tagName: (init.tag || 'IMG').toUpperCase(),
    hidden: Boolean(init.hidden),
    classList: {
      contains: (name: string) => String(init.className || '').split(/\s+/).includes(name),
    },
    getAttribute: (name: string) => (name in attrs ? attrs[name] : null),
    hasAttribute: (name: string) =>
      name === 'hidden' ? Boolean(init.hidden) : Object.prototype.hasOwnProperty.call(attrs, name),
    getBoundingClientRect: () => ({
      top: init.rect?.top ?? 0,
      bottom: init.rect?.bottom ?? (init.rect?.top ?? 0) + (init.rect?.height ?? 400),
      height: init.rect?.height ?? 400,
      left: 0,
      right: 390,
      width: 390,
      x: 0,
      y: init.rect?.top ?? 0,
      toJSON() {
        return this
      },
    }),
    closest: (sel: string) => {
      if (sel.includes('pw-pdp-hero') && init.closestHero !== false) return node
      return null
    },
    style: { display: init.display || '' },
  }
  return node as unknown as HTMLElement
}

function env(opts: {
  device?: string
  search?: string
  innerWidth?: number
  scrollY?: number
  nodes?: HTMLElement[]
  headerH?: number
  stickyHead?: string
}) {
  const htmlAttrs: Record<string, string> = {}
  if (opts.device) htmlAttrs['data-pw-edit-device'] = opts.device
  const nodes = opts.nodes || []
  const header = el({ rect: { top: 0, bottom: opts.headerH ?? 56, height: opts.headerH ?? 56 } })
  let scrolled: { top: number; behavior?: string } | null = null
  const documentRef = {
    documentElement: {
      getAttribute: (name: string) => htmlAttrs[name] || '',
    },
    querySelectorAll: () => nodes,
    querySelector: (sel: string) => (String(sel).includes('header') ? header : nodes[0] || null),
  } as unknown as Document
  const windowRef = {
    innerWidth: opts.innerWidth ?? 390,
    innerHeight: 720,
    scrollY: opts.scrollY ?? 400,
    pageYOffset: opts.scrollY ?? 400,
    location: { search: opts.search || '' },
    getComputedStyle: () => ({
      getPropertyValue: (name: string) => (name === '--pw-sticky-head' ? opts.stickyHead || '56px' : ''),
      display: 'block',
      visibility: 'visible',
    }),
    scrollTo: (arg: { top: number; behavior?: string } | number) => {
      scrolled = typeof arg === 'number' ? { top: arg } : arg
    },
  } as unknown as Window
  return { document: documentRef, window: windowRef, scrolled: () => scrolled }
}

test('pdpGalleryIsMobileFace trusts stamp and ?pw-device= over width', () => {
  assert.equal(pdpGalleryIsMobileFace(env({ device: 'mobile', innerWidth: 1440 })), true)
  assert.equal(pdpGalleryIsMobileFace(env({ device: 'desktop', innerWidth: 320 })), false)
  assert.equal(pdpGalleryIsMobileFace(env({ search: '?pw-device=mobile', innerWidth: 1440 })), true)
  assert.equal(pdpGalleryIsMobileFace(env({ innerWidth: 390 })), true)
  assert.equal(pdpGalleryIsMobileFace(env({ innerWidth: 1280 })), false)
})

test('revealPdpGalleryMainImage scrolls the hero when the large photo is off-screen', () => {
  const hero = el({
    tag: 'img',
    attrs: { 'data-pw-el': 'main-image', src: 'https://cdn.example/a.jpg' },
    rect: { top: -420, bottom: 80, height: 500 },
    closestHero: true,
  })
  const ctx = env({ device: 'mobile', scrollY: 480, nodes: [hero] })
  assert.equal(revealPdpGalleryMainImage(ctx), true)
  const moved = ctx.scrolled()
  assert.ok(moved)
  assert.equal(moved?.behavior, 'smooth')
  assert.equal(moved?.top, Math.max(0, 480 + -420 - 56 - 4))
})

test('revealPdpGalleryMainImage does not jump when the large photo is already in view', () => {
  const hero = el({
    tag: 'img',
    attrs: { 'data-pw-el': 'main-image', src: 'https://cdn.example/a.jpg' },
    rect: { top: 56, bottom: 456, height: 400 },
  })
  const ctx = env({ device: 'mobile', scrollY: 0, nodes: [hero] })
  assert.equal(revealPdpGalleryMainImage(ctx), false)
  assert.equal(ctx.scrolled(), null)
})

test('revealPdpGalleryMainImage is a no-op on desktop gallery', () => {
  const hero = el({
    tag: 'img',
    attrs: { 'data-pw-el': 'main-image' },
    rect: { top: -200, bottom: 200, height: 400 },
  })
  const ctx = env({ device: 'desktop', nodes: [hero] })
  assert.equal(revealPdpGalleryMainImage(ctx), false)
  assert.equal(ctx.scrolled(), null)
})

test('pickPdpGalleryMainEl skips hidden / deferred gallery faces', () => {
  const hidden = el({ hidden: true, attrs: { 'data-pw-el': 'main-image' } })
  const live = el({ attrs: { 'data-pw-el': 'main-image', src: 'https://cdn.example/b.jpg' } })
  const ctx = env({ device: 'mobile', nodes: [hidden, live] })
  assert.equal(pickPdpGalleryMainEl(ctx), live)
})

test('live PDP JS helper ships the mobile reveal function', () => {
  assert.match(PW_REVEAL_PDP_GALLERY_MAIN_JS, /function pdpGalleryIsMobileFace/)
  assert.match(PW_REVEAL_PDP_GALLERY_MAIN_JS, /function revealPdpGalleryMainImage/)
  assert.match(PW_REVEAL_PDP_GALLERY_MAIN_JS, /scrollTo\(\{top:y,behavior:'smooth'\}\)/)
})
