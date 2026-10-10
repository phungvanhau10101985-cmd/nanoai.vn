import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import sharp from 'sharp'
import { isOwnCdnUrl } from './image-localization-config'
import { isImageLocalizationFatalDependencyError } from './gemini-adapter'
import { visionDocumentBlocksToText, visionVerticesToPixelRect } from '@/lib/vision-ocr'
import {
  coalesceStackedCopy,
  joinOverlayGroupText,
  peelKeptLatin,
  peelTrailingGridNumber,
} from './local-pipeline'
import {
  attachTrailingMeasurements,
  clipEdgeBannerBox,
  expandTableCellBoxes,
  fitTableCellText,
  overlayItemsLookLikeTable,
  overlayRegionIsProductPhoto,
  layoutSpecSheetRows,
  overlayTranslatedText,
  sampleOverlayPaint,
  clampTextBoxToSources,
  spaceSpecPunctuation,
  splitOverlayVerticalBands,
  splitTrailingModelCode,
  stripInventedLeadingModelCode,
} from '@/lib/translate-overlay'
import {
  collapseBilingualGlossTranslation,
  dropOversizedSingleWordOverlays,
  layoutImageLocOverlays,
  looksLikeTechnicalLineArt,
  measureTechnicalLineArt,
  mergeDenseImageLocOverlayItems,
  overlayRegionIsTechnicalLineArt,
} from './local-pipeline'
import { isTransientImageLocDbError } from './process-product'
import { imageLocJobIsStalled, imageLocShouldAutoResume } from './job-runtime'

const originalPublicBase = process.env.BUNNY_STORAGE_PUBLIC_BASE_URL

afterEach(() => {
  if (originalPublicBase == null) delete process.env.BUNNY_STORAGE_PUBLIC_BASE_URL
  else process.env.BUNNY_STORAGE_PUBLIC_BASE_URL = originalPublicBase
})

describe('image localization runtime parity', () => {
  it('keeps Vision REST pixel coordinates unchanged', () => {
    const rect = visionVerticesToPixelRect(
      [{ x: 12, y: 20 }, { x: 112, y: 20 }, { x: 112, y: 60 }, { x: 12, y: 60 }],
      1200,
      1600
    )
    assert.deepEqual(rect, { x: 12, y: 20, width: 100, height: 40 })
  })

  it('still supports normalized vertices when supplied', () => {
    const rect = visionVerticesToPixelRect(
      [{ x: 0.1, y: 0.2 }, { x: 0.3, y: 0.2 }, { x: 0.3, y: 0.4 }, { x: 0.1, y: 0.4 }],
      1000,
      500
    )
    assert.deepEqual(rect, { x: 100, y: 100, width: 200, height: 100 })
  })

  it('groups Vision words by paragraph and separates cm from Chinese like 188', () => {
    const word = (text: string, x1: number, x2: number) => ({
      symbols: [...text].map((char) => ({ text: char })),
      boundingBox: {
        vertices: [
          { x: x1, y: 100 },
          { x: x2, y: 100 },
          { x: x2, y: 140 },
          { x: x1, y: 140 },
        ],
      },
    })
    const result = visionDocumentBlocksToText(
      [{ confidence: 0.9, paragraphs: [{ confidence: 0.9, words: [word('8.5', 10, 55), word('cm', 55, 90), word('显瘦显高', 120, 300)] }] }],
      600,
      1_000
    )
    assert.deepEqual(result, [
      { text: '8.5cm', bbox: { x: 10, y: 100, width: 80, height: 40 } },
      { text: '显瘦显高', bbox: { x: 120, y: 100, width: 180, height: 40 } },
    ])
  })

  it('treats only the configured NanoAI Bunny host as own CDN', () => {
    process.env.BUNNY_STORAGE_PUBLIC_BASE_URL = 'https://nanoai.b-cdn.net'
    assert.equal(isOwnCdnUrl('https://nanoai.b-cdn.net/localized-images/a.jpg'), true)
    assert.equal(isOwnCdnUrl('https://188comvn.b-cdn.net/site/a.jpg'), false)
    assert.equal(isOwnCdnUrl('https://img.alicdn.com/a.jpg'), false)
  })

  it('clips local text overlays to the source image', async () => {
    const source = await sharp({
      create: { width: 80, height: 60, channels: 3, background: '#d9d9d9' },
    })
      .png()
      .toBuffer()
    const out = await overlayTranslatedText(
      source,
      [{ bbox: { x: 70, y: 50, width: 100, height: 100 }, translatedText: 'Đã dịch' }],
      { sampleBackground: true }
    )
    const meta = await sharp(out).metadata()
    assert.equal(meta.width, 80)
    assert.equal(meta.height, 60)
  })

  it('erases domains and old years even without replacement text', async () => {
    const source = await sharp({
      create: { width: 24, height: 24, channels: 3, background: '#000000' },
    })
      .png()
      .toBuffer()
    const out = await overlayTranslatedText(
      source,
      [{ bbox: { x: 4, y: 4, width: 12, height: 12 }, translatedText: '', eraseOriginal: true }],
      { fillColor: '#ffffff' }
    )
    const pixel = await sharp(out).extract({ left: 8, top: 8, width: 1, height: 1 }).raw().toBuffer()
    assert.deepEqual([...pixel.subarray(0, 3)], [255, 255, 255])
  })

  it('merges a nearby cm measurement with translated text like 188 drawing', () => {
    const merged = mergeDenseImageLocOverlayItems(
      [
        { bbox: { x: 150, y: 400, width: 120, height: 45 }, translatedText: '8.5cm' },
        { bbox: { x: 290, y: 395, width: 190, height: 55 }, translatedText: 'Tôn dáng, tăng chiều cao' },
      ],
      624,
      1_024
    )
    assert.equal(merged.length, 1)
    assert.equal(merged[0].translatedText, 'Tôn dáng, tăng chiều cao 8.5cm')
    assert.ok(merged[0].bbox.x < 150)
    assert.ok(merged[0].bbox.width > 330)
  })

  it('drops a giant background that only holds one short word', () => {
    const kept = dropOversizedSingleWordOverlays(
      [
        { bbox: { x: 40, y: 80, width: 700, height: 420 }, translatedText: 'Xương' },
        { bbox: { x: 20, y: 520, width: 140, height: 28 }, translatedText: 'Mặt trước' },
      ],
      800,
      600
    )
    assert.equal(kept.length, 1)
    assert.equal(kept[0].translatedText, 'Mặt trước')
  })

  it('drops only the giant one-word slab and still lays out the other clusters', () => {
    const laid = layoutImageLocOverlays(
      [
        { bbox: { x: 40, y: 80, width: 700, height: 420 }, translatedText: 'Xương' },
        { bbox: { x: 80, y: 200, width: 180, height: 40 }, translatedText: 'Chất liệu cotton' },
        { bbox: { x: 20, y: 540, width: 160, height: 28 }, translatedText: 'Mặt trước' },
      ],
      800,
      600
    )
    assert.equal(
      laid.some((item) => item.translatedText === 'Xương'),
      false
    )
    assert.equal(
      laid.some((item) => item.translatedText.includes('Chất liệu cotton')),
      true
    )
    assert.equal(
      laid.some((item) => item.translatedText.includes('Mặt trước')),
      true
    )
  })

  it('drops a two-word hallucination covering the structure drawing', () => {
    const kept = dropOversizedSingleWordOverlays(
      [
        { bbox: { x: 40, y: 70, width: 700, height: 380 }, translatedText: 'Mặc Băng' },
        { bbox: { x: 80, y: 500, width: 160, height: 36 }, translatedText: 'Thường đóng NC' },
        { bbox: { x: 520, y: 500, width: 150, height: 36 }, translatedText: 'Thường mở NO' },
      ],
      800,
      600
    )
    assert.equal(
      kept.some((item) => item.translatedText === 'Mặc Băng'),
      false
    )
    assert.equal(kept.length, 2)
  })

  it('does not merge sparse OCR boxes on a line drawing into one wipe rectangle', () => {
    const boxes = Array.from({ length: 12 }, (_, index) => ({
      bbox: { x: index * 28, y: index * 20, width: 20, height: 16 },
      translatedText: '常',
    }))
    const merged = mergeDenseImageLocOverlayItems(boxes, 800, 600)
    assert.equal(merged.length, 12)
  })

  it('drops a merged two-word slab and keeps the real captions', () => {
    const laid = layoutImageLocOverlays(
      [
        { bbox: { x: 40, y: 80, width: 300, height: 200 }, translatedText: 'Mặc' },
        { bbox: { x: 360, y: 100, width: 300, height: 180 }, translatedText: 'Băng' },
        { bbox: { x: 80, y: 520, width: 160, height: 32 }, translatedText: 'Thường đóng NC' },
      ],
      800,
      600
    )
    assert.equal(
      laid.some((item) => /Mặc|Băng/.test(item.translatedText)),
      false
    )
    assert.equal(laid[0]?.translatedText, 'Thường đóng NC')
  })

  it('collapses a bilingual structure gloss into one phrase', () => {
    assert.equal(
      collapseBilingualGlossTranslation('结构图 /Structure', 'Sơ đồ cấu trúc/Cấu trúc'),
      'Sơ đồ cấu trúc'
    )
    assert.equal(collapseBilingualGlossTranslation('常闭 NC', 'Thường đóng NC'), 'Thường đóng NC')
  })

  it('treats thin black strokes on white as a technical drawing', async () => {
    const width = 480
    const height = 320
    const gray = new Uint8Array(width * height)
    gray.fill(255)
    for (let y = 40; y < 280; y += 14) {
      for (let x = 30; x < 450; x++) gray[y * width + x] = 0
    }
    for (let x = 40; x < 440; x += 18) {
      for (let y = 30; y < 290; y++) gray[y * width + x] = 0
    }
    const stats = measureTechnicalLineArt(gray, width, height)
    assert.equal(looksLikeTechnicalLineArt(stats), true)
    const png = await sharp(Buffer.from(gray), { raw: { width, height, channels: 1 } }).png().toBuffer()
    assert.equal(
      await overlayRegionIsTechnicalLineArt(png, { x: 10, y: 10, width: 460, height: 300 }, width, height),
      true
    )
    const solid = new Uint8Array(width * height)
    solid.fill(255)
    for (let y = 80; y < 240; y++) {
      for (let x = 80; x < 400; x++) solid[y * width + x] = 0
    }
    assert.equal(looksLikeTechnicalLineArt(measureTechnicalLineArt(solid, width, height)), false)
  })

  it('keeps each cell of a spec table instead of merging rows', () => {
    const cells = [0, 1, 2, 3].flatMap((row) => [
      { bbox: { x: 12, y: 40 + row * 36, width: 140, height: 24 }, translatedText: `Nhãn ${row}` },
      { bbox: { x: 180, y: 40 + row * 36, width: 360, height: 24 }, translatedText: `Giá trị ${row}` },
    ])
    assert.equal(overlayItemsLookLikeTable(cells), true)
    const laid = layoutImageLocOverlays(cells, 800, 400)
    assert.equal(laid.length, 8)
  })

  it('stops a table value at the latin row underneath', () => {
    const cells = [0, 1, 2, 3].flatMap((row) => [
      { bbox: { x: 40, y: 60 + row * 34, width: 48, height: 16 }, translatedText: `Nhãn ${row}` },
      { bbox: { x: 230, y: 60 + row * 34, width: 90, height: 16 }, translatedText: `Mã ${row}` },
    ])
    const expanded = expandTableCellBoxes(cells, 790, [
      { bbox: { x: 230, y: 80, width: 280, height: 14 }, translatedText: '12, 15, 20' },
    ])
    const value = expanded[1]!
    assert.ok(value.bbox.y + value.bbox.height <= 80)
  })

  it('widens a narrow label up to the value column', () => {
    const cells = [0, 1, 2, 3].flatMap((row) => [
      { bbox: { x: 40, y: 60 + row * 34, width: 48, height: 16 }, translatedText: row === 0 ? 'Cuộn dây' : `Nhãn ${row}` },
      { bbox: { x: 230, y: 60 + row * 34, width: 160, height: 16 }, translatedText: `Giá trị ${row}` },
    ])
    const expanded = expandTableCellBoxes(cells, 790)
    const label = expanded[0]!
    assert.ok(label.bbox.width > 100)
    assert.ok(label.bbox.x + label.bbox.width < 230)
    assert.ok(label.bbox.y + label.bbox.height <= cells[2]!.bbox.y)
  })

  it('splits a spec line glued after IP65', () => {
    const text = spaceSpecPunctuation('S91B/S91BT:20VA(AC),16W(DC),IP65SD01B:30VA(AC),40W(DC),IP65˙')
    assert.match(text, /IP65\nSD01B: 30VA/)
    assert.equal(text.endsWith('˙'), false)
  })

  it('keeps a size chart separate from the warning above it', () => {
    const warning = { bbox: { x: 20, y: 360, width: 360, height: 16 }, translatedText: 'Sai số đo thủ công là hiện tượng bình thường' }
    const table = [0, 1, 2, 3].flatMap((row) =>
      [0, 1].map((column) => ({
        bbox: { x: 20 + column * 160, y: 430 + row * 24, width: 70, height: 14 },
        translatedText: `Ô ${row}-${column}`,
      }))
    )
    const bands = splitOverlayVerticalBands([warning, ...table])
    assert.equal(bands.length, 2)
    assert.equal(overlayItemsLookLikeTable(bands[0]!), false)
    assert.equal(overlayItemsLookLikeTable(bands[1]!), true)
    const clamped = clampTextBoxToSources(
      { x: 20, y: 360, width: 360, height: 90 },
      warning.bbox,
      table,
      420,
      700
    )
    assert.ok(clamped.y + clamped.height <= 430)
  })

  it('fits a long Vietnamese label inside the table row', () => {
    const fitted = fitTableCellText('Phạm vi áp suất làm việc', 130, 28)
    assert.ok(fitted.lines.length * fitted.lineHeight <= 30)
    assert.ok(fitted.fontSize >= 10)
    assert.ok(fitted.fontSize <= 15)
  })

  it('keeps a brand in Latin and reads a measurement from the left', () => {
    assert.deepEqual(peelKeptLatin('>商品参数 SHOSE SHOW'), {
      text: '商品参数',
      trailing: 'SHOSE SHOW',
      leading: '>',
    })
    assert.deepEqual(peelKeptLatin('商品参数SHOSESHOW'), {
      text: '商品参数',
      trailing: 'SHOSE SHOW',
      leading: '',
    })
    assert.equal(peelKeptLatin('鞋面材质:PU').text, '鞋面材质:PU')
    assert.deepEqual(peelKeptLatin('JS杰仕西服'), {
      text: '杰仕西服',
      trailing: '',
      leading: 'JS',
    })
    assert.equal(peelKeptLatin('商品参数/Product Parameters').trailing, '')
    const joined = joinOverlayGroupText([
      { bbox: { x: 515, y: 245, width: 25, height: 14 }, translatedText: '19cm' },
      { bbox: { x: 443, y: 246, width: 55, height: 14 }, translatedText: 'Cao gót' },
    ])
    assert.equal(joined, 'Cao gót: 19cm')
  })

  it('translates stacked footnote lines as one sentence', () => {
    const block = (text: string, y: number, width: number) => ({
      block: { text, bbox: [40, y, 40 + width, y + 12] as [number, number, number, number] },
      source: text,
      translated: '',
      eraseOriginal: false,
      trailing: '',
      leading: '',
    })
    const merged = coalesceStackedCopy(
      [
        block('备注:测量标准码为36码,每增加(减)一个尺码,鞋', 300, 280),
        block('长增加(减)5mm。', 314, 100),
        block('测量方式可能存在误差,具体以实物为准。', 328, 210),
        block('鞋面材质:PU', 100, 80),
      ],
      749
    )
    assert.equal(merged.length, 2)
    const note = merged.find((item) => item.source.includes('备注'))
    assert.match(note?.source || '', /鞋长增加/)
    assert.match(note?.source || '', /实物为准/)
    assert.equal(merged.some((item) => item.source === '鞋面材质:PU'), true)
  })

  it('keeps brown ink on a light panel and white ink on a blue panel', async () => {
    const width = 80
    const height = 36
    const raw = Buffer.alloc(width * height * 3, 236)
    for (let y = 10; y < 26; y++) {
      for (let x = 12; x < 40; x++) {
        const offset = (y * width + x) * 3
        raw[offset] = 122
        raw[offset + 1] = 72
        raw[offset + 2] = 28
      }
    }
    const cream = await sharp(raw, { raw: { width, height, channels: 3 } }).png().toBuffer()
    const brown = await sampleOverlayPaint(cream, { x: 8, y: 6, width: 40, height: 24 }, width, height)
    assert.ok(brown.flat)
    assert.ok(brown.ink[0] > brown.ink[2] + 30)
    assert.ok(brown.fill[0] > 200 && brown.fill[1] > 200)

    const blueRaw = Buffer.alloc(width * height * 3)
    for (let i = 0; i < width * height; i++) {
      blueRaw[i * 3] = 18
      blueRaw[i * 3 + 1] = 42
      blueRaw[i * 3 + 2] = 92
    }
    for (let y = 8; y < 22; y++) {
      for (let x = 10; x < 36; x++) {
        const offset = (y * width + x) * 3
        blueRaw[offset] = 245
        blueRaw[offset + 1] = 245
        blueRaw[offset + 2] = 245
      }
    }
    const blue = await sharp(blueRaw, { raw: { width, height, channels: 3 } }).png().toBuffer()
    const whiteOnBlue = await sampleOverlayPaint(blue, { x: 4, y: 4, width: 44, height: 24 }, width, height)
    assert.ok(whiteOnBlue.flat)
    assert.ok(whiteOnBlue.ink[0] > 200)
    assert.ok(whiteOnBlue.fill[2] > whiteOnBlue.fill[0] + 20)
  })

  it('snaps antialiased black ink to black and antialiased white ink to white', async () => {
    const width = 90
    const height = 40
    const raw = Buffer.alloc(width * height * 3, 248)
    for (let y = 8; y < 28; y++) {
      for (let x = 10; x < 70; x++) {
        const offset = (y * width + x) * 3
        const core = x >= 16 && x < 64 && y >= 12 && y < 24
        const value = core ? 12 : 118
        raw[offset] = value
        raw[offset + 1] = value
        raw[offset + 2] = value
      }
    }
    const light = await sharp(raw, { raw: { width, height, channels: 3 } }).png().toBuffer()
    const black = await sampleOverlayPaint(light, { x: 6, y: 4, width: 70, height: 30 }, width, height)
    assert.deepEqual(black.ink, [0, 0, 0])

    const dark = Buffer.alloc(width * height * 3, 28)
    for (let y = 8; y < 28; y++) {
      for (let x = 10; x < 70; x++) {
        const offset = (y * width + x) * 3
        const core = x >= 16 && x < 64 && y >= 12 && y < 24
        const value = core ? 246 : 150
        dark[offset] = value
        dark[offset + 1] = value
        dark[offset + 2] = value
      }
    }
    const night = await sharp(dark, { raw: { width, height, channels: 3 } }).png().toBuffer()
    const white = await sampleOverlayPaint(night, { x: 6, y: 4, width: 70, height: 30 }, width, height)
    assert.deepEqual(white.ink, [255, 255, 255])
  })

  it('left-aligns a spec column on one shared edge', () => {
    const rows = ['Chất liệu mặt: PU', 'Chất liệu lót: PU', 'Màu: da báo', 'Size: 34-50', 'Cao gót: 19cm'].map(
      (text, index) => ({
        bbox: { x: 442, y: 110 + index * 22, width: 80, height: 14 },
        translatedText: text,
      })
    )
    layoutSpecSheetRows(rows, 749)
    assert.equal(rows.every((row) => row.specRow && row.textAlign === 'start'), true)
    assert.equal(new Set(rows.map((row) => row.textOriginX)).size, 1)
    assert.equal(rows[0]?.textOriginX, 442)
    assert.ok((rows[0]?.eraseBox?.width || 0) > 80)
  })

  it('keeps a body label and the measurement beside it on one line', () => {
    const attached = attachTrailingMeasurements(
      [{ bbox: { x: 141, y: 85, width: 22, height: 11 }, translatedText: 'Vòng ngực' }],
      [{ bbox: { x: 170, y: 85, width: 31, height: 10 }, translatedText: '82cm' }]
    )
    assert.equal(attached.obstacles.length, 0)
    assert.equal(attached.items[0]?.translatedText, 'Vòng ngực 82cm')
    assert.ok((attached.items[0]?.bbox.width || 0) >= 50)
    const fitted = fitTableCellText('Vòng ngực 82cm', 72, 16)
    assert.deepEqual(fitted.lines, ['Vòng ngực 82cm'])
    assert.ok(fitted.fontSize >= 10)
  })

  it('never shrinks translated table text below 10px', () => {
    const fitted = fitTableCellText('Nhãn thông số rất dài trong một ô hẹp', 54, 18)
    assert.equal(fitted.fontSize, 10)
    assert.ok(fitted.lines.length * fitted.lineHeight <= 18)
    for (const line of fitted.lines) {
      assert.ok(line.length > 0)
    }
  })

  it('stops a short scale label at the midpoint before the next short label', () => {
    const cells = [0, 1, 2, 3].flatMap((index) => [
      { bbox: { x: 20, y: 40 + index * 30, width: 40, height: 14 }, translatedText: 'Đàn hồi' },
      { bbox: { x: 220, y: 40 + index * 30, width: 36, height: 14 }, translatedText: 'Ôm sát' },
    ])
    const expanded = expandTableCellBoxes(cells, 384)
    const first = expanded[0]!
    assert.ok(first.bbox.x + first.bbox.width <= 150)
    assert.ok(first.bbox.x + first.bbox.width < 220)
  })

  it('joins stacked care notes into one paragraph', () => {
    const laid = layoutImageLocOverlays(
      [
        { bbox: { x: 29, y: 968, width: 324, height: 10 }, translatedText: 'Nên giặt tay vì máy giặt làm áo biến dạng.' },
        { bbox: { x: 29, y: 985, width: 173, height: 10 }, translatedText: 'Dùng nước lạnh, không ngâm quá lâu.' },
      ],
      384,
      1024
    )
    assert.equal(laid.length, 1)
    assert.match(laid[0]!.translatedText, /Nên giặt tay/)
    assert.match(laid[0]!.translatedText, /nước lạnh/)
  })

  it('peels a model code glued onto a slogan', () => {
    const peeled = splitTrailingModelCode('好阀选永创用心来创造50GBN')
    assert.equal(peeled.code, '50GBN')
    assert.equal(peeled.text.includes('50GBN'), false)
    assert.equal(splitTrailingModelCode('线圈').code, '')
    assert.equal(
      stripInventedLeadingModelCode('好阀选永创用心来创造', '2W31 Chọn van tốt, Yongchuang'),
      'Chọn van tốt, Yongchuang'
    )
  })

  it('joins a four-word callout with its cm', () => {
    const laid = layoutImageLocOverlays(
      [
        { bbox: { x: 142, y: 268, width: 67, height: 19 }, translatedText: 'Chiều rộng ống trên' },
        { bbox: { x: 213, y: 268, width: 55, height: 21 }, translatedText: '47cm' },
      ],
      629,
      1024
    )
    assert.equal(laid.length, 1)
    assert.match(laid[0]!.translatedText, /47cm/)
  })

  it('does not let a spec line cross the gutter into the other column', () => {
    const cells = [0, 1, 2, 3].flatMap((row) => [
      {
        bbox: { x: 20, y: 40 + row * 36, width: 180, height: 18 },
        translatedText: 'Đế giày/SOLE: Đế cao su chống trượt',
      },
      { bbox: { x: 370, y: 40 + row * 36, width: 180, height: 18 }, translatedText: 'Lớp lót/INSIDE: vải' },
    ])
    const expanded = expandTableCellBoxes(cells, 629)
    const left = expanded[0]!
    assert.ok(left.bbox.x + left.bbox.width < 300)
    assert.ok(left.bbox.x + left.bbox.width < 370)
  })

  it('joins a nearby cm with its label and leaves the other spec column alone', () => {
    const laid = layoutImageLocOverlays(
      [
        { bbox: { x: 35, y: 828, width: 40, height: 20 }, translatedText: 'Cao gót' },
        { bbox: { x: 152, y: 828, width: 43, height: 20 }, translatedText: '19cm' },
        { bbox: { x: 368, y: 829, width: 226, height: 20 }, translatedText: 'Cỡ: 34-43#' },
      ],
      629,
      1024
    )
    assert.equal(laid.length, 2)
    const heel = laid.find((item) => item.bbox.x < 200)
    const size = laid.find((item) => item.bbox.x > 300)
    assert.match(heel?.translatedText || '', /19cm/)
    assert.doesNotMatch(size?.translatedText || '', /19cm/)
  })

  it('keeps the next measurement label out of a label that already has its cm', () => {
    const laid = layoutImageLocOverlays(
      [
        { bbox: { x: 140, y: 62, width: 24, height: 11 }, translatedText: 'Chiều cao' },
        { bbox: { x: 172, y: 62, width: 37, height: 11 }, translatedText: '165cm' },
        { bbox: { x: 229, y: 62, width: 59, height: 10 }, translatedText: 'Cân nặng 47kg' },
        { bbox: { x: 311, y: 62, width: 47, height: 11 }, translatedText: 'Cỡ đang mặc' },
      ],
      384,
      1024
    )
    assert.equal(laid.length, 3)
    const height = laid.find((item) => item.translatedText.includes('165cm'))
    assert.match(height?.translatedText || '', /Chiều cao/)
    assert.equal(height?.translatedText.includes('Cân nặng'), false)
    assert.equal(laid.some((item) => item.translatedText === 'Cân nặng 47kg'), true)
    assert.equal(laid.some((item) => item.translatedText === 'Cỡ đang mặc'), true)
  })

  it('peels a size-chart number off the header so the cell stays', () => {
    const peeled = peelTrailingGridNumber('对照表 34')
    assert.equal(peeled.text, '对照表')
    assert.equal(peeled.number, '34')
    assert.equal(peelTrailingGridNumber('上筒宽').number, '')
    assert.equal(peelTrailingGridNumber('高 60').number, '')
  })

  it('does not merge a model code into the slogan line', () => {
    const laid = layoutImageLocOverlays(
      [
        { bbox: { x: 585, y: 686, width: 147, height: 40 }, translatedText: '2W31' },
        {
          bbox: { x: 37, y: 723, width: 711, height: 65 },
          translatedText: 'Chọn van tốt, Yongchuang tạo nên bằng cả trái tim',
        },
      ],
      800,
      800
    )
    assert.equal(laid.length, 2)
  })

  it('stops a bottom slogan before the model badge', async () => {
    const slogan = {
      bbox: { x: 37, y: 723, width: 711, height: 65 },
      translatedText: 'Van tốt chọn Yongchuang, tạo bằng cả trái tim',
    }
    const badge = { bbox: { x: 585, y: 686, width: 147, height: 40 }, translatedText: '' }
    const clipped = clipEdgeBannerBox(slogan, [badge], 800, 800)
    assert.ok(clipped.x + clipped.width <= 585)
    assert.ok(clipped.y <= 723)
    assert.ok(clipped.y + clipped.height <= 800)

    const source = await sharp({
      create: { width: 800, height: 800, channels: 3, background: { r: 220, g: 40, b: 40 } },
    })
      .composite([
        {
          input: await sharp({
            create: { width: 800, height: 110, channels: 3, background: { r: 20, g: 110, b: 70 } },
          })
            .png()
            .toBuffer(),
          top: 690,
          left: 0,
        },
        {
          input: await sharp({
            create: { width: 250, height: 120, channels: 3, background: { r: 196, g: 154, b: 74 } },
          })
            .png()
            .toBuffer(),
          top: 680,
          left: 550,
        },
      ])
      .png()
      .toBuffer()
    const out = await overlayTranslatedText(source, [slogan], {
      fillColor: '#ffffff',
      textColor: '#ffffff',
      obstacles: [badge],
    })
    const product = await sharp(out).extract({ left: 200, top: 640, width: 1, height: 1 }).raw().toBuffer()
    const gold = await sharp(out).extract({ left: 640, top: 750, width: 1, height: 1 }).raw().toBuffer()
    assert.ok(product[0] > 180 && product[1] < 80)
    assert.ok(gold[0] > 150 && gold[2] < 140)
  })

  it('does not treat a feature poster with photos between text bands as a table', () => {
    const cells = [30, 290, 550].flatMap((x) =>
      [520, 568, 616].map((y) => ({
        bbox: { x, y, width: 200, height: 36 },
        translatedText: `Cột ${x}`,
      }))
    )
    cells.push(
      { bbox: { x: 24, y: 24, width: 120, height: 40 }, translatedText: 'Vải bền' },
      { bbox: { x: 190, y: 24, width: 120, height: 40 }, translatedText: 'Thợ may' },
      { bbox: { x: 370, y: 24, width: 140, height: 40 }, translatedText: 'Kim khí' },
      { bbox: { x: 30, y: 860, width: 240, height: 28 }, translatedText: 'Kim loại cao cấp' }
    )
    assert.equal(overlayItemsLookLikeTable(cells), false)
  })

  it('does not whitewash a product photo covered by an OCR box', async () => {
    const width = 180
    const height = 120
    const raw = Buffer.alloc(width * height * 3)
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 3
        raw[i] = 90 + ((x * 17 + y * 13) % 120)
        raw[i + 1] = 40 + ((x * 3 + y * 19) % 90)
        raw[i + 2] = 20 + ((x * 11 + y * 7) % 50)
      }
    }
    const source = await sharp(raw, { raw: { width, height, channels: 3 } }).png().toBuffer()
    assert.equal(
      await overlayRegionIsProductPhoto(source, { x: 0, y: 0, width, height }, width, height),
      true
    )
    const out = await overlayTranslatedText(
      source,
      [{ bbox: { x: 0, y: 0, width, height }, translatedText: 'Da bò lớp đầu' }],
      { fillColor: '#ffffff', textColor: '#000000' }
    )
    const pixel = await sharp(out).extract({ left: 20, top: 20, width: 1, height: 1 }).raw().toBuffer()
    assert.ok(pixel[0] > pixel[2], `expected leather, got ${[...pixel.subarray(0, 3)].join(',')}`)
    assert.ok(pixel[0] < 230)
  })

  it('does not paint a table label into the row below', async () => {
    const source = await sharp({
      create: { width: 420, height: 180, channels: 3, background: '#ffffff' },
    })
      .png()
      .toBuffer()
    const cells = [0, 1, 2, 3].flatMap((row) => [
      {
        bbox: { x: 8, y: 8 + row * 40, width: 130, height: 28 },
        translatedText: row === 0 ? 'Phạm vi áp suất làm việc' : `Nhãn ${row}`,
      },
      {
        bbox: { x: 160, y: 8 + row * 40, width: 240, height: 28 },
        translatedText: `Giá trị ${row}`,
      },
    ])
    const out = await overlayTranslatedText(source, cells, { fillColor: '#ffffff', textColor: '#000000' })
    const nextRow = await sharp(out).extract({ left: 110, top: 58, width: 1, height: 1 }).raw().toBuffer()
    assert.ok(nextRow[0] > 240)
  })

  it('keeps a small one-word label and a multi-word block on a large box', () => {
    const kept = dropOversizedSingleWordOverlays(
      [
        { bbox: { x: 10, y: 10, width: 90, height: 32 }, translatedText: 'Cotton' },
        { bbox: { x: 20, y: 40, width: 640, height: 36 }, translatedText: 'Sale' },
        { bbox: { x: 40, y: 80, width: 700, height: 420 }, translatedText: 'Chất liệu cotton mềm' },
      ],
      800,
      600
    )
    assert.equal(kept.length, 3)
  })

  it('does not treat a Bunny Storage 401 as a fatal Gemini dependency', () => {
    const bunny = new Error('Bunny Storage upload failed (401): {"HttpCode":401,"Message":"Unauthorized"}')
    assert.equal(isImageLocalizationFatalDependencyError(bunny), false)
    assert.equal(isImageLocalizationFatalDependencyError(new Error('GCP auth failed: Unauthorized')), true)
  })

  it('retries only transient database failures', () => {
    assert.equal(isTransientImageLocDbError({ code: '40001' }), true)
    assert.equal(isTransientImageLocDbError(new Error('read ECONNRESET')), true)
    assert.equal(isTransientImageLocDbError({ code: '23505' }), false)
  })

  it('resumes an unfinished job after deploy even when the database resume count is already at the cap', () => {
    assert.equal(
      imageLocShouldAutoResume({
        workerAlive: false,
        stalled: true,
        attemptsThisProcess: 0,
        maxAttempts: 6,
      }),
      'resume'
    )
    assert.equal(
      imageLocShouldAutoResume({
        workerAlive: true,
        stalled: false,
        attemptsThisProcess: 0,
        maxAttempts: 6,
      }),
      'running'
    )
    assert.equal(
      imageLocShouldAutoResume({
        workerAlive: false,
        stalled: true,
        attemptsThisProcess: 6,
        maxAttempts: 6,
      }),
      'skip-cap'
    )
  })

  it('replaces stalled processing workers but never off-peak waiters', () => {
    const now = Date.parse('2026-09-21T04:00:00.000Z')
    const stale = '2026-09-21T03:30:00.000Z'
    assert.equal(imageLocJobIsStalled({ status: 'running', phase: 'processing', updated_at: stale }, now), true)
    assert.equal(imageLocJobIsStalled({ status: 'running', phase: 'waiting_off_peak', updated_at: stale }, now), false)
    assert.equal(imageLocJobIsStalled({ status: 'done', phase: 'done', updated_at: stale }, now), false)
  })
})
