import assert from 'node:assert/strict'
import test from 'node:test'

import {
  applyInPlaceDiscoveryBriefEdit,
  inferStepKeyForUserMessage,
  isInPlaceDiscoveryBriefEdit,
  isInPlacePackagingImageEdit,
  resolveEditUserMessage,
  restoreTimelineAfterInPlaceImageEdit,
  rewindSessionForStepEdit,
} from '@/lib/hub-chat/hub-studio-step-edit'
import { pendingPreviewBlocksWorkflowInput } from '@/lib/hub-chat/hub-studio-step-preview'
import type { HubStudioSession } from '@/lib/hub-chat/hub-studio-types'

function baseSession(overrides: Partial<HubStudioSession> = {}): HubStudioSession {
  return {
    presetId: 'packaging_kit',
    projectTitle: 'Test box',
    discoveryComplete: true,
    currentStepKey: 'logo',
    briefNotes: {
      brand_name: '188.com.vn',
      color_palette: 'màu nền màu bìa carton',
    },
    processSteps: [
      { key: 'brand_name', label: 'Brand', status: 'done' },
      { key: 'color_palette', label: 'Color', status: 'done' },
      { key: 'logo', label: 'Logo', status: 'done' },
      { key: 'face_top', label: 'Top', status: 'in_progress' },
    ],
    referenceImages: [
      { screenKey: 'logo', screenLabel: 'Logo', url: 'https://example.com/logo.png', approvedAt: 1 },
    ],
    uploadImages: [],
    pendingPreview: null,
    lastGenerationPrompt: null,
    ...overrides,
  }
}

test('inferStepKeyForUserMessage returns stored stepKey when present', () => {
  const messages = [
    { role: 'user', content: 'Hộp giấy', studio: null },
    { role: 'assistant', content: 'ok', studio: null },
    { role: 'user', content: '188.com.vn', studio: { stepKey: 'brand_name' } },
  ]
  assert.equal(inferStepKeyForUserMessage(messages, 2, 'packaging_kit'), 'brand_name')
})

test('inferStepKeyForUserMessage returns null for first user message', () => {
  const messages = [{ role: 'user', content: 'Thiết kế bao bì hộp giấy', studio: null }]
  assert.equal(inferStepKeyForUserMessage(messages, 0, 'packaging_kit'), null)
})

test('resolveEditUserMessage finds DB row when client sends temp id', () => {
  const messages = [
    { id: 'uuid-1', role: 'assistant', content: 'ask', studio: null, createdAt: '2026-01-01T00:00:00Z' },
    {
      id: 'uuid-2',
      role: 'user',
      content: '188.com.vn',
      studio: { stepKey: 'brand_name' },
      createdAt: '2026-01-01T00:01:00Z',
    },
  ]
  const resolved = resolveEditUserMessage(messages, 'u-1730000000000', 'brand_name', 'packaging_kit')
  assert.equal(resolved?.id, 'uuid-2')
})

test('resolveEditUserMessage infers legacy user row without stored stepKey', () => {
  const messages = [
    { id: 'uuid-1', role: 'user', content: 'Bộ đóng gói', studio: null, createdAt: '2026-01-01T00:00:00Z' },
    { id: 'uuid-2', role: 'assistant', content: 'ask brand', studio: null, createdAt: '2026-01-01T00:00:30Z' },
    { id: 'uuid-3', role: 'user', content: '188.com.vn', studio: null, createdAt: '2026-01-01T00:01:00Z' },
  ]
  const resolved = resolveEditUserMessage(messages, 'u-999', 'brand_name', 'packaging_kit')
  assert.equal(resolved?.id, 'uuid-3')
})

test('isInPlaceDiscoveryBriefEdit is true for sale_banner discovery steps', () => {
  const session = baseSession({ presetId: 'sale_banner', currentStepKey: 'brand_style' })
  assert.equal(isInPlaceDiscoveryBriefEdit(session, 'sale_banner', 'campaign_name'), true)
  assert.equal(isInPlaceDiscoveryBriefEdit(session, 'sale_banner', 'banner_design'), false)
})

test('applyInPlaceDiscoveryBriefEdit updates brief only and preserves timeline', () => {
  const session = {
    ...baseSession({ presetId: 'sale_banner' }),
    currentStepKey: 'brand_style',
    briefNotes: {
      campaign_name: 'Sale 8/3',
      product_offer: 'Serum C',
    },
    processSteps: [
      { key: 'campaign_name', label: 'Campaign', status: 'done' as const },
      { key: 'product_offer', label: 'Product', status: 'done' as const },
      { key: 'discount_cta', label: 'CTA', status: 'done' as const },
      { key: 'brand_style', label: 'Style', status: 'in_progress' as const },
      { key: 'color_tone', label: 'Color', status: 'pending' as const },
    ],
  }
  const next = applyInPlaceDiscoveryBriefEdit(
    session,
    'campaign_name',
    'Quảng cáo hàng ngày, không khuyến mãi'
  )
  assert.equal(next.briefNotes.campaign_name, 'Quảng cáo hàng ngày, không khuyến mãi')
  assert.equal(next.currentStepKey, 'brand_style')
  assert.equal(next.processSteps.find((s) => s.key === 'brand_style')?.status, 'in_progress')
  assert.equal(next.processSteps.find((s) => s.key === 'color_tone')?.status, 'pending')
})

test('rewindSessionForStepEdit rewinds discovery color and clears downstream logo reference', () => {
  const session = baseSession()
  const next = rewindSessionForStepEdit(
    session,
    'packaging_kit',
    'color_palette',
    'màu nền carton, cam và xám'
  )
  assert.equal(next.briefNotes.color_palette, 'màu nền carton, cam và xám')
  assert.equal(next.currentStepKey, 'logo')
  assert.equal(next.referenceImages.some((r) => r.screenKey === 'logo'), false)
  assert.equal(next.processSteps.find((s) => s.key === 'color_palette')?.status, 'done')
  assert.equal(next.processSteps.find((s) => s.key === 'logo')?.status, 'in_progress')
})

test('rewindSessionForStepEdit rewinds design logo step for regeneration', () => {
  const session = baseSession()
  const next = rewindSessionForStepEdit(session, 'packaging_kit', 'logo', 'Logo tối giản màu cam')
  assert.equal(next.currentStepKey, 'logo')
  assert.equal(next.referenceImages.some((r) => r.screenKey === 'logo'), false)
  assert.equal(next.pendingPreview, null)
  assert.equal(next.processSteps.find((s) => s.key === 'logo')?.status, 'in_progress')
  assert.equal(next.processSteps.find((s) => s.key === 'face_top')?.status, 'pending')
})

test('committed packaging face is edited in place', () => {
  const session = baseSession({
    currentStepKey: 'box_mockup_3d',
    processSteps: [
      { key: 'face_top', label: 'Top', status: 'done' },
      { key: 'face_front', label: 'Front', status: 'done' },
      { key: 'box_mockup_3d', label: 'Mockup', status: 'done' },
    ],
    packaging: {
      version: 2,
      dimensionsMm: { length: 100, width: 60, height: 140 },
      faces: {},
      faceSlots: {
        top: { sourceMode: 'generate', url: 'https://example.com/top.png' },
        front: { sourceMode: 'generate', url: 'https://example.com/front.png' },
      },
      mockupUrl: 'https://example.com/mockup.png',
    },
  })

  assert.equal(isInPlacePackagingImageEdit(session, 'packaging_kit', 'face_top'), true)
  assert.equal(isInPlacePackagingImageEdit(session, 'packaging_kit', 'logo'), false)
})

test('restoring an in-place image edit preserves overall timeline state', () => {
  const original = baseSession({
    currentStepKey: 'box_mockup_3d',
    processSteps: [
      { key: 'face_top', label: 'Top', status: 'done' },
      { key: 'face_front', label: 'Front', status: 'done' },
      { key: 'box_mockup_3d', label: 'Mockup', status: 'in_progress' },
    ],
    pendingPreview: {
      screenKey: 'box_mockup_3d',
      screenLabel: 'Mockup',
      url: 'https://example.com/mockup.png',
      generationPrompt: 'mockup',
    },
  })
  const updated = {
    ...original,
    currentStepKey: 'face_top',
    processSteps: original.processSteps.map((step) =>
      step.key === 'face_top' ? { ...step, status: 'done' as const } : step
    ),
    pendingPreview: null,
    packaging: {
      version: 2 as const,
      dimensionsMm: { length: 100, width: 60, height: 140 },
      faces: {},
      mockupUrl: 'https://example.com/mockup-new.png',
    },
  }

  const restored = restoreTimelineAfterInPlaceImageEdit(updated, original, 'face_top')

  assert.equal(restored.currentStepKey, original.currentStepKey)
  assert.deepEqual(restored.processSteps, original.processSteps)
  assert.equal(restored.pendingPreview?.screenKey, 'box_mockup_3d')
  assert.equal(restored.pendingPreview?.url, 'https://example.com/mockup-new.png')
  assert.equal(restored.packaging?.mockupUrl, 'https://example.com/mockup-new.png')
})

test('pendingPreviewBlocksWorkflowInput only blocks current in-progress step', () => {
  assert.equal(
    pendingPreviewBlocksWorkflowInput({
      currentStepKey: 'box_dieline_pdf',
      processSteps: [
        { key: 'box_mockup_3d', label: 'Mockup', status: 'done' },
        { key: 'box_dieline_pdf', label: 'Dieline', status: 'in_progress' },
      ],
      pendingPreview: {
        screenKey: 'box_mockup_3d',
        screenLabel: 'Mockup',
        url: 'https://example.com/mockup.png',
        generationPrompt: 'mockup',
      },
    } as HubStudioSession),
    false
  )

  assert.equal(
    pendingPreviewBlocksWorkflowInput({
      currentStepKey: 'box_mockup_3d',
      processSteps: [{ key: 'box_mockup_3d', label: 'Mockup', status: 'in_progress' }],
      pendingPreview: {
        screenKey: 'box_mockup_3d',
        screenLabel: 'Mockup',
        url: 'https://example.com/mockup.png',
        generationPrompt: 'mockup',
      },
    } as HubStudioSession),
    true
  )
})

test('restoring after face edit clears stale mockup preview when mockup already done', () => {
  const original = baseSession({
    currentStepKey: 'box_dieline_pdf',
    processSteps: [
      { key: 'face_top', label: 'Top', status: 'done' },
      { key: 'box_mockup_3d', label: 'Mockup', status: 'done' },
      { key: 'box_dieline_pdf', label: 'Dieline', status: 'in_progress' },
    ],
    pendingPreview: {
      screenKey: 'box_mockup_3d',
      screenLabel: 'Mockup',
      url: 'https://example.com/mockup-old.png',
      generationPrompt: 'mockup',
    },
  })
  const updated = {
    ...original,
    pendingPreview: null,
    packaging: {
      version: 2 as const,
      dimensionsMm: { length: 100, width: 60, height: 140 },
      faces: {},
      mockupUrl: 'https://example.com/mockup-new.png',
    },
  }

  const restored = restoreTimelineAfterInPlaceImageEdit(updated, original, 'face_top')

  assert.equal(restored.pendingPreview, null)
  assert.equal(restored.currentStepKey, 'box_dieline_pdf')
})

test('restoring a regenerated current image clears only its obsolete preview', () => {
  const original = baseSession({
    currentStepKey: 'face_top',
    pendingPreview: {
      screenKey: 'face_top',
      screenLabel: 'Top',
      url: 'https://example.com/top-old.png',
      generationPrompt: 'old top',
    },
    lastGenerationPrompt: 'old top',
  })
  const updated = {
    ...original,
    pendingPreview: null,
    packaging: {
      version: 2 as const,
      dimensionsMm: { length: 100, width: 60, height: 140 },
      faces: {},
      mockupUrl: 'https://example.com/mockup-new.png',
    },
  }

  const restored = restoreTimelineAfterInPlaceImageEdit(updated, original, 'face_top')

  assert.equal(restored.pendingPreview, null)
  assert.equal(restored.lastGenerationPrompt, null)
  assert.deepEqual(restored.processSteps, original.processSteps)
})
