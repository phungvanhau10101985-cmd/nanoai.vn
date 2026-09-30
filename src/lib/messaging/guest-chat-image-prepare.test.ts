import assert from 'node:assert/strict'
import test from 'node:test'
import sharp from 'sharp'
import { prepareGuestChatImageForBunny } from './guest-chat-image'

function jpegBytes(): Buffer {
  return Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(40, 0x11)])
}

test('mobile photo with empty MIME still uploads as jpeg when bytes are jpeg', async () => {
  const raw = jpegBytes()
  const out = await prepareGuestChatImageForBunny(raw, '', 'IMG_2048.HEIC')
  assert.ok(!('error' in out))
  if ('error' in out) return
  assert.equal(out.mime, 'image/jpeg')
  assert.equal(out.buffer[0], 0xff)
})

test('image/jpg from Android is stored as image/jpeg', async () => {
  const out = await prepareGuestChatImageForBunny(jpegBytes(), 'image/jpg', 'photo.jpg')
  assert.ok(!('error' in out))
  if ('error' in out) return
  assert.equal(out.mime, 'image/jpeg')
})

test('webp is converted to jpeg before Bunny, same as 188 admin upload', async () => {
  const webp = await sharp({
    create: { width: 8, height: 8, channels: 3, background: { r: 20, g: 40, b: 60 } },
  })
    .webp()
    .toBuffer()
  const out = await prepareGuestChatImageForBunny(webp, 'image/webp', 'shot.webp')
  assert.ok(!('error' in out))
  if ('error' in out) return
  assert.equal(out.mime, 'image/jpeg')
  assert.equal(out.buffer[0], 0xff)
  assert.equal(out.buffer[1], 0xd8)
})

test('undecodable HEIC is rejected instead of stored as a file phones cannot show', async () => {
  const fake = Buffer.alloc(64, 0)
  fake.write('ftyp', 4, 'ascii')
  fake.write('heic', 8, 'ascii')
  const out = await prepareGuestChatImageForBunny(fake, '', 'IMG.HEIC')
  assert.ok('error' in out)
})
