import assert from 'node:assert/strict'
import test from 'node:test'

import { STUDIO_PRESETS } from '@/lib/hub-chat/hub-studio-presets'
import { getFlowSteps } from '@/lib/hub-chat/hub-studio-preset-flows'
import {
  resolveCurrentStudioDesignStep,
  saveCurrentStudioStepBrief,
} from '@/lib/hub-chat/hub-studio-step-engine'
import { emptyStudioSession, type HubStudioSession } from '@/lib/hub-chat/hub-studio-types'

function sessionAtStep(presetId: string, stepKey: string): HubStudioSession {
  return {
    ...emptyStudioSession(),
    presetId,
    discoveryComplete: true,
    currentStepKey: stepKey,
    processSteps: getFlowSteps(presetId).map((step) => ({
      key: step.key,
      label: step.labelKey,
      status: step.key === stepKey ? 'in_progress' as const : 'done' as const,
    })),
  }
}

test('all presets resolve generation only from their current design step', () => {
  for (const preset of STUDIO_PRESETS) {
    const designStep = getFlowSteps(preset.id).find(
      (step) => step.phase === 'design' && step.generator
    )
    assert.ok(designStep, `${preset.id} must have a design step`)
    const resolved = resolveCurrentStudioDesignStep(
      sessionAtStep(preset.id, designStep.key)
    )
    assert.equal(resolved?.presetId, preset.id)
    assert.equal(resolved?.stepKey, designStep.key)
    assert.equal(resolved?.generator, designStep.generator)
  }
})

test('discovery steps cannot execute a design generator', () => {
  const session = sessionAtStep('packaging_kit', 'brand_name')
  session.discoveryComplete = false
  assert.equal(resolveCurrentStudioDesignStep(session), null)
})

test('design messages save only the current step brief', () => {
  const session = sessionAtStep('packaging_kit', 'face_top')
  session.briefNotes = {
    logo: 'Keep this logo brief',
    face_front: 'Keep this future brief',
  }
  const next = saveCurrentStudioStepBrief(
    session,
    'Logo NANOCOSMETIC ở giữa, thu hút khách hàng'
  )
  assert.equal(
    next.briefNotes.face_top,
    'Logo NANOCOSMETIC ở giữa, thu hút khách hàng'
  )
  assert.equal(next.briefNotes.logo, 'Keep this logo brief')
  assert.equal(next.briefNotes.face_front, 'Keep this future brief')
  assert.equal(next.currentStepKey, 'face_top')
})
