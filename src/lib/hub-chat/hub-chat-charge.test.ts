import assert from 'node:assert/strict'
import test from 'node:test'

import { shouldChargeHubChatTurn } from '@/lib/hub-chat/hub-chat-catalog'

test('first user message of a thread is free', () => {
  assert.equal(
    shouldChargeHubChatTurn({
      action: 'message',
      hasPreset: false,
      hasPriorUserMessage: false,
    }),
    false
  )
})

test('later chat without a preset still costs credit', () => {
  assert.equal(
    shouldChargeHubChatTurn({
      action: 'message',
      hasPreset: false,
      hasPriorUserMessage: true,
    }),
    true
  )
})

test('messages inside a studio preset do not charge chat credit', () => {
  assert.equal(
    shouldChargeHubChatTurn({
      action: 'message',
      hasPreset: true,
      hasPriorUserMessage: true,
    }),
    false
  )
})

test('editing a step still costs credit', () => {
  assert.equal(
    shouldChargeHubChatTurn({
      action: 'edit_step',
      hasPreset: true,
      hasPriorUserMessage: true,
    }),
    true
  )
})
