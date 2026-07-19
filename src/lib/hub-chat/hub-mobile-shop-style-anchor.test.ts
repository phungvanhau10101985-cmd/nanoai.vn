import assert from 'node:assert/strict'
import test from 'node:test'

import {
  MOBILE_SHOP_UI_STYLE_ANCHOR_KEY,
  applyMobileShopStyleAnchorReference,
  isMobileShopContinueOnlyApproveStep,
  pickMobileShopReferencesForGeneration,
  shouldKeepMobileShopReferenceOnApprove,
} from '@/lib/hub-chat/hub-mobile-shop-style-anchor'
import { emptyStudioSession } from '@/lib/hub-chat/hub-studio-types'

test('mobile shop ui steps use continue-only approve label', () => {
  assert.equal(isMobileShopContinueOnlyApproveStep('mobile_shop', 'home_mobile'), true)
  assert.equal(isMobileShopContinueOnlyApproveStep('mobile_shop', 'home_desktop'), true)
  assert.equal(isMobileShopContinueOnlyApproveStep('mobile_shop', 'logo'), false)
  assert.equal(isMobileShopContinueOnlyApproveStep('packaging_kit', 'face_front'), false)
})

test('home_mobile generation uses logo reference only before anchor exists', () => {
  const refs = pickMobileShopReferencesForGeneration(
    [{ screenKey: 'logo', screenLabel: 'Logo', url: 'logo-url', approvedAt: 1 }],
    'mobile_shop',
    MOBILE_SHOP_UI_STYLE_ANCHOR_KEY
  )
  assert.deepEqual(refs?.map((r) => r.screenKey), ['logo'])
})

test('later mobile shop ui steps use logo + home_mobile for compositing', () => {
  const refs = pickMobileShopReferencesForGeneration(
    [
      { screenKey: 'logo', screenLabel: 'Logo', url: 'logo-url', approvedAt: 1 },
      { screenKey: MOBILE_SHOP_UI_STYLE_ANCHOR_KEY, screenLabel: 'Home', url: 'home-url', approvedAt: 2 },
    ],
    'mobile_shop',
    'home_desktop'
  )
  assert.deepEqual(refs?.map((r) => r.screenKey), ['logo', MOBILE_SHOP_UI_STYLE_ANCHOR_KEY])
})

test('only home_mobile is kept as reference on approve', () => {
  const session = {
    ...emptyStudioSession(),
    presetId: 'mobile_shop',
    referenceImages: [{ screenKey: 'logo', screenLabel: 'Logo', url: 'logo-url', approvedAt: 1 }],
  }
  assert.equal(shouldKeepMobileShopReferenceOnApprove(session, 'logo', 'logo'), true)
  assert.equal(shouldKeepMobileShopReferenceOnApprove(session, MOBILE_SHOP_UI_STYLE_ANCHOR_KEY, 'ui_mockup'), true)
  assert.equal(shouldKeepMobileShopReferenceOnApprove(session, 'home_desktop', 'ui_desktop'), false)

  const anchored = applyMobileShopStyleAnchorReference(
    session,
    MOBILE_SHOP_UI_STYLE_ANCHOR_KEY,
    'Home mobile',
    'home-url'
  )
  assert.equal(anchored.referenceImages.length, 2)
  assert.equal(anchored.referenceImages[0]?.screenKey, 'logo')
  assert.equal(anchored.referenceImages[1]?.screenKey, MOBILE_SHOP_UI_STYLE_ANCHOR_KEY)
})
