import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'
import { findWeddingBackgroundPreset } from './wedding-background-presets'
import { WEDDING_SAMPLE_CARDS, buildWeddingSampleDemoCard, findWeddingSampleCard, stripWeddingSamplePhotos, weddingSamplePhotoUrls, weddingSampleSharedLayoutKey } from './wedding-sample-cards'

test('a sample card is one background and five couple photos', () => {
  assert.ok(WEDDING_SAMPLE_CARDS.length >= 1)
  for (const sample of WEDDING_SAMPLE_CARDS) {
    if (sample.aiStyleId) {
      assert.equal(sample.backgroundPresetId, '')
    } else {
      assert.equal(sample.id, sample.backgroundPresetId)
      assert.ok(findWeddingBackgroundPreset(sample.backgroundPresetId))
    }
    assert.equal(findWeddingSampleCard(sample.id)?.coverPhotoUrl, sample.coverPhotoUrl)
    const urls = weddingSamplePhotoUrls(sample)
    assert.equal(urls.length, 5)
    assert.equal(new Set(urls).size, 5)
    for (const url of urls) {
      assert.equal(existsSync(join(process.cwd(), 'public', url)), true, url)
    }
    const demo = buildWeddingSampleDemoCard(sample)
    assert.ok(demo)
    assert.equal(demo.groomImageUrl, sample.groomImageUrl)
    assert.equal(demo.albumImageUrls.length, 2)
    assert.equal(JSON.parse(demo.sectionConfig).coverPhotoUrl, sample.coverPhotoUrl)
    if (sample.libraryImageUrl) {
      assert.equal(demo.masterImageUrl, sample.libraryImageUrl)
      assert.equal(JSON.parse(demo.sectionConfig).backgroundKitStyleId || '', '')
      assert.equal(weddingSampleSharedLayoutKey(sample), `image:${sample.libraryImageUrl}`)
    } else if (sample.aiStyleId) {
      assert.equal(JSON.parse(demo.sectionConfig).backgroundKitStyleId, sample.aiStyleId)
      assert.equal(weddingSampleSharedLayoutKey(sample), `kit:${sample.aiStyleId}`)
    } else {
      assert.equal(weddingSampleSharedLayoutKey(sample), `preset:${sample.backgroundPresetId}`)
      assert.equal(JSON.parse(demo.sectionConfig).albumLayoutId, undefined)
    }
  }
})

test('editor drops sample photos and keeps a real photo', () => {
  const sample = WEDDING_SAMPLE_CARDS[0]
  const card = {
    groomImageUrl: sample.groomImageUrl,
    brideImageUrl: 'https://cdn.example/bride.jpg',
    albumImageUrls: [sample.albumImageUrls[0], 'https://cdn.example/a.jpg'],
    sectionConfig: JSON.stringify({ coverPhotoUrl: sample.coverPhotoUrl, backgroundPresetId: sample.id }),
  }
  const next = stripWeddingSamplePhotos(card)
  assert.equal(next.groomImageUrl, '')
  assert.equal(next.brideImageUrl, 'https://cdn.example/bride.jpg')
  assert.deepEqual(next.albumImageUrls, ['https://cdn.example/a.jpg'])
  const section = JSON.parse(next.sectionConfig) as { coverPhotoUrl?: string; backgroundPresetId?: string }
  assert.equal(section.coverPhotoUrl, undefined)
  assert.equal(section.backgroundPresetId, sample.id)
  assert.equal(stripWeddingSamplePhotos(next), next)
})
