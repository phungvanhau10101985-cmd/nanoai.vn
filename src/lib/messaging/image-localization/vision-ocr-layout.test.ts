import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { visionDocumentBlocksToText } from '../../vision-ocr'

function word(text: string, x1: number, y1: number, x2: number, y2: number) {
  return {
    symbols: [...text].map((char) => ({ text: char })),
    boundingBox: {
      vertices: [
        { x: x1, y: y1 },
        { x: x2, y: y1 },
        { x: x2, y: y2 },
        { x: x1, y: y2 },
      ],
    },
  }
}

describe('image localization OCR layout', () => {
  it('splits visually separate Chinese lines from one Vision paragraph', () => {
    const blocks = visionDocumentBlocksToText(
      [
        {
          paragraphs: [
            {
              words: [
                word('用匠心精心打造', 220, 415, 405, 426),
                word('没处不为人知的小细节', 410, 415, 538, 426),
                word('铸就了一双有爱的鞋子', 291, 449, 468, 465),
              ],
            },
          ],
        },
      ],
      750,
      1101
    )

    assert.deepEqual(
      blocks.map((block) => ({ text: block.text, bbox: block.bbox })),
      [
        {
          text: '用匠心精心打造没处不为人知的小细节',
          bbox: { x: 220, y: 415, width: 318, height: 11 },
        },
        {
          text: '铸就了一双有爱的鞋子',
          bbox: { x: 291, y: 449, width: 177, height: 16 },
        },
      ]
    )
  })

  it('keeps words on the same visual line in reading order', () => {
    const blocks = visionDocumentBlocksToText(
      [
        {
          paragraphs: [
            {
              words: [
                word('一双鞋', 30, 100, 100, 118),
                word('细节', 160, 100, 200, 118),
              ],
            },
          ],
        },
      ],
      400,
      300
    )

    assert.equal(blocks.length, 1)
    assert.equal(blocks[0].text, '一双鞋细节')
    assert.deepEqual(blocks[0].bbox, { x: 30, y: 100, width: 170, height: 18 })
  })
})
