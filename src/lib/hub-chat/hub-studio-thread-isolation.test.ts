import assert from 'node:assert/strict'
import test from 'node:test'

import {
  blocksPresetStartOnThread,
  buildConfirmedNewFlowStartRequest,
  isActiveStudioFlow,
  shouldConfirmMessageFlowSwitch,
  shouldConfirmPresetChipStart,
} from '@/lib/hub-chat/hub-studio-flow-guard'
import { STUDIO_PRESETS } from '@/lib/hub-chat/hub-studio-presets'
import { emptyStudioSession, type HubStudioSession } from '@/lib/hub-chat/hub-studio-types'

function activePackagingSession(): HubStudioSession {
  return {
    ...emptyStudioSession(),
    presetId: 'packaging_kit',
    projectTitle: 'Bao bì',
    processSteps: [
      { key: 'brand_name', label: 'Brand', status: 'done' },
      { key: 'face_top', label: 'Top', status: 'in_progress' },
    ],
    currentStepKey: 'face_top',
    discoveryComplete: true,
    briefNotes: { face_top: 'Logo NANOCOSMETIC ở giữa' },
  }
}

type ThreadStore = Map<string, HubStudioSession>

function simulatePresetStart(
  store: ThreadStore,
  threadId: string,
  presetId: string
): { ok: boolean; error?: 'thread_required'; session?: HubStudioSession } {
  const session = store.get(threadId) ?? emptyStudioSession()
  if (blocksPresetStartOnThread(session)) {
    return { ok: false, error: 'thread_required' }
  }
  const next: HubStudioSession = {
    ...emptyStudioSession(),
    presetId,
    projectTitle: presetId,
    processSteps: [{ key: 'kickoff', label: 'Kickoff', status: 'in_progress' }],
    currentStepKey: 'kickoff',
  }
  store.set(threadId, next)
  return { ok: true, session: next }
}

function simulateConfirmedNewFlow(
  store: ThreadStore,
  oldThreadId: string,
  presetId: string
): { newThreadId: string; oldSession: HubStudioSession; newSession: HubStudioSession } {
  const request = buildConfirmedNewFlowStartRequest(presetId)
  assert.equal(request.forceNewThread, true)
  assert.equal(request.threadId, null)

  const oldSession = structuredClone(store.get(oldThreadId) ?? emptyStudioSession())
  const newThreadId = `thread-${store.size + 1}`
  const result = simulatePresetStart(store, newThreadId, request.presetId)
  assert.equal(result.ok, true)

  return {
    newThreadId,
    oldSession,
    newSession: result.session!,
  }
}

test('server blocks start_preset when the thread already has an active flow', () => {
  const store: ThreadStore = new Map()
  store.set('thread-a', activePackagingSession())

  const blocked = simulatePresetStart(store, 'thread-a', 'landing_page')
  assert.equal(blocked.ok, false)
  assert.equal(blocked.error, 'thread_required')
  assert.equal(store.get('thread-a')?.presetId, 'packaging_kit')
  assert.equal(store.get('thread-a')?.briefNotes.face_top, 'Logo NANOCOSMETIC ở giữa')
})

test('confirmed new flow forks to a fresh thread and preserves the old session', () => {
  const store: ThreadStore = new Map()
  store.set('thread-a', activePackagingSession())

  const fork = simulateConfirmedNewFlow(store, 'thread-a', 'landing_page')

  assert.notEqual(fork.newThreadId, 'thread-a')
  assert.equal(fork.oldSession.presetId, 'packaging_kit')
  assert.equal(fork.newSession.presetId, 'landing_page')
  assert.equal(store.get('thread-a')?.presetId, 'packaging_kit')
  assert.equal(store.get(fork.newThreadId)?.presetId, 'landing_page')
})

test('client intercepts preset chips and flow-switch messages while active', () => {
  const session = activePackagingSession()

  assert.equal(shouldConfirmPresetChipStart(session, 'landing_page'), true)
  assert.equal(
    shouldConfirmMessageFlowSwitch(session, 'Chuyển sang làm thiệp cưới'),
    null
  )
  assert.equal(
    shouldConfirmMessageFlowSwitch(
      session,
      'Logo NANOCOSMETIC ở giữa, thu hút khách hàng'
    ),
    null
  )
})

test('inactive threads allow preset start without confirmation', () => {
  const store: ThreadStore = new Map()
  store.set('thread-empty', emptyStudioSession())

  assert.equal(blocksPresetStartOnThread(store.get('thread-empty')), false)
  assert.equal(shouldConfirmPresetChipStart(store.get('thread-empty'), 'brand_kit'), false)

  const started = simulatePresetStart(store, 'thread-empty', 'brand_kit')
  assert.equal(started.ok, true)
  assert.equal(store.get('thread-empty')?.presetId, 'brand_kit')
})

test('all presets can start on an empty thread after confirmation payload', () => {
  for (const preset of STUDIO_PRESETS) {
    const store: ThreadStore = new Map()
    store.set('thread-a', activePackagingSession())

    const fork = simulateConfirmedNewFlow(store, 'thread-a', preset.id)
    assert.equal(fork.newSession.presetId, preset.id)
    assert.equal(isActiveStudioFlow(fork.oldSession), true)
    assert.equal(isActiveStudioFlow(fork.newSession), true)
  }
})
