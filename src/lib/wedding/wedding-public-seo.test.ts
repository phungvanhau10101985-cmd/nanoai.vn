import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildWeddingPublicDescription,
  buildWeddingPublicJsonLd,
  weddingPlainText,
  weddingPublicOgImage,
} from './wedding-public-seo'

const base = {
  groomName: 'Hậu',
  brideName: 'Lan',
  weddingDate: '2026-10-10' as string | null,
  weddingTime: '11:00',
  venue: 'Nhà hàng Sen',
  mapUrl: 'https://maps.example/sen',
  invitationText: '',
  masterImageUrl: 'https://cdn.example/cover.jpg',
  groomImageUrl: '',
  brideImageUrl: '',
  slug: 'hau-lan',
}

function card(partial: Partial<typeof base> = {}) {
  return { ...base, ...partial }
}

test('weddingPlainText strips tags and shortens long copy', () => {
  assert.equal(weddingPlainText('<p>Xin chào [guest]</p>'), 'Xin chào')
  assert.equal(weddingPlainText('a '.repeat(200), 20).endsWith('…'), true)
})

test('wedding public OG prefers master image', () => {
  assert.equal(
    weddingPublicOgImage(card({ groomImageUrl: 'https://cdn.example/g.jpg' })),
    'https://cdn.example/cover.jpg',
  )
})

test('wedding public JSON-LD is Event when date exists', () => {
  const json = buildWeddingPublicJsonLd(card({}), 'https://nanoai.vn/thiep-moi-cuoi/hau-lan')
  assert.equal(json['@type'], 'Event')
  assert.equal(json.startDate, '2026-10-10T11:00:00')
  assert.equal(json.name, 'Lễ cưới Hậu & Lan')
})

test('wedding public JSON-LD is WebPage without a wedding date', () => {
  const json = buildWeddingPublicJsonLd(card({ weddingDate: null }), 'https://nanoai.vn/thiep-moi-cuoi/hau-lan')
  assert.equal(json['@type'], 'WebPage')
})

test('wedding public description uses invitation text when present', () => {
  assert.equal(
    buildWeddingPublicDescription(card({ invitationText: 'Kính mời dự lễ cưới.' })),
    'Kính mời dự lễ cưới.',
  )
})
