import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildConfirmedNewFlowStartRequest,
  detectStudioFlowSwitch,
  isActiveStudioFlow,
  isStudioFlowComplete,
  shouldConfirmPresetChipStart,
} from '@/lib/hub-chat/hub-studio-flow-guard'
import { emptyStudioSession } from '@/lib/hub-chat/hub-studio-types'

test('active Studio flow requires a preset and process steps', () => {
  assert.equal(isActiveStudioFlow(emptyStudioSession()), false)
  assert.equal(
    isActiveStudioFlow({
      ...emptyStudioSession(),
      presetId: 'packaging_kit',
      processSteps: [{ key: 'brand_name', label: 'Brand', status: 'in_progress' }],
    }),
    true
  )
})

test('a packaging face brief never requests another flow', () => {
  const message = `MẶT 1: MẶT CHÍNH
Mặt này tập trung vào nhận diện thương hiệu để thu hút khách hàng.
Logo/Thương hiệu: NANOCOSMETIC`
  assert.equal(detectStudioFlowSwitch(message, 'packaging_kit'), null)
})

test('completed flow has no pending step', () => {
  assert.equal(
    isStudioFlowComplete({
      ...emptyStudioSession(),
      presetId: 'packaging_kit',
      currentStepKey: null,
      processSteps: [
        { key: 'box_mockup_3d', label: 'Mockup', status: 'done' },
        { key: 'box_dieline_pdf', label: 'Dieline', status: 'done' },
      ],
    }),
    true
  )
  assert.equal(
    isStudioFlowComplete({
      ...emptyStudioSession(),
      presetId: 'packaging_kit',
      currentStepKey: 'box_dieline_pdf',
      processSteps: [
        { key: 'box_mockup_3d', label: 'Mockup', status: 'done' },
        { key: 'box_dieline_pdf', label: 'Dieline', status: 'in_progress' },
      ],
    }),
    false
  )
})

test('explicit request proposes another preset without mutating a session', () => {
  assert.equal(
    detectStudioFlowSwitch('Chuyển sang làm thiệp cưới', 'packaging_kit'),
    'wedding_invite'
  )
  assert.equal(
    detectStudioFlowSwitch('Tôi muốn thiết kế landing page', 'packaging_kit'),
    'landing_page'
  )
  assert.equal(
    detectStudioFlowSwitch('tạo giao diện web', 'packaging_kit'),
    'landing_page'
  )
})

test('compact preset intent proposes another flow without an explicit verb', () => {
  assert.equal(detectStudioFlowSwitch('giao diện web', 'packaging_kit'), 'landing_page')
  assert.equal(detectStudioFlowSwitch('App bán hàng', 'packaging_kit'), 'mobile_shop')
})

test('request matching the current preset does not fork', () => {
  assert.equal(
    detectStudioFlowSwitch('Tạo dự án bao bì mới', 'packaging_kit'),
    null
  )
})

test('confirmed new-flow payload always forks with a null thread id', () => {
  const request = buildConfirmedNewFlowStartRequest('wedding_invite')
  assert.equal(request.action, 'start_preset')
  assert.equal(request.presetId, 'wedding_invite')
  assert.equal(request.forceNewThread, true)
  assert.equal(request.threadId, null)
})

test('preset chips require confirmation only while a flow is active', () => {
  const active = {
    ...emptyStudioSession(),
    presetId: 'packaging_kit',
    processSteps: [{ key: 'brand_name', label: 'Brand', status: 'in_progress' as const }],
  }
  assert.equal(shouldConfirmPresetChipStart(active, 'brand_kit'), true)
  assert.equal(shouldConfirmPresetChipStart(emptyStudioSession(), 'brand_kit'), false)
})
