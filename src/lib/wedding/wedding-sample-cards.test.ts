import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'
import { INVITATION_OCCASION_KEYS } from './invitation-occasion'
import { findWeddingBackgroundPreset } from './wedding-background-presets'
import { WEDDING_SAMPLE_CARDS, buildWeddingSampleDemoCard, findWeddingSampleCard, findWeddingSampleInUse, stripWeddingSamplePhotos, weddingEntryLookForNewCard, weddingOccasionDemos, weddingSampleLookOnCard, weddingSamplePhotoUrls, weddingSampleSharedLayoutKey, weddingSamplesWithActiveFirst } from './wedding-sample-cards'

test('a sample card is one background and five couple photos', () => {
  assert.ok(WEDDING_SAMPLE_CARDS.length >= 1)
  for (const sample of WEDDING_SAMPLE_CARDS) {
    if (sample.aiStyleId && !sample.backgroundPresetId) {
      assert.equal(sample.backgroundPresetId, '')
    } else if (!sample.aiStyleId) {
      assert.ok(findWeddingBackgroundPreset(sample.backgroundPresetId))
      if (sample.id === sample.backgroundPresetId || !sample.occasionKey) {
        assert.equal(sample.id, sample.backgroundPresetId)
      }
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

test('a new wedding card starts as the blush envelope', () => {
  const demos = weddingOccasionDemos('wedding')
  assert.equal(demos[0]?.id, 'phong-bi-hong')
  assert.equal(demos.filter((sample) => sample.id === 'phong-bi-hong').length, 1)
  const look = weddingEntryLookForNewCard({
    occasionKey: 'wedding',
    sectionConfig: '{}',
    groomImageUrl: '',
    brideImageUrl: '',
    albumImageUrls: [],
    groomName: 'An',
  })
  assert.ok(look)
  const section = JSON.parse(look.sectionConfig) as { backgroundPresetId?: string; coverPresetId?: string; coverPhotoUrl?: string }
  assert.equal(section.backgroundPresetId, 'phong-bi-hong')
  assert.equal(section.coverPresetId, 'phong_bi_hong')
  assert.equal(section.coverPhotoUrl, undefined)
  assert.equal(look.groomImageUrl, '')
  assert.equal(look.brideImageUrl, '')
  assert.equal(look.groomName, 'An')
  assert.equal(look.selectedStyleId, 'floral')
  assert.equal(
    weddingEntryLookForNewCard({
      occasionKey: 'birthday',
      sectionConfig: '{}',
      groomImageUrl: '',
      brideImageUrl: '',
      albumImageUrls: [],
    }),
    null,
  )
})

test('each card type has its own demos, and wedding keeps the full catalog', () => {
  for (const key of INVITATION_OCCASION_KEYS) {
    const demos = weddingOccasionDemos(key)
    if (key === 'wedding') {
      assert.ok(demos.length > 20, key)
      assert.ok(demos.some((sample) => sample.id === 'long-phung-do'))
      assert.ok(demos.some((sample) => sample.id === 'do-son'))
      assert.ok(demos.some((sample) => sample.id === 'hong-ngoc-trai'))
      assert.ok(demos.some((sample) => sample.id === 'dem-vang'))
      assert.ok(demos.some((sample) => sample.id === 'doi-anh-hong'))
      assert.ok(demos.some((sample) => sample.id === 'ai-luxury'))
      assert.ok(demos.some((sample) => sample.id === 'kho-hong-baby'))
      assert.equal(demos.some((sample) => sample.id.startsWith('sinh-nhat-')), false)
      continue
    }
    assert.equal(demos.length, key === 'birthday' ? 9 : 5, key)
    const photos = demos.flatMap((sample) => weddingSamplePhotoUrls(sample).filter(Boolean))
    assert.equal(new Set(photos).size, photos.length, key)
    for (const sample of demos) assert.ok(weddingSamplePhotoUrls(sample).filter(Boolean).length >= 4, sample.id)
    const looks = demos.map((sample) => sample.backgroundPresetId)
    assert.equal(new Set(looks).size, demos.length, key)
    const flowers = demos.map((sample) => {
      const preset = findWeddingBackgroundPreset(sample.backgroundPresetId)
      assert.ok(preset, sample.id)
      return preset.ornaments.map((item) => item.src).sort().join('|')
    })
    assert.equal(new Set(flowers).size, demos.length, key)
    const demo = buildWeddingSampleDemoCard(demos[0])
    assert.equal(demo?.occasionKey, key)
  }
  const birthday = buildWeddingSampleDemoCard(findWeddingSampleCard('sinh-nhat-dem')!)
  assert.match(birthday?.invitationText || '', /sinh nhật/i)
  assert.equal(birthday?.groomName, 'Ngô Quỳnh')
  assert.equal(birthday?.brideName, '')
  assert.equal(birthday?.brideImageUrl, '')
  assert.equal(birthday?.brideGiftAccountName, '')
  const silkBirthday = buildWeddingSampleDemoCard(findWeddingSampleCard('sinh-nhat-lua')!)
  assert.equal(silkBirthday?.groomName, 'Mai Chi')
  assert.equal(silkBirthday?.brideName, '')
  assert.equal(silkBirthday?.brideImageUrl, '')
  assert.doesNotMatch(`${silkBirthday?.invitationText} ${silkBirthday?.coupleIntro}`, /Bùi An/)
  const rose = buildWeddingSampleDemoCard(findWeddingSampleCard('sinh-nhat-hong')!)
  const man = buildWeddingSampleDemoCard(findWeddingSampleCard('sinh-nhat-son')!)
  assert.equal(rose?.groomName, 'Phan My')
  assert.equal(rose?.brideName, '')
  assert.equal(rose?.brideImageUrl, '')
  assert.equal(man?.groomName, 'Trần Khôi')
  assert.equal(man?.brideImageUrl, '')
  assert.equal(
    findWeddingSampleInUse({ backgroundPresetId: 'dem-vang', occasionKey: 'birthday' })?.id,
    'sinh-nhat-dem',
  )
  assert.equal(
    findWeddingSampleInUse({ backgroundPresetId: 'dem-vang', occasionKey: 'anniversary' })?.id,
    'dem-vang',
  )
})
