import assert from 'node:assert/strict'
import test from 'node:test'
import { repeatWeddingOrnamentsDown, weddingOrnamentPlain } from './wedding-background-presets'
import {
  canEditWeddingCardOrnaments,
  canEditWeddingOrnaments,
  isWeddingOrnamentLayoutKey,
  weddingCardOrnamentLayoutKey,
  parseWeddingOrnamentList,
  weddingOrnamentDeviceKey,
  weddingOrnamentLayoutKey,
  weddingOrnamentSaveKey,
  weddingOrnamentsForDevice,
  weddingOrnamentsForKey,
} from './wedding-background-ornament-store'

test('ornament layout key follows the ready set, otherwise the AI theme, otherwise the plate', () => {
  assert.equal(weddingOrnamentLayoutKey({ backgroundPresetId: 'sen-vang', masterImageUrl: 'https://cdn.example/ai.png' }), 'preset:sen-vang')
  assert.equal(weddingOrnamentLayoutKey({ backgroundPresetId: 'sen-vang', backgroundKitStyleId: 'luxury' }), 'preset:sen-vang')
  assert.equal(
    weddingOrnamentLayoutKey({ backgroundKitStyleId: 'luxury', masterImageUrl: 'https://cdn.example/ai.png' }),
    'kit:luxury',
  )
  assert.equal(weddingOrnamentLayoutKey({ masterImageUrl: 'https://cdn.example/ai.png' }), 'image:https://cdn.example/ai.png')
  assert.equal(weddingOrnamentLayoutKey({ backgroundPresetId: 'missing' }), '')
  assert.equal(weddingOrnamentLayoutKey({ backgroundKitStyleId: 'nope' }), '')
  assert.equal(isWeddingOrnamentLayoutKey('kit:luxury@mobile'), true)
  assert.equal(isWeddingOrnamentLayoutKey('kit:nope@mobile'), false)
})

test('catalog flowers and pasted image links can be saved, and an empty list clears the layer', () => {
  assert.deepEqual(parseWeddingOrnamentList([]), [])
  assert.equal(parseWeddingOrnamentList([{ src: 'https://cdn.example/cartoon.svg', x: 0, y: 0, w: 20 }]), null)
  assert.equal(
    parseWeddingOrnamentList([{ src: 'https://cdn.example/peony.png', x: 8, y: 8, w: 28 }])?.[0]?.src,
    'https://cdn.example/peony.png',
  )
  const saved = parseWeddingOrnamentList([
    { src: '/wedding/backgrounds/ornaments/peony-bloom.png', x: 10.24, y: 4, w: 40, opacity: 0.8 },
  ])
  assert.equal(saved?.[0]?.x, 10.2)
  assert.equal(saved?.[0]?.w, 40)
  const softened = parseWeddingOrnamentList([
    { src: '/wedding/backgrounds/ornaments/peony-bloom.png', x: 8, y: 8, w: 28, blur: 4, fade: 0.5 },
  ])
  assert.equal(softened?.[0]?.blur, 4)
  assert.equal(softened?.[0]?.fade, 0.5)
  const rising = parseWeddingOrnamentList([
    { src: '/wedding/backgrounds/ornaments/peony-bloom.png', x: 8, y: 8, w: 28, motion: 'rise' },
  ])
  assert.equal(rising?.[0]?.motion, 'rise')
  assert.equal(
    parseWeddingOrnamentList([{ src: '/wedding/backgrounds/ornaments/peony-bloom.png', x: 8, y: 8, w: 28, motion: 'still' }])?.[0]?.motion,
    undefined,
  )
  assert.equal(parseWeddingOrnamentList([{ src: '/wedding/backgrounds/ornaments/peony-bloom.png', x: 8, y: 8, w: 28, motion: 'spin' }]), null)
  assert.equal(parseWeddingOrnamentList([{ src: '/wedding/backgrounds/ornaments/peony-bloom.png', x: 8, y: 8, w: 28, blur: 40 }]), null)
  assert.equal(
    parseWeddingOrnamentList([{ src: '/wedding/backgrounds/ornaments/peony-bloom.png', x: 8, y: 8, w: 28, blur: 0, fade: 0 }])?.[0]?.blur,
    undefined,
  )
  const defaults = [{ src: '/wedding/backgrounds/ornaments/lotus-bloom.png', x: 0, y: 0, w: 20 }]
  assert.equal(weddingOrnamentsForKey(defaults, { 'preset:sen-vang': [] }, 'preset:sen-vang').length, 0)
  assert.equal(weddingOrnamentsForKey(defaults, {}, 'preset:sen-vang').length, 1)
})

test('the local dev account can edit the flower layer', () => {
  assert.equal(canEditWeddingOrnaments({ role: 'user', email: 'dev@local.test' }), true)
  assert.equal(canEditWeddingOrnaments({ role: 'admin', email: 'guest@example.com' }), true)
  assert.equal(canEditWeddingOrnaments({ role: 'user', email: 'guest@example.com' }), false)
})

test('each card owner edits only that card, and an admin can edit it too', () => {
  const cardId = '4e09e349-2208-4e8d-a422-3303e57e35f6'
  const key = weddingCardOrnamentLayoutKey(cardId)
  assert.equal(key, `card:${cardId}`)
  assert.equal(weddingCardOrnamentLayoutKey('not-a-card'), '')
  assert.equal(isWeddingOrnamentLayoutKey(`${key}@desktop`), true)
  assert.equal(isWeddingOrnamentLayoutKey(`${key}@mobile`), true)
  assert.equal(
    canEditWeddingCardOrnaments({ role: 'user', email: 'owner@example.com', userId: 'owner', ownerId: 'owner' }),
    true,
  )
  assert.equal(
    canEditWeddingCardOrnaments({ role: 'user', email: 'guest@example.com', userId: 'guest', ownerId: 'owner' }),
    false,
  )
  assert.equal(
    canEditWeddingCardOrnaments({ role: 'admin', email: 'admin@example.com', userId: 'admin', ownerId: 'owner' }),
    true,
  )
})

test('admin flower saves use the shared background, and a customer save stays on that card', () => {
  const cardId = '4e09e349-2208-4e8d-a422-3303e57e35f6'
  assert.equal(
    weddingOrnamentSaveKey({ templateEditor: true, cardId, device: 'desktop', sharedBaseKey: 'preset:sen-vang' }),
    'preset:sen-vang@desktop',
  )
  assert.equal(
    weddingOrnamentSaveKey({ templateEditor: false, cardId, device: 'mobile', sharedBaseKey: 'preset:sen-vang' }),
    `card:${cardId}@mobile`,
  )
  assert.equal(
    weddingOrnamentSaveKey({ templateEditor: true, cardId, device: 'desktop', sharedBaseKey: '' }),
    `card:${cardId}@desktop`,
  )
})

test('flowers running down the letter still parse for a shared or private save', () => {
  const sheet = [
    { src: '/wedding/backgrounds/ornaments/moc-bloom.png', x: -18, y: -3, w: 46, opacity: 0.94 },
    { src: '/wedding/backgrounds/ornaments/moc-sprig.png', x: 64, y: 0, w: 32 },
    { src: '/wedding/backgrounds/ornaments/moc-leaf.png', x: -14, y: -2, w: 38, anchor: 'bottom' as const },
    { src: '/wedding/backgrounds/ornaments/moc-bloom.png', x: 52, y: -8, w: 42, anchor: 'bottom' as const, opacity: 0.48 },
    { src: '/wedding/backgrounds/ornaments/moc-sprig.png', x: 68, y: 4, w: 26, anchor: 'bottom' as const },
  ]
  const placed = repeatWeddingOrnamentsDown(sheet, 6).map((item) => weddingOrnamentPlain(item))
  const parsed = parseWeddingOrnamentList(placed)
  assert.equal(parsed?.length, placed.length)
  assert.ok(placed.length > 24)
  const tooMany = Array.from({ length: 121 }, () => placed[0])
  assert.equal(parseWeddingOrnamentList(tooMany), null)
})

test('desktop and mobile flower layouts stay separate', () => {
  const base = weddingOrnamentLayoutKey({ backgroundPresetId: 'sen-vang' })
  const desktop = weddingOrnamentDeviceKey(base, 'desktop')
  const mobile = weddingOrnamentDeviceKey(base, 'mobile')
  assert.equal(isWeddingOrnamentLayoutKey(desktop), true)
  assert.equal(isWeddingOrnamentLayoutKey('preset:missing@desktop'), false)
  const defaults = [{ src: '/wedding/backgrounds/ornaments/lotus-bloom.png', x: 0, y: 0, w: 20 }]
  const layouts = {
    [desktop]: [{ src: '/wedding/backgrounds/ornaments/lotus-leaf.png', x: 4, y: 8, w: 30 }],
  }
  assert.equal(weddingOrnamentsForDevice(defaults, layouts, base, 'desktop')[0]?.src.endsWith('lotus-leaf.png'), true)
  assert.equal(weddingOrnamentsForDevice(defaults, layouts, base, 'mobile')[0]?.src.endsWith('lotus-bloom.png'), true)
  assert.equal(weddingOrnamentsForDevice(defaults, { [mobile]: [] }, base, 'mobile').length, 0)
})
