import assert from 'node:assert/strict'
import test from 'node:test'
import { weddingOrnamentFrameStyle, weddingOrnamentImageStyle } from './wedding-background-presets'
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
} from './wedding-design-viewport'

test('guest and host editor lock the viewport to the design sheet', () => {
  assert.equal(weddingDesignViewportContent('desktop'), 'width=1440, viewport-fit=cover')
  assert.equal(weddingDesignViewportContent('mobile'), 'width=390, viewport-fit=cover')
  assert.equal(shouldLockWeddingDesignViewport(''), true)
  assert.equal(shouldLockWeddingDesignViewport('demo=1&view=groom'), true)
  assert.equal(shouldLockWeddingDesignViewport('layout=full&stack=cover'), false)
  assert.equal(weddingDesignDeviceFromSearch('device=mobile', 1800), 'mobile')
  assert.equal(weddingDesignDeviceFromSearch('device=desktop', 400), 'desktop')
  assert.equal(weddingDesignDeviceFromSearch('layout=full', 390), 'mobile')
  assert.equal(weddingDesignDeviceFromSearch('layout=full', 1440), 'desktop')
  assert.equal(weddingDesignDeviceFromSearch('', 390), 'mobile')
  assert.equal(weddingDesignDeviceFromSearch('', 1024), 'desktop')
  const script = weddingDesignViewportBootScript()
  assert.match(script, /get\('layout'\)==='full'/)
  assert.match(script, /1440/)
  assert.match(script, /390/)
  assert.match(script, /1024/)
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
})
