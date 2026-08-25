import assert from 'node:assert/strict'
import test from 'node:test'
import { buildAiImageColorFacts, mergeAiImageColorPrompt } from './merge-ai-image-color-prompt'

test('appends user-picked hex colors to the prompt', () => {
  const merged = mergeAiImageColorPrompt('vải linen kem', { main: '#c2410c', accent: '#fb923c' })
  assert.match(merged, /vải linen kem/)
  assert.match(merged, /main #c2410c/)
  assert.match(merged, /supporting #fb923c/)
})

test('skips a duplicate accent and keeps facts when the prompt is empty', () => {
  assert.equal(
    buildAiImageColorFacts({ main: '#abc', accent: '#AABBCC' }),
    buildAiImageColorFacts({ main: '#aabbcc' })
  )
  assert.match(mergeAiImageColorPrompt('  ', { main: '#111111' }), /main #111111/)
  assert.equal(mergeAiImageColorPrompt('studio light', { main: '', accent: '' }), 'studio light')
})
