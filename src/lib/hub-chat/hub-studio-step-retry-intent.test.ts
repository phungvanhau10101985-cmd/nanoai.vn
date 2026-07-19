import assert from 'node:assert/strict'
import test from 'node:test'

import { emptyStudioSession } from '@/lib/hub-chat/hub-studio-types'
import {
  applyStepRetryRepair,
  inferAiRetryFromGenerationFlags,
  mergeKeywordRetryHint,
  sanitizeAiRetryHint,
  shouldExecuteDeferredDesignAction,
  shouldExecuteDesignGeneration,
  wantsStepRegenerate,
} from '@/lib/hub-chat/hub-studio-step-retry'

test('mergeKeywordRetryHint fills mockup action when AI sent none', () => {
  const session = {
    ...emptyStudioSession(),
    presetId: 'packaging_kit',
    discoveryComplete: true,
    currentStepKey: 'product_label',
    processSteps: [{ key: 'product_label', label: 'Label', status: 'in_progress' }],
    referenceImages: [
      { screenKey: 'logo', screenLabel: 'Logo', url: 'logo.png', approvedAt: 1 },
    ],
  }
  const merged = mergeKeywordRetryHint(session, 'vi', 'tạo mockup', { retryIntent: 'none' })
  assert.equal(merged.retryIntent, 'create')
  assert.equal(merged.retryStepKey, 'box_mockup_3d')
})

test('inferAiRetryFromGenerationFlags maps shouldGenerate to current step create', () => {
  const session = {
    ...emptyStudioSession(),
    presetId: 'mobile_shop',
    discoveryComplete: true,
    currentStepKey: 'logo',
    processSteps: [{ key: 'logo', label: 'Logo', status: 'in_progress' }],
  }
  const next = inferAiRetryFromGenerationFlags(session, { retryIntent: 'none' }, true)
  assert.equal(next.retryIntent, 'create')
  assert.equal(next.retryStepKey, 'logo')
})

test('shouldExecuteDesignGeneration trusts shouldGenerate without generate_ui intent', () => {
  assert.equal(
    shouldExecuteDesignGeneration({
      onDiscovery: false,
      discoveryComplete: true,
      forceGenerate: false,
      aiShouldGenerate: true,
    }),
    true
  )
  assert.equal(
    shouldExecuteDesignGeneration({
      onDiscovery: true,
      discoveryComplete: true,
      forceGenerate: false,
      aiShouldGenerate: true,
    }),
    false
  )
})

test('sanitizeAiRetryHint upgrades completed step to regenerate from user message', () => {
  const session = {
    ...emptyStudioSession(),
    presetId: 'packaging_kit',
    discoveryComplete: true,
    currentStepKey: 'seal_sticker',
    processSteps: [{ key: 'box_mockup_3d', label: 'Mockup', status: 'done' }],
    referenceImages: [{ screenKey: 'box_mockup_3d', screenLabel: 'Mockup', url: 'm.png', approvedAt: 1 }],
    packaging: {
      version: 2 as const,
      dimensionsMm: { length: 200, width: 150, height: 100 },
      faces: {},
      mockupUrl: 'm.png',
    },
  }
  const next = sanitizeAiRetryHint(
    session,
    { retryIntent: 'create', retryStepKey: 'box_mockup_3d' },
    'tạo lại mockup',
    'vi'
  )
  assert.equal(next.retryIntent, 'regenerate')
  assert.equal(next.retryStepKey, 'box_mockup_3d')
})

test('sanitizeAiRetryHint keeps a new packaging face brief on the current face', () => {
  const session = {
    ...emptyStudioSession(),
    presetId: 'packaging_kit',
    discoveryComplete: true,
    currentStepKey: 'face_top',
    processSteps: [
      { key: 'logo', label: 'Logo', status: 'done' as const },
      { key: 'face_top', label: 'Top', status: 'in_progress' as const },
      { key: 'face_front', label: 'Front', status: 'pending' as const },
    ],
    referenceImages: [
      { screenKey: 'logo', screenLabel: 'Logo', url: 'logo.png', approvedAt: 1 },
    ],
  }
  const next = sanitizeAiRetryHint(
    session,
    { retryIntent: 'regenerate', retryStepKey: 'logo' },
    'Mặt này tập trung vào nhận diện thương hiệu để thu hút khách hàng. Logo: NANOCOSMETIC',
    'vi'
  )
  assert.equal(next.retryIntent, 'create')
  assert.equal(next.retryStepKey, 'face_top')
})

test('customer wording is not mistaken for a regenerate command', () => {
  assert.equal(
    wantsStepRegenerate(
      'Mặt này tập trung vào nhận diện thương hiệu và các hoạt chất điểm nhấn để thu hút khách hàng.'
    ),
    false
  )
  assert.equal(wantsStepRegenerate('Hãy tạo bản khác'), true)
})

test('sanitizeAiRetryHint still permits an explicit request to recreate the logo', () => {
  const session = {
    ...emptyStudioSession(),
    presetId: 'packaging_kit',
    discoveryComplete: true,
    currentStepKey: 'face_top',
    processSteps: [
      { key: 'logo', label: 'Logo', status: 'done' as const },
      { key: 'face_top', label: 'Top', status: 'in_progress' as const },
    ],
    referenceImages: [
      { screenKey: 'logo', screenLabel: 'Logo', url: 'logo.png', approvedAt: 1 },
    ],
  }
  const next = sanitizeAiRetryHint(
    session,
    { retryIntent: 'regenerate', retryStepKey: 'logo' },
    'Tạo lại logo',
    'vi'
  )
  assert.equal(next.retryIntent, 'regenerate')
  assert.equal(next.retryStepKey, 'logo')
})

test('applyStepRetryRepair preserves a detailed face brief on a short create command', () => {
  const session = {
    ...emptyStudioSession(),
    presetId: 'packaging_kit',
    discoveryComplete: true,
    currentStepKey: 'face_top',
    processSteps: [
      { key: 'logo', label: 'Logo', status: 'done' as const },
      { key: 'face_top', label: 'Top', status: 'in_progress' as const },
    ],
    referenceImages: [
      { screenKey: 'logo', screenLabel: 'Logo', url: 'logo.png', approvedAt: 1 },
    ],
    briefNotes: {
      face_top: 'Logo ở giữa, tên sản phẩm bên dưới và nền xanh toàn mặt hộp',
    },
  }
  const next = applyStepRetryRepair(
    session,
    'packaging_kit',
    'face_top',
    'tạo ảnh mặt',
    'vi',
    { retryIntent: 'create', retryStepKey: 'face_top' }
  )
  assert.equal(
    next.briefNotes.face_top,
    'Logo ở giữa, tên sản phẩm bên dưới và nền xanh toàn mặt hộp'
  )
})

test('shouldExecuteDeferredDesignAction when AI retry set but main branch skipped', () => {
  assert.equal(
    shouldExecuteDeferredDesignAction({
      presetId: 'packaging_kit',
      explicitRetryStep: 'logo',
      aiWantsRetry: true,
      aiShouldGenerate: false,
      packagingFaceCompletedWithoutImage: false,
      alreadyGenerated: false,
      pendingBlocksGenerate: false,
    }),
    true
  )
  assert.equal(
    shouldExecuteDeferredDesignAction({
      presetId: 'packaging_kit',
      explicitRetryStep: 'logo',
      aiWantsRetry: true,
      aiShouldGenerate: false,
      packagingFaceCompletedWithoutImage: false,
      alreadyGenerated: true,
      pendingBlocksGenerate: false,
    }),
    false
  )
})
