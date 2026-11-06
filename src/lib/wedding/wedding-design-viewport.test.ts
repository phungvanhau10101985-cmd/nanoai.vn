import assert from 'node:assert/strict'
import test from 'node:test'
import { editWeddingOrnamentAt, nudgeWeddingOrnament, ornamentRevealNeedsScroll, repeatWeddingOrnamentsDown, seatWeddingOrnamentOnEdge, weddingIframeVisibleView, weddingOrnamentEditSheet, weddingOrnamentFrameStyle, weddingOrnamentImageStyle, weddingOrnamentPageCount, weddingOrnamentPlain, weddingOrnamentSpotInView, weddingOrnamentSurfaceInView, weddingOrnamentsAreOneSheet } from './wedding-background-presets'
import { readFileSync } from 'node:fs'
import {
  WEDDING_DESKTOP_HEIGHT,
  WEDDING_DESKTOP_WIDTH,
  WEDDING_MOBILE_HEIGHT,
  WEDDING_MOBILE_WIDTH,
  shouldLockWeddingDesignViewport,
  weddingDesignDeviceFromSearch,
  weddingDesignViewportBootScript,
  weddingDesignViewportContent,
  weddingIosCoverFitScale,
} from './wedding-design-viewport'

test('guest and host editor lock the viewport to the design sheet', () => {
  assert.equal(weddingDesignViewportContent('desktop'), 'width=1440, viewport-fit=cover')
  assert.equal(weddingDesignViewportContent('mobile'), 'width=390, viewport-fit=cover')
  assert.equal(shouldLockWeddingDesignViewport(''), true)
  assert.equal(shouldLockWeddingDesignViewport('demo=1&view=groom'), false)
  assert.equal(shouldLockWeddingDesignViewport('layout=full&stack=cover'), false)
  assert.equal(weddingDesignDeviceFromSearch('device=mobile', 1800), 'mobile')
  assert.equal(weddingDesignDeviceFromSearch('device=desktop', 400), 'desktop')
  assert.equal(weddingDesignDeviceFromSearch('layout=full', 390), 'mobile')
  assert.equal(weddingDesignDeviceFromSearch('layout=full', 1440), 'desktop')
  assert.equal(weddingDesignDeviceFromSearch('', 390), 'mobile')
  assert.equal(weddingDesignDeviceFromSearch('', 1440), 'mobile')
  const script = weddingDesignViewportBootScript()
  assert.match(script, /get\('layout'\)==='full'/)
  assert.match(script, /get\('demo'\)==='1'/)
  assert.match(script, /device-width/)
  assert.match(script, /get\('device'\)==='desktop'/)
  assert.match(script, /1440/)
  assert.match(script, /390/)
  assert.doesNotMatch(script, /innerWidth/)
})

test('iOS cover fits the safe viewport and Android keeps the width scale', () => {
  assert.equal(
    weddingIosCoverFitScale({
      fitSafeHeight: false,
      fitHeight: false,
      viewWidth: 390,
      safeHeight: 760,
      contentHeight: 844,
      designWidth: 390,
      maxScale: 1,
    }),
    1,
  )
  assert.equal(
    weddingIosCoverFitScale({
      fitSafeHeight: true,
      fitHeight: false,
      viewWidth: 390,
      safeHeight: 760,
      contentHeight: 844,
      designWidth: 390,
      maxScale: 1,
    }),
    760 / 844,
  )
  assert.equal(
    weddingIosCoverFitScale({
      fitSafeHeight: false,
      fitHeight: false,
      viewWidth: 390,
      safeHeight: 760,
      contentHeight: 1600,
      designWidth: 390,
      maxScale: 1,
    }),
    1,
  )
  assert.equal(
    weddingIosCoverFitScale({
      fitSafeHeight: true,
      fitHeight: false,
      viewWidth: 390,
      safeHeight: 760,
      contentHeight: 400,
      designWidth: 390,
      maxScale: 1,
    }),
    1,
  )
})

test('letter ornaments repeat down the content and a short letter stays one sheet', () => {
  assert.equal(weddingOrnamentPageCount(390, 844), 1)
  assert.equal(weddingOrnamentPageCount(390, 1000), 1)
  assert.equal(weddingOrnamentPageCount(390, 844 * 2), 2)
  assert.equal(weddingOrnamentPageCount(1440, 900), 1)
  assert.equal(weddingOrnamentPageCount(1440, 900 * 3), 3)
  const items = [
    { src: '/leaf.png', x: -14, y: 3, w: 50 },
    { src: '/bloom.png', x: 62, y: 2, w: 44, anchor: 'bottom' as const },
  ]
  const one = repeatWeddingOrnamentsDown(items, 1)
  assert.equal(one.length, 2)
  assert.equal(one[1].anchor, 'bottom')
  assert.equal(one[1].y, 2)
  const two = repeatWeddingOrnamentsDown(items, 2)
  assert.equal(two.length, 4)
  assert.equal(two[0].page, 0)
  assert.equal(two[0].anchor, 'top')
  assert.equal(two[2].page, 1)
  assert.ok(two[2].w <= 18)
  assert.ok(two[2].x >= -12, String(two[2].x))
  assert.ok(two[2].x + two[2].w > 10)
  assert.ok(two[3].x < 100)
  assert.ok(two[3].x + two[3].w > 100)
  assert.ok(two[3].x + two[3].w - 100 <= 12)
  assert.ok(two[2].y > two[0].y)
  assert.ok(two[3].y > 50)
  assert.equal(weddingOrnamentsAreOneSheet(items), true)
  assert.equal(weddingOrnamentsAreOneSheet(two.map((item) => weddingOrnamentPlain(item))), false)
  const buried = seatWeddingOrnamentOnEdge({ src: '/rose.png', x: -16, y: 2, w: 22 })
  assert.ok(buried.x >= -12, String(buried.x))
  assert.ok(buried.x + buried.w > 12)
  const offRight = seatWeddingOrnamentOnEdge({ src: '/leaf.png', x: 96, y: 2, w: 22 })
  assert.ok(offRight.x + offRight.w <= 112)
  assert.ok(offRight.x < 96)
})

test('added ornaments use one box in edit and on the live card', () => {
  const item = { src: '/flower.png', x: 12.5, y: 8, w: 28, anchor: 'bottom' as const, rotate: 15, flipX: true, opacity: 0.8 }
  assert.deepEqual(weddingOrnamentFrameStyle(item), {
    left: '12.5%',
    top: 'auto',
    bottom: '8%',
    width: '28%',
  })
  assert.equal(weddingOrnamentImageStyle(item).transform, 'rotate(15deg) scaleX(-1)')
  assert.equal(weddingOrnamentImageStyle(item).opacity, 0.8)
  const css = readFileSync(new URL('../../components/wedding/wedding-layer.css', import.meta.url), 'utf8')
  assert.match(css, new RegExp(`100cqi \\* ${WEDDING_MOBILE_HEIGHT} / ${WEDDING_MOBILE_WIDTH}`))
  assert.match(css, new RegExp(`100cqi \\* ${WEDDING_DESKTOP_HEIGHT} / ${WEDDING_DESKTOP_WIDTH}`))
  assert.match(css, /\[data-wedding-ornament-frame='flow'\][\s\S]*bottom:\s*0/)
  assert.match(css, /\[data-wedding-ornament-frame='flow'\][\s\S]*height:\s*auto/)
})

test('a new ornament follows the sheet currently on screen', () => {
  assert.equal(weddingOrnamentSurfaceInView({ letterTop: 900, letterBottom: 3200, letterHeight: 2300, viewCenterY: 400 }), 'cover')
  assert.equal(weddingOrnamentSurfaceInView({ letterTop: -200, letterBottom: 1800, letterHeight: 2000, viewCenterY: 400 }), 'letter')
  assert.equal(weddingOrnamentSurfaceInView({ letterTop: 0, letterBottom: 0, letterHeight: 0, viewCenterY: 400 }), 'cover')
})

test('a new ornament lands in the screen frame currently on display', () => {
  const middle = weddingOrnamentSpotInView({
    frame: { top: 0, left: 0, width: 390, height: 2500 },
    view: { top: 900, left: 0, width: 390, height: 800 },
  })
  assert.ok(middle.y > 30 && middle.y < 50, String(middle.y))
  assert.ok(middle.x >= 0 && middle.x <= 100 - middle.w)

  const onScreen = weddingOrnamentSpotInView({
    frame: { top: 120, left: 40, width: 390, height: 844 },
    view: { top: 0, left: 0, width: 1400, height: 2000 },
  })
  assert.ok(onScreen.y < 20, String(onScreen.y))

  const hidden = weddingOrnamentSpotInView({
    frame: { top: 2000, left: 0, width: 390, height: 844 },
    view: { top: 0, left: 0, width: 390, height: 800 },
  })
  assert.equal(hidden.y, 6)
  assert.equal(hidden.x, 0)

  const slice = weddingIframeVisibleView({
    frameTop: -400,
    frameLeft: 20,
    frameWidth: 195,
    frameHeight: 1200,
    layoutWidth: 390,
    layoutHeight: 2400,
    viewportWidth: 400,
    viewportHeight: 800,
  })
  assert.ok(slice)
  assert.equal(slice?.x, 0)
  assert.equal(slice?.y, 800)
  assert.ok((slice?.h ?? 0) > 400)
})

test('a newly added flower already on screen does not scroll the page', () => {
  const view = { top: 0, left: 0, width: 390, height: 800 }
  assert.equal(
    ornamentRevealNeedsScroll({ top: 120, left: 8, width: 80, height: 90 }, view),
    false,
  )
  assert.equal(
    ornamentRevealNeedsScroll({ top: 120, left: 8, width: 0, height: 0 }, view),
    false,
  )
  assert.equal(
    ornamentRevealNeedsScroll({ top: 1400, left: 8, width: 80, height: 90 }, view),
    true,
  )
})

test('arrow keys nudge an ornament by screen pixels, including a bottom anchor', () => {
  const piece = { src: '/wedding/heart.png', x: 20, y: 10, w: 18, rotate: 12 }
  const right = nudgeWeddingOrnament(piece, 10, 0, 200, 400)
  assert.equal(right.x, 25)
  assert.equal(right.y, 10)
  assert.equal(right.rotate, 12)
  const down = nudgeWeddingOrnament(piece, 0, 10, 200, 400)
  assert.equal(down.y, 12.5)
  const bottom = nudgeWeddingOrnament({ ...piece, anchor: 'bottom' }, 0, 10, 200, 400)
  assert.equal(bottom.y, 7.5)
  const tiny = nudgeWeddingOrnament(piece, 0, 1, 200, 8000)
  assert.equal(tiny.y, 10.1)
})

test('flowers piled on one side spread onto both edges', () => {
  const items = [
    { src: '/a.png', x: 4, y: 8, w: 22 },
    { src: '/b.png', x: 5, y: 9, w: 22 },
    { src: '/c.png', x: 6, y: 8, w: 22 },
  ]
  const shown = weddingOrnamentEditSheet(items, 1)
  const left = shown.filter((item) => item.x + item.w / 2 < 50)
  const right = shown.filter((item) => item.x + item.w / 2 >= 50)
  assert.ok(left.length >= 1)
  assert.ok(right.length >= 1)
  const spots = shown.map((item) => `${item.x}:${item.y}`)
  assert.equal(new Set(spots).size, shown.length)
})

test('dragging one repeated flower leaves the others where they are', () => {
  const items = [
    { src: '/a.png', x: 0, y: 4, w: 20 },
    { src: '/b.png', x: 2, y: 6, w: 20 },
    { src: '/c.png', x: 4, y: 8, w: 20 },
  ]
  const before = weddingOrnamentEditSheet(items, 2)
  assert.ok(before.length > items.length)
  const movedIndex = before.length - 1
  const next = editWeddingOrnamentAt(items, 2, movedIndex, { x: 40, y: 55, anchor: null })
  assert.equal(next[movedIndex].x, 40)
  assert.equal(next[movedIndex].y, 55)
  assert.equal(next[movedIndex].free, true)
  for (let index = 0; index < next.length; index += 1) {
    if (index === movedIndex) continue
    assert.equal(next[index].x, before[index].x)
    assert.equal(next[index].y, before[index].y)
  }
  const again = weddingOrnamentEditSheet(next, 2)
  assert.equal(again.length, next.length)
  assert.equal(again[movedIndex].x, 40)
  assert.equal(again[movedIndex].y, 55)
  assert.equal(weddingOrnamentsAreOneSheet([{ src: '/a.png', x: 40, y: 20, w: 18, free: true }]), false)
})
