import assert from 'node:assert/strict'
import test from 'node:test'
import {
  WEDDING_COUPLE_PHOTO_RESTYLE_CREDIT,
  WEDDING_COUPLE_PHOTO_RESTYLE_QUALITY,
  buildWeddingCouplePhotoRestylePrompt,
  listWeddingRestylePhotoChoices,
  parseWeddingCouplePhotoRestyleSlot,
  safeWeddingBackgroundPublicPath,
  weddingCouplePhotoSourceUrl,
  weddingRestyledSlotUrl,
  weddingThemePlatePublicPath,
} from './restyle-wedding-couple-photo'

test('couple photo restyle stays on GPT Image 2 medium and costs 1 credit', () => {
  assert.equal(WEDDING_COUPLE_PHOTO_RESTYLE_QUALITY, 'medium')
  assert.equal(WEDDING_COUPLE_PHOTO_RESTYLE_CREDIT, 1)
})

test('restyled slot url is the saved photo for that slot', () => {
  const saved = {
    coverPhotoUrl: 'https://cdn.example/cover-new.jpg',
    groomImageUrl: 'https://cdn.example/groom-new.jpg',
    brideImageUrl: 'https://cdn.example/bride-new.jpg',
    albumImageUrls: ['https://cdn.example/a0.jpg', 'https://cdn.example/a1.jpg'],
  }
  assert.equal(weddingRestyledSlotUrl('cover', saved), saved.coverPhotoUrl)
  assert.equal(weddingRestyledSlotUrl('groom', saved), saved.groomImageUrl)
  assert.equal(weddingRestyledSlotUrl('bride', saved), saved.brideImageUrl)
  assert.equal(weddingRestyledSlotUrl('album:1', saved), 'https://cdn.example/a1.jpg')
  assert.equal(weddingRestyledSlotUrl('album:9', saved), '')
})

test('restyle slot accepts cover, portraits, and album index', () => {
  assert.deepEqual(parseWeddingCouplePhotoRestyleSlot('cover'), { kind: 'cover', index: 0 })
  assert.deepEqual(parseWeddingCouplePhotoRestyleSlot('bride'), { kind: 'bride', index: 0 })
  assert.deepEqual(parseWeddingCouplePhotoRestyleSlot('album:4'), { kind: 'album', index: 4 })
  assert.equal(parseWeddingCouplePhotoRestyleSlot('album:30'), null)
  assert.equal(parseWeddingCouplePhotoRestyleSlot('album:x'), null)
  assert.equal(parseWeddingCouplePhotoRestyleSlot('../cover'), null)
})

test('theme plate is a local photo, never an svg or a path escape', () => {
  assert.equal(weddingThemePlatePublicPath('toi-gian-nau'), '/wedding/backgrounds/toi-gian-nau.jpg')
  assert.equal(weddingThemePlatePublicPath('song-hy-do'), null)
  assert.equal(weddingThemePlatePublicPath('missing-theme'), null)
  assert.equal(safeWeddingBackgroundPublicPath('/wedding/backgrounds/../secret.jpg'), null)
  assert.equal(safeWeddingBackgroundPublicPath('/wedding/backgrounds/song-hy-do.svg'), null)
})

test('source url follows the slot and ignores other photos', () => {
  const card = {
    sectionConfig: JSON.stringify({ coverPhotoUrl: 'https://cdn.example/cover.jpg' }),
    groomImageUrl: 'https://cdn.example/groom.jpg',
    brideImageUrl: 'https://cdn.example/bride.jpg',
    albumImageUrls: ['https://cdn.example/a.jpg', 'https://cdn.example/b.jpg'],
  }
  assert.equal(weddingCouplePhotoSourceUrl(card, { kind: 'cover', index: 0 }), 'https://cdn.example/cover.jpg')
  assert.equal(weddingCouplePhotoSourceUrl(card, { kind: 'bride', index: 0 }), 'https://cdn.example/bride.jpg')
  assert.equal(weddingCouplePhotoSourceUrl(card, { kind: 'album', index: 1 }), 'https://cdn.example/b.jpg')
  assert.equal(weddingCouplePhotoSourceUrl(card, { kind: 'album', index: 9 }), '')
})

test('restyle prompt locks the bride face and asks for a real photo in the theme', () => {
  const prompt = buildWeddingCouplePhotoRestylePrompt({
    slot: 'bride',
    styleLabel: 'Luxury',
    palette: 'champagne gold, ivory',
    themeLabel: 'Pearl garden',
    venue: 'Nhà hàng Sen',
    hasOutfit: false,
    hasThemePlate: true,
  })
  assert.match(prompt, /same woman/)
  assert.match(prompt, /FACE LOCK/)
  assert.match(prompt, /face shape/)
  assert.match(prompt, /bridal wedding style/)
  assert.match(prompt, /Keep her hair color/)
  assert.match(prompt, /gently smooth the facial skin/)
  assert.match(prompt, /Luxury/)
  assert.match(prompt, /champagne gold, ivory/)
  assert.match(prompt, /Pearl garden/)
  assert.match(prompt, /real photograph/)
  assert.match(prompt, /cartoon/)
  assert.match(prompt, /second attached image is the invitation paper/)
  assert.match(prompt, /Forbidden:[\s\S]*watercolor/)
})

test('couple photo restyle locks both faces', () => {
  const prompt = buildWeddingCouplePhotoRestylePrompt({
    slot: 'album',
    styleLabel: 'Floral',
    palette: 'blush',
    themeLabel: 'Rose garden',
    hasOutfit: false,
    hasThemePlate: false,
  })
  assert.match(prompt, /bride/)
  assert.match(prompt, /groom/)
  assert.match(prompt, /same woman/)
  assert.match(prompt, /same man/)
  assert.match(prompt, /bridal wedding hairstyle/)
  assert.match(prompt, /groom wedding hairstyle/)
  assert.match(prompt, /gently smooth the facial skin/)
  assert.doesNotMatch(prompt, /second attached image/)
})

test('outfit photograph is image two and the paper is image three', () => {
  const prompt = buildWeddingCouplePhotoRestylePrompt({
    slot: 'cover',
    styleLabel: 'Luxury',
    palette: 'ivory',
    themeLabel: 'Lotus',
    hasOutfit: true,
    hasThemePlate: true,
  })
  assert.match(prompt, /second attached image is the wedding clothes only/)
  assert.match(prompt, /third attached image is the invitation paper/)
  assert.match(prompt, /exact gown/)
  assert.match(prompt, /not turn the bridal gown black/)
})

test('an uploaded outfit keeps only the clothes after the face is cut off', () => {
  const prompt = buildWeddingCouplePhotoRestylePrompt({
    slot: 'bride',
    styleLabel: 'Luxury',
    palette: 'ivory',
    themeLabel: 'Lotus',
    hasOutfit: true,
    uploadedOutfit: true,
    hasThemePlate: false,
  })
  assert.match(prompt, /cut off above the neck/)
  assert.match(prompt, /only clothing remains/)
  assert.match(prompt, /second attached image is the wedding clothes only/)
  assert.doesNotMatch(prompt, /shows one bridal gown and one groom outfit, with no person/)
})

test('a chosen place sets the scene and keeps the theme palette without the paper', () => {
  const prompt = buildWeddingCouplePhotoRestylePrompt({
    slot: 'cover',
    styleLabel: 'Luxury',
    palette: 'ivory and gold',
    themeLabel: 'Lotus',
    venue: 'Nhà hàng Sen',
    placeScene: 'Ha Long Bay, Vietnam. Calm green water.',
    hasOutfit: true,
    hasThemePlate: false,
  })
  assert.match(prompt, /Ha Long Bay/)
  assert.match(prompt, /tone-on-tone/)
  assert.match(prompt, /ivory and gold/)
  assert.doesNotMatch(prompt, /invitation paper\./)
  assert.doesNotMatch(prompt, /Nhà hàng Sen/)
})

test('restyle choices skip sample photos and keep the album index', () => {
  const choices = listWeddingRestylePhotoChoices({
    coverPhotoUrl: '/wedding/samples/cover.webp',
    groomImageUrl: 'https://cdn.example/groom.jpg',
    brideImageUrl: '',
    albumImageUrls: ['/wedding/samples/a.webp', 'https://cdn.example/b.jpg'],
  })
  assert.deepEqual(choices.map((choice) => choice.id), ['groom', 'album:1'])
})
