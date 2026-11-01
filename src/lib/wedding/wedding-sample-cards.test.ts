import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'
import { findWeddingBackgroundPreset } from './wedding-background-presets'
import { WEDDING_SAMPLE_CARDS, buildWeddingSampleDemoCard, findWeddingSampleCard, findWeddingSampleInUse, stripWeddingSamplePhotos, weddingSampleLookOnCard, weddingSamplePhotoUrls, weddingSampleSharedLayoutKey, weddingSamplesWithActiveFirst } from './wedding-sample-cards'

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

test('the rose frame stays on rose themes and leaves the others', () => {
  const section = (id: string) => JSON.parse(buildWeddingSampleDemoCard(findWeddingSampleCard(id)!)!.sectionConfig) as {
    coverPresetId?: string
    groomPortraitShellPresetId?: string
    groomPortraitShellMode?: string
  }
  assert.equal(section('kho-hong-buom').coverPresetId, 'pearl_rose')
  assert.equal(section('kho-hong-baby').coverPresetId, 'pearl_rose')
  assert.equal(section('kho-sen-hong').coverPresetId, 'net_sen')
  assert.equal(section('kho-sen-hong').groomPortraitShellPresetId, 'net_sen')
  assert.equal(section('kho-hac-sen').coverPresetId, 'plain_photo')
  assert.equal(section('kho-hac-sen').groomPortraitShellMode, 'none')
  assert.equal(section('ai-ethereal').coverPresetId, 'net_mong')
  assert.equal(section('ai-minimal').coverPresetId, 'plain_photo')
  assert.equal(section('ai-minimal').groomPortraitShellMode, 'none')
  assert.equal(section('ai-floral').coverPresetId, 'pearl_rose')
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

test('applying a sample keeps real photos and switches the look', () => {
  const current = WEDDING_SAMPLE_CARDS[0]
  const nextSample = WEDDING_SAMPLE_CARDS.find((item) => item.id !== current.id && !item.libraryImageUrl && !item.aiStyleId)
  assert.ok(nextSample)
  const card = {
    groomImageUrl: current.groomImageUrl,
    brideImageUrl: 'https://cdn.example/bride.jpg',
    albumImageUrls: ['https://cdn.example/a.jpg'],
    sectionConfig: JSON.stringify({
      backgroundPresetId: current.id,
      coverPhotoUrl: 'https://cdn.example/cover.jpg',
      deviceShell: { mobile: { x: 1, y: 2 } },
    }),
  }
  const look = weddingSampleLookOnCard(card, nextSample)
  assert.ok(look)
  assert.equal(look.groomImageUrl, '')
  assert.equal(look.brideImageUrl, 'https://cdn.example/bride.jpg')
  assert.deepEqual(look.albumImageUrls, ['https://cdn.example/a.jpg'])
  const section = JSON.parse(look.sectionConfig) as { backgroundPresetId?: string; coverPhotoUrl?: string; deviceShell?: unknown }
  assert.equal(section.backgroundPresetId, nextSample.id)
  assert.equal(section.coverPhotoUrl, 'https://cdn.example/cover.jpg')
  assert.equal(section.deviceShell, undefined)
  assert.ok(look.plateUrls.length > 0)
  assert.equal(look.masterImageUrl, null)
})

test('the sample in use stays first and a preset wins over a leftover library image', () => {
  const preset = findWeddingSampleCard('vuon-kinh-hong')
  const kit = findWeddingSampleCard('ai-floral')
  const library = findWeddingSampleCard('kho-hong-buom')
  assert.ok(preset && kit && library?.libraryImageUrl)
  assert.equal(
    findWeddingSampleInUse({ backgroundPresetId: preset.backgroundPresetId, masterImageUrl: library.libraryImageUrl })?.id,
    preset.id,
  )
  assert.equal(
    findWeddingSampleInUse({ backgroundKitStyleId: kit.aiStyleId, masterImageUrl: library.libraryImageUrl })?.id,
    kit.id,
  )
  assert.equal(findWeddingSampleInUse({ masterImageUrl: library.libraryImageUrl })?.id, library.id)
  const ordered = weddingSamplesWithActiveFirst(WEDDING_SAMPLE_CARDS, library.id)
  assert.equal(ordered[0]?.id, library.id)
  assert.equal(ordered.length, WEDDING_SAMPLE_CARDS.length)
  assert.equal(new Set(ordered.map((sample) => sample.id)).size, WEDDING_SAMPLE_CARDS.length)
})
