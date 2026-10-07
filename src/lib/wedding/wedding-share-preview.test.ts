import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildWeddingSharePreviewModel,
  buildWeddingSharePreviewSvg,
  weddingPublicShareImageUrl,
  weddingShareLook,
} from './wedding-share-preview'

const card = {
  slug: 'hau-lan',
  groomName: 'Phùng Hậu',
  brideName: 'Diệu Lan',
  weddingDate: '2026-10-10' as string | null,
  weddingTime: '17:00',
  venue: 'Nhà hàng Sen Vàng',
  invitationText: 'Trân trọng kính mời quý khách đến chung vui.',
  selectedStyleId: 'traditional_vietnamese',
  masterImageUrl: 'https://cdn.example/lotus.jpg',
  sectionConfig: JSON.stringify({ coverPresetId: 'lotus_viet' }),
  groomImageUrl: '',
  brideImageUrl: '',
}

test('share look follows the selected cover preset', () => {
  assert.equal(weddingShareLook('luxury', 'classic_red').styleId, 'traditional_vietnamese')
  assert.equal(weddingShareLook('traditional_vietnamese').frame, '#e8b84a')
  assert.equal(weddingShareLook('modern').panel, '#0f172a')
})

test('share preview reads as a guest invitation', () => {
  const model = buildWeddingSharePreviewModel(card, 'Nguyễn An')
  assert.equal(model.groomName, 'Phùng Hậu')
  assert.equal(model.brideName, 'Diệu Lan')
  assert.equal(model.dateLine, '10/10/2026  ·  17:00')
  assert.equal(model.venueLine, 'Nhà hàng Sen Vàng')
  assert.equal(model.inviteLine, 'Kính mời Nguyễn An')
  assert.equal(model.look.styleId, 'traditional_vietnamese')
  assert.equal(model.backgroundUrl, 'https://cdn.example/lotus.jpg')
})

test('share preview keeps the weekday next to the time', () => {
  const model = buildWeddingSharePreviewModel({ ...card, weddingTime: '16:30, Thứ 5' })
  assert.equal(model.dateLine, '10/10/2026  ·  16:30 · Thứ 5')
})

test('share preview uses the written invitation when there is no guest name', () => {
  const model = buildWeddingSharePreviewModel(card)
  assert.equal(model.inviteLine, 'Trân trọng kính mời quý khách đến chung vui.')
})

test('share svg keeps invitation text and escapes names', () => {
  const svg = buildWeddingSharePreviewSvg(buildWeddingSharePreviewModel({ ...card, groomName: 'A & B' }))
  assert.match(svg, /THIỆP MỜI/)
  assert.match(svg, /A &amp; B/)
  assert.match(svg, /Trân trọng kính mời quý khách đến chung vui\./)
  assert.equal(svg.includes('<script'), false)
})

test('share image url points at the composed preview', () => {
  const url = new URL(weddingPublicShareImageUrl('https://nanoai.vn', card, 'An'))
  assert.equal(url.pathname, '/thiep-moi-cuoi/hau-lan/share-preview')
  assert.equal(url.searchParams.get('guest'), 'An')
  assert.ok(url.searchParams.get('v'))
})
