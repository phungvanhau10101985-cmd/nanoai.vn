import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildHubFeatureCatalog,
  resolveHubFeatureSelection,
  studioFeatureKey,
  toolFeatureKey,
} from '@/lib/hub-chat/hub-feature-catalog'

test('catalog includes studio presets and standalone tools', () => {
  const catalog = buildHubFeatureCatalog('vi')
  assert.ok(catalog.some((e) => e.key === studioFeatureKey('packaging_kit')))
  assert.ok(catalog.some((e) => e.key === toolFeatureKey('/tao-giao-trinh')))
  assert.ok(catalog.some((e) => e.key === toolFeatureKey('/giao-trinh')))
  assert.ok(catalog.some((e) => e.key === toolFeatureKey('/tao-thiep-moi-cuoi-ai')))
  assert.ok(!catalog.some((e) => e.key === studioFeatureKey('wedding_invite')))
})

test('resolveHubFeatureSelection routes create curriculum programmatically', () => {
  const key = toolFeatureKey('/tao-giao-trinh')
  const resolved = resolveHubFeatureSelection(key, 'vi')
  assert.equal(resolved?.kind, 'standalone')
  if (resolved?.kind === 'standalone') assert.equal(resolved.href, '/tao-giao-trinh')
})

test('resolveHubFeatureSelection routes studio preset programmatically', () => {
  const key = studioFeatureKey('landing_page')
  const resolved = resolveHubFeatureSelection(key, 'vi')
  assert.equal(resolved?.kind, 'studio')
  if (resolved?.kind === 'studio') assert.equal(resolved.presetId, 'landing_page')
})
