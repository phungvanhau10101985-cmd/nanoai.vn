import assert from 'node:assert/strict'
import test from 'node:test'

import {
  chromeDockIconSizeForDevice,
  chromeFloatRhythmForDevice,
  chromeHeadIconSizeForDevice,
  chromeHeadKitGapForDevice,
  chromeRhythmDevice,
  PW_FLOAT_RHYTHM,
  PW_HEAD_ICON_SIZE,
  PW_HEAD_KIT_GAP,
} from './chrome-rhythm'

test('chrome rhythm defaults stay distinct per device', () => {
  assert.equal(chromeRhythmDevice('laptop'), 'laptop')
  assert.equal(chromeRhythmDevice(null), 'desktop')
  assert.equal(chromeHeadIconSizeForDevice('desktop'), PW_HEAD_ICON_SIZE.desktop)
  assert.equal(chromeHeadIconSizeForDevice('laptop'), PW_HEAD_ICON_SIZE.laptop)
  assert.equal(chromeHeadIconSizeForDevice('mobile'), PW_HEAD_ICON_SIZE.mobile)
  assert.equal(chromeHeadKitGapForDevice('desktop'), PW_HEAD_KIT_GAP.desktop)
  assert.equal(chromeHeadKitGapForDevice('laptop'), PW_HEAD_KIT_GAP.laptop)
  assert.equal(chromeHeadKitGapForDevice('mobile'), PW_HEAD_KIT_GAP.mobile)
  assert.ok(chromeHeadIconSizeForDevice('desktop') > chromeHeadIconSizeForDevice('laptop'))
  assert.ok(chromeHeadKitGapForDevice('desktop') > chromeHeadKitGapForDevice('mobile'))
  assert.equal(chromeDockIconSizeForDevice('mobile'), 24)
  assert.equal(chromeDockIconSizeForDevice('tablet'), 22)
  assert.equal(chromeFloatRhythmForDevice('desktop').size, PW_FLOAT_RHYTHM.desktop.size)
  assert.equal(chromeFloatRhythmForDevice('mobile').size, 48)
  assert.ok(chromeFloatRhythmForDevice('mobile').gap > chromeFloatRhythmForDevice('desktop').gap)
})
