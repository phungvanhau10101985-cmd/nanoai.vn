import assert from 'node:assert/strict'
import { test } from 'node:test'
import { reconcileDesignRecreateProcessSteps } from '@/lib/design/design-recreate-process-steps'
import { emptyStudioSession } from '@/lib/hub-chat/hub-studio-types'

test('reconcileDesignRecreateProcessSteps inserts logo before concept for legacy sessions', () => {
  const session = {
    ...emptyStudioSession(),
    presetId: 'design_recreate' as const,
    discoveryComplete: true,
    currentStepKey: 'concept_sheet',
    processSteps: [
      { key: 'design_sector', label: 'Sector', status: 'done' as const },
      { key: 'design_format', label: 'Format', status: 'done' as const },
      { key: 'render_style', label: 'Style', status: 'done' as const },
      { key: 'sample_upload', label: 'Sample', status: 'done' as const },
      { key: 'color_palette', label: 'Color', status: 'done' as const },
      { key: 'design_notes', label: 'Notes', status: 'done' as const },
      { key: 'concept_sheet', label: 'Concept', status: 'in_progress' as const },
      { key: 'detail_panel', label: 'Detail', status: 'pending' as const },
      { key: 'technical_flat', label: 'Flat', status: 'pending' as const },
    ],
  }

  const next = reconcileDesignRecreateProcessSteps(session, 'vi')
  assert.ok(next.processSteps.some((s) => s.key === 'logo'))
  assert.equal(next.currentStepKey, 'logo')
  assert.equal(next.processSteps.find((s) => s.key === 'logo')?.status, 'in_progress')
  assert.equal(next.processSteps.find((s) => s.key === 'concept_sheet')?.status, 'pending')
  assert.ok(!next.processSteps.some((s) => s.key === 'detail_panel'))
  assert.ok(!next.processSteps.some((s) => s.key === 'technical_flat'))
  const logoIdx = next.processSteps.findIndex((s) => s.key === 'logo')
  const conceptIdx = next.processSteps.findIndex((s) => s.key === 'concept_sheet')
  assert.ok(logoIdx >= 0 && conceptIdx > logoIdx)
})

test('reconcileDesignRecreateProcessSteps drops legacy detail/technical steps', () => {
  const session = {
    ...emptyStudioSession(),
    presetId: 'design_recreate' as const,
    discoveryComplete: true,
    currentStepKey: 'detail_panel',
    processSteps: [
      { key: 'design_notes', label: 'Notes', status: 'done' as const },
      { key: 'design_language', label: 'Language', status: 'done' as const },
      { key: 'logo', label: 'Logo', status: 'done' as const },
      { key: 'concept_sheet', label: 'Concept', status: 'done' as const },
      { key: 'detail_panel', label: 'Detail', status: 'in_progress' as const },
      { key: 'technical_flat', label: 'Flat', status: 'pending' as const },
    ],
  }
  const next = reconcileDesignRecreateProcessSteps(session, 'vi')
  assert.ok(!next.processSteps.some((s) => s.key === 'detail_panel'))
  assert.ok(!next.processSteps.some((s) => s.key === 'technical_flat'))
  assert.equal(next.currentStepKey, 'concept_sheet')
})

test('reconcileDesignRecreateProcessSteps is a no-op when already on canonical single-image flow', () => {
  const processSteps = [
    { key: 'design_sector', label: 'Sector', status: 'done' as const },
    { key: 'design_format', label: 'Format', status: 'done' as const },
    { key: 'render_style', label: 'Style', status: 'done' as const },
    { key: 'sample_upload', label: 'Sample', status: 'done' as const },
    { key: 'color_palette', label: 'Color', status: 'done' as const },
    { key: 'design_notes', label: 'Notes', status: 'done' as const },
    { key: 'design_language', label: 'Language', status: 'done' as const },
    { key: 'logo', label: 'Logo', status: 'in_progress' as const },
    { key: 'concept_sheet', label: 'Concept', status: 'pending' as const },
  ]
  const session = {
    ...emptyStudioSession(),
    presetId: 'design_recreate' as const,
    discoveryComplete: true,
    currentStepKey: 'logo',
    processSteps,
  }
  const next = reconcileDesignRecreateProcessSteps(session, 'vi')
  assert.equal(next, session)
})

test('reconcileDesignRecreateProcessSteps inserts design_language after design_notes', () => {
  const session = {
    ...emptyStudioSession(),
    presetId: 'design_recreate' as const,
    discoveryComplete: false,
    currentStepKey: 'logo',
    processSteps: [
      { key: 'design_notes', label: 'Notes', status: 'done' as const },
      { key: 'logo', label: 'Logo', status: 'in_progress' as const },
      { key: 'concept_sheet', label: 'Concept', status: 'pending' as const },
    ],
  }
  const next = reconcileDesignRecreateProcessSteps(session, 'vi')
  assert.ok(next.processSteps.some((s) => s.key === 'design_language'))
  assert.equal(next.currentStepKey, 'design_language')
  assert.equal(next.processSteps.find((s) => s.key === 'design_language')?.status, 'in_progress')
})
