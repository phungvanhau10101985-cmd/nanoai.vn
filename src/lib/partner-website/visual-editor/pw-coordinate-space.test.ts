import assert from 'node:assert/strict'
import test from 'node:test'
import {
  PW_COORDINATE_CONTRACT_VERSION,
  PW_SCENE_WIDTH,
  pwClientBoxToScene,
  pwClientToScene,
  pwCoordinateRuntimeSource,
  pwCreateViewportMap,
  pwPickAvailableDevice,
  pwResolveCoordinateDevice,
  pwSceneBoxToClient,
  pwSceneToClient,
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

test('scene/client point and box maps round-trip within 0.5 logical pixel', () => {
  const viewports = [390, 768, 1280, 1366, 1440, 1920]
  const devices = ['mobile', 'tablet', 'laptop', 'desktop'] as const
  for (const device of devices) {
    for (const viewportWidth of viewports) {
      const map = pwCreateViewportMap({ device, viewportWidth })
      const point = { x: 123.456, y: 789.25 }
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
})
