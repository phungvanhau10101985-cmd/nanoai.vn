import assert from 'node:assert/strict'
import test from 'node:test'

import { inferStepKeyForUserMessage, resolveEditUserMessage, rewindSessionForStepEdit } from '@/lib/hub-chat/hub-studio-step-edit'
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
