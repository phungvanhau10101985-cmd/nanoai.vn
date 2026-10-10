import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import sharp from 'sharp'
import {
  clampSlotToNeighbors,
  fitLocalizedLabelText,
  fitPosterParagraphText,
  fitSolidPlateLayout,
  fitTableCellText,
  fitTextPlate,
  growBoxAlongFill,
  layoutClippedLabelSlots,
  mobileReadableFontSize,
  readableOverlayFont,
  ocrLineFontSize,
  overlayBoxCoversProductSubject,
  overlayLabelTextWasClipped,
  overlayRegionIsFlatLightHeader,
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
    const before = await sharp(image).extract({ left: box.x, top: box.y, width: box.width, height: box.height }).removeAlpha().raw().toBuffer()
    const after = await sharp(out).extract({ left: box.x, top: box.y, width: box.width, height: box.height }).removeAlpha().raw().toBuffer()
    assert.notEqual(Buffer.compare(before, after), 0)
    assert.equal(ocrLineFontSize(44), 44)
    assert.equal(ocrLineFontSize(8), 10)
  })

  it('keeps a domain mark that sits on a white header', async () => {
    const width = 240
    const height = 80
    const image = await sharp({
      create: { width, height, channels: 3, background: '#ffffff' },
    })
      .composite([
        {
          input: await sharp({
            create: { width: 48, height: 16, channels: 3, background: '#f97316' },
          })
            .png()
            .toBuffer(),
          left: 160,
          top: 12,
        },
      ])
      .png()
      .toBuffer()
    const box = { x: 160, y: 12, width: 48, height: 16 }
    assert.equal(await overlayRegionIsFlatLightHeader(image, box, width, height), true)
    const out = await overlayTranslatedText(
      image,
      [{ bbox: box, translatedText: '', eraseOriginal: true }],
      { sampleBackground: true }
    )
    const pixel = await sharp(out).extract({ left: 170, top: 18, width: 1, height: 1 }).raw().toBuffer()
    assert.ok(pixel[0] > 200)
    assert.ok(pixel[1] < 180)
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
    assert.equal(items[0].eraseBox?.height, items[1].eraseBox?.height)
    assert.equal(items[1].eraseBox?.height, items[2].eraseBox?.height)
    assert.equal(overlayLabelTextWasClipped(text, grown.width, grown.height), false)
  })

  it('fits a solid plate inside the gap between neighboring blocks', () => {
    const source = { x: 251, y: 602, width: 263, height: 44 }
    const fabric = { x: 300, y: 540, width: 120, height: 22 }
    const card = { x: 190, y: 760, width: 390, height: 180 }
    const finger = { x: 20, y: 580, width: 150, height: 80 }
    const slot = clampSlotToNeighbors(source, { x: 0, y: 0, width: 768, height: 1024 }, [fabric, card, finger])
    const plate = fitSolidPlateLayout('Da bò cao cấp lớp đầu', source, slot, 768, 1024)
    assert.equal(plate.lines.join(' '), 'Da bò cao cấp lớp đầu')
    assert.ok(plate.fontSize >= 10)
    assert.ok(plate.fontSize <= 44)
    assert.ok(plate.x >= finger.x + finger.width)
    assert.ok(plate.y >= fabric.y + fabric.height)
    assert.ok(plate.y + plate.height <= card.y)
    assert.ok(plate.x + plate.width <= 768)
    assert.ok(plate.x <= source.x)
    assert.ok(plate.x + plate.width >= source.x + source.width)
  })

  it('keeps a photo plate over the source glyphs when the white slot sits to the left', () => {
    const source = { x: 140, y: 250, width: 90, height: 28 }
    const slot = { x: 8, y: 220, width: 110, height: 80 }
    const plate = fitSolidPlateLayout('Chiều rộng ống trên: 47cm', source, slot, 629, 1024)
    assert.ok(plate.x <= source.x + 4)
    assert.ok(plate.x + plate.width >= source.x + source.width - 4)
    assert.ok(plate.y <= source.y + 4)
    assert.ok(plate.y + plate.height >= source.y + source.height - 4)
  })

  it('raises small labels to a mobile-readable size and hugs the text', () => {
    assert.equal(mobileReadableFontSize(390), 14)
    assert.equal(mobileReadableFontSize(768), 28)
    const column = { x: 200, y: 851, width: 140, height: 90 }
    const plate = fitTextPlate('Mềm mại', column, mobileReadableFontSize(768))
    assert.equal(plate.fontSize, 28)
    assert.equal(plate.lines.join(' '), 'Mềm mại')
    assert.ok(plate.width < column.width)
    assert.ok(plate.x >= column.x)
    assert.ok(plate.x + plate.width <= column.x + column.width)
  })

  it('keeps a wide black headline on white instead of painting a black bar', async () => {
    const width = 420
    const height = 160
    const raw = Buffer.alloc(width * height * 3, 255)
    for (let y = 28; y < 62; y++) {
      for (let x = 80; x < 300; x += 18) {
        for (let dx = 0; dx < 8; dx++) {
          const offset = (y * width + x + dx) * 3
          raw[offset] = 8
          raw[offset + 1] = 8
          raw[offset + 2] = 8
        }
      }
    }
    const image = await sharp(raw, { raw: { width, height, channels: 3 } }).png().toBuffer()
    const drawn = await overlayTranslatedText(
      image,
      [{ bbox: { x: 70, y: 22, width: 250, height: 46 }, translatedText: 'Bảo vệ kép nâng cấp giữ ấm' }],
      { sampleBackground: true }
    )
    const box = await sharp(drawn)
      .extract({ left: 70, top: 22, width: 250, height: 46 })
      .removeAlpha()
      .raw()
      .toBuffer()
    let dark = 0
    let light = 0
    const total = 250 * 46
    for (let i = 0; i < total; i++) {
      const lum = 0.299 * box[i * 3] + 0.587 * box[i * 3 + 1] + 0.114 * box[i * 3 + 2]
      if (lum < 40) dark += 1
      else if (lum > 220) light += 1
    }
    assert.ok(light > total * 0.45)
    assert.ok(dark > 20)
    assert.ok(dark < total * 0.45)
  })

  it('keeps a long caption at a readable size by wrapping instead of shrinking to 10px', () => {
    assert.equal(readableOverlayFont(390), 16)
    assert.ok(readableOverlayFont(690) >= 24)
    assert.equal(readableOverlayFont(1600), 30)
    const fitted = fitTableCellText(
      'Bảo vệ bốn lớp khóa lông mật độ cao công nghệ nạp lông chia ô',
      280,
      64,
      readableOverlayFont(690)
    )
    assert.ok(fitted.fontSize >= 16)
    assert.ok(fitted.lines.length >= 2)
    assert.ok(fitted.lines.length * fitted.lineHeight <= 66)
  })

  it('grows a caption downward on the same fill and stops at a dark stroke', async () => {
    const width = 200
    const height = 80
    const raw = Buffer.alloc(width * height * 3, 245)
    for (let y = 52; y < 56; y++) {
      for (let x = 0; x < width; x++) {
        const offset = (y * width + x) * 3
        raw[offset] = 20
        raw[offset + 1] = 20
        raw[offset + 2] = 20
      }
    }
    const image = await sharp(raw, { raw: { width, height, channels: 3 } }).png().toBuffer()
    const grown = await growBoxAlongFill(
      image,
      { x: 20, y: 16, width: 140, height: 16 },
      [245, 245, 245],
      [],
      width,
      height,
      48
    )
    assert.ok(grown.height > 16)
    assert.ok(grown.y + grown.height <= 52)
  })
})
