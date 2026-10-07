import assert from 'node:assert/strict'
import test from 'node:test'
import sharp from 'sharp'
import {
  composePartnerSaleIconPng,
  partnerSaleIconDateBand,
  partnerSaleIconDateGlyphRects,
  partnerSaleIconDateMarks,
} from '@/lib/partner-website/promotions/partner-sale-icon-compose'

test('sale date glyphs span most of the icon width', () => {
  const size = 512
  const rects = partnerSaleIconDateGlyphRects(size, '10/10')
  assert.ok(rects.length > 20)
  const minY = Math.min(...rects.map((rect) => rect.y))
  const maxY = Math.max(...rects.map((rect) => rect.y + rect.h))
  const minX = Math.min(...rects.map((rect) => rect.x))
  const maxX = Math.max(...rects.map((rect) => rect.x + rect.w))
  assert.ok(maxX - minX >= size * 0.7, 'date should be wide, not a corner chip')
  assert.ok(maxY - minY >= size * 0.2, 'date should be tall enough to read at tab size')
  const band = partnerSaleIconDateBand(size)
  assert.ok(minY >= band.top)
  assert.ok(maxY <= band.top + band.height)
  assert.equal(partnerSaleIconDateMarks(size, '10/10').slashes.length, 1)
})

test('composed sale icon keeps the mark color and paints a dark date band', async () => {
  const mark = await sharp({
    create: { width: 80, height: 80, channels: 3, background: { r: 249, g: 115, b: 22 } },
  })
    .png()
    .toBuffer()
  const png = await composePartnerSaleIconPng({ mark, day: 10, month: 10, size: 128 })
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  assert.equal(info.width, 128)
  assert.equal(info.height, 128)
  const at = (x: number, y: number) => {
    const i = (y * info.width + x) * 4
    return [data[i], data[i + 1], data[i + 2]] as const
  }
  const logo = at(64, 10)
  assert.ok(logo[0] > 200 && logo[1] > 70 && logo[1] < 160 && logo[2] < 80, `logo pixel ${logo.join(',')}`)
  const bandCorner = at(2, 126)
  assert.ok(bandCorner[0] < 40 && bandCorner[1] < 40 && bandCorner[2] < 40, `band ${bandCorner.join(',')}`)
  const bandTop = partnerSaleIconDateBand(128).top
  let white = 0
  let bandPx = 0
  for (let y = bandTop; y < 128; y += 1) {
    for (let x = 0; x < 128; x += 1) {
      bandPx += 1
      const [r, g, b] = at(x, y)
      if (r > 220 && g > 220 && b > 220) white += 1
    }
  }
  assert.ok(white / bandPx > 0.08, `date ink ${white}/${bandPx}`)
})
