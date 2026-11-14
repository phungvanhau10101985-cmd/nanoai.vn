import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { PDFDocument } from 'pdf-lib'
import { buildPdfFromTranslatedPages, rewritePdfPageText } from './pdf-page-paint'

const ONE_PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
)

describe('pdf page paint', () => {
  it('keeps the source page size when the translated words are painted', async () => {
    const doc = await PDFDocument.create()
    doc.addPage([595.2, 841.8])
    const source = Buffer.from(await doc.save())
    const painted = await rewritePdfPageText({
      pagePdf: source,
      png: null,
      lines: [{ text: 'Hello', x: 72, y: 80, w: 220, h: 18 }],
      translated: ['Xin chào'],
    })
    const loaded = await PDFDocument.load(painted)
    const size = loaded.getPage(0).getSize()
    assert.ok(Math.abs(size.width - 595.2) < 0.2)
    assert.ok(Math.abs(size.height - 841.8) < 0.2)
  })

  it('places a redrawn page on the original page size', async () => {
    const pdf = await buildPdfFromTranslatedPages([
      { png: ONE_PIXEL_PNG, widthPt: 595, heightPt: 842, lines: ['kW', 'VTC-15'] },
    ])
    const loaded = await PDFDocument.load(pdf)
    const size = loaded.getPage(0).getSize()
    assert.ok(Math.abs(size.width - 595) < 0.2)
    assert.ok(Math.abs(size.height - 842) < 0.2)
  })
})
