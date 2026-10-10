import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import sharp from 'sharp'
import {
  fitLocalizedLabelText,
  fitPosterParagraphText,
  layoutClippedLabelSlots,
  overlayBoxCoversProductSubject,
  overlayLabelTextWasClipped,
  overlayRegionIsProductPhoto,
  overlayTranslatedText,
} from '../../translate-overlay'

describe('translated text photo guard', () => {
  it('widens a translated size-guide label at 10px instead of clipping it', () => {
    const fitted = fitLocalizedLabelText(
      'Chiều dài giày cm',
      { x: 52, y: 464, width: 56, height: 17 },
      697,
      1024
    )
    assert.ok(fitted)
    assert.ok(fitted.fontSize >= 10)
    assert.ok(fitted.box.width > 56)
    assert.equal(fitted.lines.join(' '), 'Chiều dài giày cm')
  })

  it('enlarges translated poster paragraphs to the readable 188 layout', () => {
    const first = fitPosterParagraphText(
      'Một đôi giày được làm bằng cả tấm lòng, chi tiết thường là điều thể hiện rõ nhất',
      { x: 171, y: 354, width: 363, height: 16 },
      697,
      1024
    )
    assert.ok(first)
    assert.equal(first.fontSize, 14)
    assert.equal(first.lines.length, 2)
    assert.ok(first.box.height >= 32)

    const last = fitPosterParagraphText(
      'Đã tạo nên một đôi giày tràn đầy yêu thương',
      { x: 270, y: 416, width: 163, height: 17 },
      697,
      1024
    )
    assert.ok(last)
    assert.equal(last.lines.length, 1)
    assert.ok(last.box.width >= 300)
    assert.ok(last.fontSize >= 14)
  })

  it('never renders a poster paragraph below the mobile-readable 188 minimum', () => {
    const tinyCaption = fitPosterParagraphText(
      'Được chế tác tỉ mỉ bằng tâm huyết, không bỏ sót bất kỳ tiểu tiết nhỏ nào dù ít ai để ý',
      { x: 265, y: 387, width: 174, height: 9 },
      697,
      1024
    )
    assert.ok(tinyCaption)
    assert.equal(tinyCaption.fontSize, 14)
    assert.ok(tinyCaption.box.height >= tinyCaption.lines.length * tinyCaption.lineHeight + 4)
  })

  it('does not mistake a bright cream text panel for a product photo', async () => {
    const width = 390
    const height = 20
    const pixels = Buffer.alloc(width * height * 3)
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const offset = (y * width + x) * 3
        const darkBand = y >= height / 2
        pixels[offset] = darkBand ? 180 : 245
        pixels[offset + 1] = darkBand ? 172 : 239
        pixels[offset + 2] = darkBand ? 164 : 230
      }
    }
    const image = await sharp(pixels, { raw: { width, height, channels: 3 } }).png().toBuffer()

    assert.equal(
      await overlayRegionIsProductPhoto(image, { x: 0, y: 0, width, height }, width, height),
      false
    )
  })

  it('does not mistake black labels on a neutral gray size guide for a product photo', async () => {
    const width = 64
    const height = 24
    const pixels = Buffer.alloc(width * height * 3)
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const offset = (y * width + x) * 3
        const ink = (x > 8 && x < 15) || (x > 25 && x < 32) || (y > 15 && y < 19)
        const value = ink ? 45 : 224
        pixels[offset] = value
        pixels[offset + 1] = value
        pixels[offset + 2] = value
      }
    }
    const image = await sharp(pixels, { raw: { width, height, channels: 3 } }).png().toBuffer()

    assert.equal(
      await overlayRegionIsProductPhoto(image, { x: 0, y: 0, width, height }, width, height),
      false
    )
  })

  it('continues protecting a colored, textured product region', async () => {
    const width = 220
    const height = 160
    const pixels = Buffer.alloc(width * height * 3)
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const offset = (y * width + x) * 3
        const texture = ((x * 17 + y * 29) % 81) - 40
        pixels[offset] = Math.max(0, Math.min(255, 145 + texture))
        pixels[offset + 1] = Math.max(0, Math.min(255, 92 + texture))
        pixels[offset + 2] = Math.max(0, Math.min(255, 48 + texture))
      }
    }
    const image = await sharp(pixels, { raw: { width, height, channels: 3 } }).png().toBuffer()

    assert.equal(
      await overlayRegionIsProductPhoto(image, { x: 0, y: 0, width, height }, width, height),
      true
    )
    assert.equal(overlayBoxCoversProductSubject({ width, height }, width, height), true)
  })

  it('still draws a short Chinese line that sits on leather', async () => {
    const width = 768
    const height = 1024
    const pixels = Buffer.alloc(width * height * 3)
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const offset = (y * width + x) * 3
        const texture = ((x * 17 + y * 29) % 81) - 40
        pixels[offset] = Math.max(0, Math.min(255, 145 + texture))
        pixels[offset + 1] = Math.max(0, Math.min(255, 92 + texture))
        pixels[offset + 2] = Math.max(0, Math.min(255, 48 + texture))
      }
    }
    const image = await sharp(pixels, { raw: { width, height, channels: 3 } }).png().toBuffer()
    const box = { x: 251, y: 602, width: 263, height: 44 }
    assert.equal(await overlayRegionIsProductPhoto(image, box, width, height), true)
    assert.equal(overlayBoxCoversProductSubject(box, width, height), false)
    const out = await overlayTranslatedText(
      image,
      [{ bbox: box, translatedText: 'Da bò cao cấp lớp đầu' }],
      { sampleBackground: true }
    )
    const before = await sharp(image).extract({ left: box.x, top: box.y, width: box.width, height: box.height }).raw().toBuffer()
    const after = await sharp(out).extract({ left: box.x, top: box.y, width: box.width, height: box.height }).raw().toBuffer()
    assert.notEqual(Buffer.compare(before, after), 0)
  })

  it('widens a short label so the Vietnamese phrase is not cut', () => {
    const text = 'Thân thiện với da, thoải mái'
    assert.equal(overlayLabelTextWasClipped(text, 48, 12), true)
    const items = [
      { bbox: { x: 225, y: 851, width: 48, height: 12 }, translatedText: text },
      { bbox: { x: 359, y: 851, width: 49, height: 13 }, translatedText: 'Thoải mái và thoáng khí' },
      { bbox: { x: 493, y: 851, width: 48, height: 13 }, translatedText: 'Mềm mại và tinh tế' },
    ]
    layoutClippedLabelSlots(items, 768, 1024)
    const grown = items[0].eraseBox
    assert.ok(grown)
    assert.ok(grown.width > 48)
    assert.ok(grown.height > 12)
    assert.ok(grown.x + grown.width <= (items[1].eraseBox?.x ?? 999))
    assert.equal(overlayLabelTextWasClipped(text, grown.width, grown.height), false)
  })
})
