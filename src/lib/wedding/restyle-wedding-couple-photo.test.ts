import assert from 'node:assert/strict'
import test from 'node:test'
import {
  WEDDING_COUPLE_PHOTO_RESTYLE_CREDIT,
  WEDDING_COUPLE_PHOTO_RESTYLE_QUALITY,
  buildWeddingCouplePhotoRestylePrompt,
  parseWeddingCouplePhotoRestyleSlot,
  safeWeddingBackgroundPublicPath,
  weddingCouplePhotoSourceUrl,
  weddingThemePlatePublicPath,
} from './restyle-wedding-couple-photo'

test('couple photo restyle stays on GPT Image 2 medium and costs 1 credit', () => {
  assert.equal(WEDDING_COUPLE_PHOTO_RESTYLE_QUALITY, 'medium')
  assert.equal(WEDDING_COUPLE_PHOTO_RESTYLE_CREDIT, 1)
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
