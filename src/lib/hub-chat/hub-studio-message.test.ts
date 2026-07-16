import assert from 'node:assert/strict'
import test from 'node:test'

import { isValidHubStudioMessage } from '@/lib/hub-chat/hub-studio-message'

test('isValidHubStudioMessage allows option numbers and normal text', () => {
  assert.equal(isValidHubStudioMessage(''), false)
  assert.equal(isValidHubStudioMessage('2'), true)
  assert.equal(isValidHubStudioMessage('#3'), true)
  assert.equal(isValidHubStudioMessage('0'), false)
  assert.equal(isValidHubStudioMessage('OK'), true)
  assert.equal(isValidHubStudioMessage('50'), true)
})
