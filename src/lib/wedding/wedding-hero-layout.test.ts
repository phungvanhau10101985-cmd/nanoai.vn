import assert from 'node:assert/strict'
import test from 'node:test'
import {
  mergeWeddingSectionConfig,
  parseWeddingSectionConfig,
  readHeroPhotoLayout,
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
