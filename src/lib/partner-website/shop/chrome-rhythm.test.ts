import assert from 'node:assert/strict'
import test from 'node:test'

import {
  chromeDockIconSizeForDevice,
  chromeFloatRhythmForDevice,
  chromeHeadIconSizeForDevice,
  chromeHeadIconSizeFromLegacy,
  chromeHeadKitGapForDevice,
  chromeHeadKitGapFromLegacy,
  chromeRhythmDevice,
  PW_FLOAT_RHYTHM,
  PW_HEAD_ICON_SIZE,
  PW_HEAD_KIT_GAP,
} from './chrome-rhythm'

test('chrome rhythm defaults stay distinct per device', () => {
  assert.equal(chromeRhythmDevice('laptop'), 'laptop')
  assert.equal(chromeRhythmDevice(null), 'desktop')
  assert.equal(chromeHeadIconSizeForDevice('desktop'), 20)
  assert.equal(chromeHeadIconSizeForDevice('laptop'), 18)
  assert.equal(chromeHeadIconSizeForDevice('mobile'), PW_HEAD_ICON_SIZE.mobile)
  assert.equal(chromeHeadKitGapForDevice('desktop'), 33)
  assert.equal(chromeHeadKitGapForDevice('laptop'), 33)
  assert.equal(chromeHeadKitGapForDevice('mobile'), PW_HEAD_KIT_GAP.mobile)
  assert.ok(chromeHeadIconSizeForDevice('desktop') > chromeHeadIconSizeForDevice('laptop'))
  assert.ok(chromeHeadKitGapForDevice('desktop') > chromeHeadKitGapForDevice('mobile'))
  assert.equal(chromeDockIconSizeForDevice('mobile'), 24)
  assert.equal(chromeDockIconSizeForDevice('tablet'), 22)
  assert.equal(chromeFloatRhythmForDevice('desktop').size, PW_FLOAT_RHYTHM.desktop.size)
  assert.equal(chromeFloatRhythmForDevice('mobile').size, 48)
  assert.ok(chromeFloatRhythmForDevice('mobile').gap > chromeFloatRhythmForDevice('desktop').gap)
})

test('legacy head seed values bump to current rhythm', () => {
  assert.equal(chromeHeadIconSizeFromLegacy(26, 'desktop'), 20)
  assert.equal(chromeHeadIconSizeFromLegacy(24, 'desktop'), 24)
  assert.equal(chromeHeadIconSizeFromLegacy(20, 'desktop'), 20)
  assert.equal(chromeHeadIconSizeFromLegacy(20, 'tablet'), 20)
  assert.equal(chromeHeadKitGapFromLegacy(8, 'desktop'), 33)
  assert.equal(chromeHeadKitGapFromLegacy(6, 'laptop'), 33)
  assert.equal(chromeHeadKitGapFromLegacy(6, 'tablet'), 6)
  assert.equal(chromeHeadKitGapFromLegacy(16, 'desktop'), 16)
})
