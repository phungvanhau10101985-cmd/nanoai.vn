import assert from 'node:assert/strict'
import test from 'node:test'
import {
  mergeWeddingSectionConfig,
  parseWeddingSectionConfig,
  readHeroPhotoLayout,
  resolveStackFrameRotate,
  stringifyWeddingSectionConfig,
} from './wedding-section-config'

test('hero layout stays single unless the card explicitly chooses the stacked pair', () => {
  assert.equal(readHeroPhotoLayout(undefined), 'single')
  assert.equal(readHeroPhotoLayout('stack'), 'stack')
  assert.equal(parseWeddingSectionConfig('{}').heroPhotoLayout, undefined)
  const stacked = stringifyWeddingSectionConfig({ heroPhotoLayout: 'stack', coverPresetId: 'classic_red' })
  assert.equal(parseWeddingSectionConfig(stacked).heroPhotoLayout, 'stack')
  assert.equal(parseWeddingSectionConfig(stacked).coverPresetId, 'classic_red')
  const back = mergeWeddingSectionConfig(stacked, { heroPhotoLayout: 'single' })
  assert.equal(parseWeddingSectionConfig(back).heroPhotoLayout, undefined)
  assert.equal(parseWeddingSectionConfig(back).coverPresetId, 'classic_red')
})

test('stacked frame rotate stays at the default until someone turns a frame', () => {
  assert.equal(resolveStackFrameRotate({}, 'groom'), -6)
  assert.equal(resolveStackFrameRotate({}, 'bride'), 3)
  const turned = stringifyWeddingSectionConfig({ stackGroomFrameRotate: -12, stackBrideFrameRotate: 3, heroPhotoLayout: 'stack' })
  const parsed = parseWeddingSectionConfig(turned)
  assert.equal(parsed.stackGroomFrameRotate, -12)
  assert.equal(parsed.stackBrideFrameRotate, undefined)
  assert.equal(parsed.heroPhotoLayout, 'stack')
  assert.equal(resolveStackFrameRotate(parsed, 'groom'), -12)
  assert.equal(resolveStackFrameRotate(parsed, 'bride'), 3)
  const restored = stringifyWeddingSectionConfig({ stackGroomFrameRotate: -6 })
  assert.equal(parseWeddingSectionConfig(restored).stackGroomFrameRotate, undefined)
})
