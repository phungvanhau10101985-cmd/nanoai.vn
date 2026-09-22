import assert from 'node:assert/strict'
import test from 'node:test'
import { isPgTransientError } from '@/lib/db/pg-transient'

test('detects node-pg pool connect timeout and too-many-clients', () => {
  assert.equal(isPgTransientError(new Error('timeout exceeded when trying to connect')), true)
  assert.equal(isPgTransientError({ message: 'sorry, too many clients already', code: '53300' }), true)
  assert.equal(isPgTransientError({ code: 'ECONNRESET', message: 'read ECONNRESET' }), true)
  assert.equal(isPgTransientError('Connection terminated unexpectedly'), true)
})

test('does not treat syntax or app errors as transient', () => {
  assert.equal(isPgTransientError(new Error('invalid input syntax for type uuid')), false)
  assert.equal(isPgTransientError(new Error('Not found')), false)
  assert.equal(isPgTransientError(null), false)
})
