import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { REDIS_COMMAND_TIMEOUT_MS, REDIS_LOCAL_STALL_MS, redisFailureTriggersCooldown } from './redis'

describe('redis cooldown', () => {
  const timeout = new Error('Command timed out')

  it('keeps Redis on when a timeout comes from a Node event-loop stall', () => {
    assert.equal(redisFailureTriggersCooldown(timeout, true), false)
  })

  it('cools down on a timeout while the event loop is healthy', () => {
    assert.equal(redisFailureTriggersCooldown(timeout, false), true)
  })

  it('cools down on connection errors even during a stall', () => {
    assert.equal(redisFailureTriggersCooldown(new Error('connect ECONNREFUSED 127.0.0.1:6379'), true), true)
  })

  it('gives commands more time than a local stall', () => {
    assert.ok(REDIS_COMMAND_TIMEOUT_MS > REDIS_LOCAL_STALL_MS)
  })
})
