import assert from 'node:assert/strict'
import test from 'node:test'
import {
  PW_COORDINATE_CONTRACT_VERSION,
  PW_SCENE_WIDTH,
  pwClientBoxToScene,
  pwClientToScene,
  pwCoordinateRuntimeSource,
  pwCreateViewportMap,
  pwLeftOriginToCenterX,
  pwNormalizedLeftToCenterX,
  pwPickAvailableDevice,
  pwResolveCoordinateDevice,
  pwSceneBoxLeftCss,
  pwSceneBoxToClient,
  pwSceneBoxTopPx,
  pwSceneLeftCss,
  pwSceneToClient,
  pwTopLeftToElementCenter,
} from './pw-coordinate-space'

test('uses one canonical scene width per device', () => {
  assert.deepEqual(PW_SCENE_WIDTH, {
    mobile: 390,
    tablet: 768,
    laptop: 1280,
    desktop: 1440,
  })
})

test('device selection is independent from display scale', () => {
  assert.equal(
    pwResolveCoordinateDevice({ outerWidth: 1440, layoutWidth: 720, forcedDevice: undefined }),
    'desktop'
  )
  assert.equal(pwResolveCoordinateDevice({ outerWidth: 1366, layoutWidth: 683 }), 'laptop')
  assert.equal(pwResolveCoordinateDevice({ outerWidth: 768, layoutWidth: 384 }), 'tablet')
  assert.equal(pwResolveCoordinateDevice({ outerWidth: 390, layoutWidth: 195 }), 'mobile')
  assert.equal(
    pwResolveCoordinateDevice({
      forcedDevice: 'mobile',
      outerWidth: 1920,
      layoutWidth: 1920,
    }),
    'mobile'
  )
})

test('origin is the top-center of the screen and scale is viewport / scene', () => {
  const map = pwCreateViewportMap({ device: 'desktop', viewportWidth: 1440 })
  assert.equal(map.scale, 1)
  assert.equal(map.originX, 720)
  assert.equal(map.originY, 0)
  const topCenter = pwSceneToClient({ x: 0, y: 0 }, map)
  assert.equal(topCenter.x, 720)
  assert.equal(topCenter.y, 0)

  const half = pwCreateViewportMap({ device: 'desktop', viewportWidth: 720 })
  assert.equal(half.scale, 0.5)
  assert.equal(half.originX, 360)
  const scaled = pwSceneToClient({ x: 200, y: 80 }, half)
  assert.equal(scaled.x, 360 + 100)
  assert.equal(scaled.y, 40)
})

test('scene/client point and box maps round-trip within 0.5 logical pixel', () => {
  const viewports = [390, 768, 1280, 1366, 1440, 1920]
  const devices = ['mobile', 'tablet', 'laptop', 'desktop'] as const
  for (const device of devices) {
    for (const viewportWidth of viewports) {
      const map = pwCreateViewportMap({ device, viewportWidth })
      const point = { x: -123.456, y: 789.25 }
      const roundTrip = pwClientToScene(pwSceneToClient(point, map), map)
      assert.ok(Math.abs(roundTrip.x - point.x) <= 0.5)
      assert.ok(Math.abs(roundTrip.y - point.y) <= 0.5)

      const box = { ...point, width: 321.5, height: 88.125 }
      const boxRoundTrip = pwClientBoxToScene(pwSceneBoxToClient(box, map), map)
      assert.ok(Math.abs(boxRoundTrip.x - box.x) <= 0.5)
      assert.ok(Math.abs(boxRoundTrip.y - box.y) <= 0.5)
      assert.ok(Math.abs(boxRoundTrip.width - box.width) <= 0.5)
      assert.ok(Math.abs(boxRoundTrip.height - box.height) <= 0.5)
    }
  }
})

test('left-origin v2 values convert to center-origin, then to the element center', () => {
  assert.equal(pwLeftOriginToCenterX(720, 1440), 0)
  assert.equal(pwLeftOriginToCenterX(75, 1440), 75 - 720)
  assert.equal(pwNormalizedLeftToCenterX(0.25, 1440), 0.25 * 1440 - 720)
  assert.equal(pwSceneLeftCss(0), '50%')
  assert.equal(pwSceneLeftCss(80), 'calc(50% + 80px)')
  assert.equal(pwSceneLeftCss(-640), 'calc(50% - 640px)')
  assert.deepEqual(pwTopLeftToElementCenter(-640, 40, 400, 120), { x: -440, y: 100 })
  assert.equal(pwSceneBoxLeftCss(-440, 400), 'calc(50% - 640px)')
  assert.equal(pwSceneBoxTopPx(100, 120), 40)
})

test('fallback retains the source device instead of pretending it is the request', () => {
  assert.equal(pwPickAvailableDevice('mobile', new Set(['desktop'])), 'desktop')
  assert.equal(pwPickAvailableDevice('tablet', new Set(['laptop', 'desktop'])), 'laptop')
  assert.equal(pwPickAvailableDevice('desktop', new Set(['mobile'])), 'mobile')
  assert.equal(pwPickAvailableDevice('desktop', new Set()), null)
})

test('runtime is generated from the same constants and contract version', () => {
  const source = pwCoordinateRuntimeSource()
  assert.match(source, new RegExp(`version:'${PW_COORDINATE_CONTRACT_VERSION}'`))
  assert.match(source, /"desktop":1440/)
  assert.match(source, /clientToScene/)
  assert.match(source, /sceneToClient/)
  assert.match(source, /originX:isFinite\(ox\)\?ox:vw\/2/)
  assert.match(source, /leftCss/)
  assert.match(source, /boxLeftCss/)
  assert.match(source, /rectCenter/)
})
